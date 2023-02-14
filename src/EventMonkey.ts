import {
  ButtonInteraction,
  Channel,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Events,
  ForumChannel,
  GuildMemberRoleManager,
  GuildScheduledEvent,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
  Interaction,
  InteractionCollector,
  InteractionType,
  ModalSubmitInteraction,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
  ThreadChannel,
  User,
} from "discord.js";

import { createSubmissionEmbed, eventEditModal } from "./ContentCreators";
import buttonHandlers from "./EventButtonHandlers";
import eventCreationButtonHandlers from "./EventCreationButtonHandlers";
import {
  createForumChannelEvent,
  createGuildScheduledEvent,
} from "./EventCreators";
import { EventMonkeyConfiguration } from "./EventMonkeyConfiguration";
import { EventMonkeyEvent } from "./EventMonkeyEvent";
import {
  deserialize as deserializeRecurrence,
  getNextRecurrence,
} from "./Recurrence";
import {
  deseralizePreviewEmbed,
  deserializeModalFields,
  getAttendeeTags,
  getTimeString,
  ModalDeserializationConfig,
} from "./Serialization";
import {
  closeAllOutdatedThreads,
  closeEventThread,
  sortAllEventThreads,
} from "./ThreadUtilities";
import { days, hours, minutes } from "./TimeConversion";

export { EventMonkeyConfiguration, EventMonkeyEvent };
export { configuration };

interface UserEventMap {
  [userId: string]: [Date, EventMonkeyEvent];
}

let configuration: EventMonkeyConfiguration;

const eventsUnderConstruction: UserEventMap = {};

export function saveEvent(event: EventMonkeyEvent) {
  eventsUnderConstruction[event.author.id] = [new Date(), event];
}

export function deleteEvent(userId: string) {
  delete eventsUnderConstruction[userId];
}

export function configure(newConfiguration: EventMonkeyConfiguration) {
  const cachedClient = configuration?.discordClient;
  configuration = newConfiguration;

  if (configuration.eventTypes.length === 0) {
    throw new Error(
      "You must define at least one event type in the configuration."
    );
  }

  const client = configuration.discordClient;
  if (client && client !== cachedClient) {
    listenForButtons();
    client.on(
      "guildScheduledEventDelete",
      async (guildScheduledEvent: GuildScheduledEvent) => {
        if (!guildScheduledEvent.description) return;

        const thread = getThreadFromEventDescription(
          guildScheduledEvent.description
        );
        if (thread) closeEventThread(thread, guildScheduledEvent);
      }
    );

    client.on("guildScheduledEventUserAdd", userShowedInterest);
    client.on("guildScheduledEventUpdate", eventWasCompletedOrCancelled);
    client.on("guildScheduledEventUpdate", eventStarted);

    closeAllOutdatedThreads();
    performAnnouncements();
    sortAllEventThreads();
    startRecurringTasks();
  }
}

function startRecurringTasks() {
  setInterval(clearEventsUnderConstruction, hours(1));
  setInterval(closeAllOutdatedThreads, minutes(30));
  setInterval(performAnnouncements, minutes(1));
}

async function eventStarted(
  oldEvent: GuildScheduledEvent | null,
  event: GuildScheduledEvent
) {
  if (!event.description || !event.scheduledStartAt) return;
  if (event.status !== GuildScheduledEventStatus.Active) return;
  if (!configuration.discordClient) return;

  const thread = getThreadFromEventDescription(event.description);
  if (!thread) return;

  const eventType = configuration.eventTypes.find(
    (x) => x.channel === thread.parent?.id || x.channel === thread.parent?.name
  );
  if (!eventType || !eventType.announcement || !eventType.announcement.onStart)
    return;

  const announcementChannels = Array.isArray(eventType.announcement.channel)
    ? eventType.announcement.channel
    : eventType.announcement.channel
    ? [eventType.announcement.channel]
    : [];

  for (const channelId of announcementChannels) {
    const announcementChannel = await resolveChannelString(channelId);
    if (
      !announcementChannel ||
      announcementChannel.type !== ChannelType.GuildText
    )
      continue;

    const monkeyEvent = await deseralizePreviewEmbed(
      thread,
      configuration.discordClient
    );
    var idString = `Event ID: ${monkeyEvent.id}`;

    announcementChannel.send({
      content: (await getAttendeeTags(thread)) ?? "",
      embeds: [
        new EmbedBuilder({
          title: "Event Reminder",
          description: `The event "${
            monkeyEvent.name
          }" hosted by ${monkeyEvent.author.toString()} is starting now!\nEvent link: ${
            event.url
          }`,
          footer: {
            text: idString,
          },
        }),
      ],
    });
  }
}

async function performAnnouncements() {
  if (!configuration.discordClient) return;

  for (const guild of configuration.discordClient.guilds.cache.values()) {
    for (const event of guild.scheduledEvents.cache.values()) {
      if (!event.description || !event.scheduledStartAt) continue;

      const thread = getThreadFromEventDescription(event.description);
      if (!thread) continue;

      const eventType = configuration.eventTypes.find(
        (x) =>
          x.channel === thread.parent?.id || x.channel === thread.parent?.name
      );
      if (
        !eventType ||
        !eventType.announcement ||
        !eventType.announcement.beforeStart
      )
        continue;

      const timeBeforeStart = event.scheduledStartAt.valueOf() - Date.now();
      if (
        timeBeforeStart < 0 ||
        timeBeforeStart > eventType.announcement.beforeStart
      )
        continue;

      const announcementChannels = Array.isArray(eventType.announcement.channel)
        ? eventType.announcement.channel
        : eventType.announcement.channel
        ? [eventType.announcement.channel]
        : [];
      const monkeyEvent = await deseralizePreviewEmbed(
        thread,
        configuration.discordClient
      );

      var idString = `Event ID: ${monkeyEvent.id}`;
      for (const channelId of announcementChannels) {
        const announcementChannel =
          await configuration.discordClient.channels.fetch(channelId);
        if (
          !announcementChannel ||
          announcementChannel.type != ChannelType.GuildText
        ) {
          throw new Error(
            `Unable to get announcement channel from supplied ID ${channelId}, or the channel is not a Text channel. Please check your configuration.`
          );
        }

        const existingAnnouncement = (
          await announcementChannel.messages.fetch()
        ).find((x) =>
          x.embeds.find(
            (x) => x.footer?.text === idString && x.title === "Event Reminder"
          )
        );

        if (!existingAnnouncement) {
          announcementChannel.send({
            content: (await getAttendeeTags(thread)) ?? "",
            embeds: [
              new EmbedBuilder({
                title: "Event Reminder",
                description: `The event "${
                  monkeyEvent.name
                }" hosted by ${monkeyEvent.author.toString()} will be starting in ${Math.round(
                  timeBeforeStart / minutes(1)
                )} minutes!\nEvent link: ${event.url}`,
                footer: {
                  text: idString,
                },
              }),
            ],
          });
        }
      }
    }
  }
}

async function eventWasCompletedOrCancelled(
  oldEvent: GuildScheduledEvent | null,
  event: GuildScheduledEvent
) {
  if (!event.guild) return;

  if (
    (event.status === GuildScheduledEventStatus.Completed ||
      event.status === GuildScheduledEventStatus.Canceled) &&
    event.description
  ) {
    const thread = getThreadFromEventDescription(event.description);
    if (thread && !thread.archived) {
      const eventMonkeyEvent = await deseralizePreviewEmbed(
        thread,
        event.client
      );
      if (eventMonkeyEvent.recurrence) {
        const nextStartDate = getNextRecurrence(eventMonkeyEvent.recurrence);
        eventMonkeyEvent.scheduledStartTime = nextStartDate;
        eventMonkeyEvent.scheduledEndTime = new Date(nextStartDate);
        eventMonkeyEvent.scheduledEndTime.setHours(
          eventMonkeyEvent.scheduledEndTime.getHours() +
            eventMonkeyEvent.duration
        );
        eventMonkeyEvent.recurrence.timesHeld++;
        eventMonkeyEvent.scheduledEvent = undefined;
        eventMonkeyEvent.scheduledEvent = await createGuildScheduledEvent(
          eventMonkeyEvent,
          event.guild,
          thread.url
        );

        await createForumChannelEvent(
          eventMonkeyEvent,
          event.guild,
          event.client
        );
        await thread.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("Event is over")
              .setDescription(
                `We'll see you next time at ${getTimeString(nextStartDate)}!`
              ),
          ],
        });
      } else {
        thread.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("Event is over")
              .setDescription(
                `This event has been ended. The thread will be locked and archived after ${
                  (configuration.closeThreadsAfter ?? days(1)) / hours(1)
                } hours of inactivity.`
              ),
          ],
        });
        await closeEventThread(thread, event);
      }
    }
  }
}

async function userShowedInterest(
  guildScheduledEvent: GuildScheduledEvent<GuildScheduledEventStatus>,
  user: User
) {
  if (!guildScheduledEvent.description) return;

  const thread = getThreadFromEventDescription(guildScheduledEvent.description);

  if (!thread) return;

  await user.send({
    content: `Hi ${user.username}, I noticed you showed interest in ${guildScheduledEvent.name}!\nIf you'd like to signal you're attending, please visit the discussion thread at ${thread.url} and click the "Attending" button! You can always update your RSVP status if you change your mind!`,
  });
}

function getThreadFromEventDescription(
  eventDescription: string
): ThreadChannel | undefined {
  const guildAndThread = eventDescription.match(
    /(?<=Discussion: <#)(?<threadId>\d+)(?=>$)/im
  );
  if (guildAndThread && guildAndThread.groups) {
    const threadId = guildAndThread.groups.threadId;
    const thread = configuration.discordClient?.channels.cache.get(threadId);
    if (thread && thread.type === ChannelType.PublicThread) {
      return thread;
    }
  }

  return undefined;
}

function clearEventsUnderConstruction() {
  const clearList: string[] = [];
  const now = new Date().valueOf();

  for (const userId in eventsUnderConstruction) {
    const eventTimestamp = eventsUnderConstruction[userId][0];
    if (Math.abs(now - eventTimestamp.valueOf()) >= hours(2)) {
      clearList.push(userId);
    }
  }

  for (const userId of clearList) {
    delete eventsUnderConstruction[userId];
  }
}

export function getDefaultConfiguration(): EventMonkeyConfiguration {
  return {
    commandName: "event",
    eventTypes: [],
    editingTimeout: minutes(30),
  };
}

export async function registerEventCommand(botToken: string) {
  const client = configuration.discordClient;
  const rest = new REST({ version: "10" }).setToken(botToken);

  if (client) {
    await rest.put(Routes.applicationCommands(client.user?.id ?? ""), {
      body: [eventCommand.builder().toJSON()],
    });

    client.on(Events.InteractionCreate, (interaction: Interaction) => {
      if (
        (interaction.type === InteractionType.ApplicationCommand ||
          interaction.type ===
            InteractionType.ApplicationCommandAutocomplete) &&
        interaction.commandName === configuration.commandName
      )
        eventCommand.execute(interaction as ChatInputCommandInteraction);
    });
  }
}

export async function listenForButtons() {
  for (const eventType of configuration.eventTypes) {
    const channel = await resolveChannelString(eventType.channel);
    if (
      channel &&
      (channel.type === ChannelType.GuildForum ||
        channel.type === ChannelType.GuildText)
    ) {
      listenForButtonsInChannel(channel);
    } else {
      throw new Error(
        `Channel ${eventType.channel} coul does not exist or is not a forum channel.`
      );
    }
  }
}

export const eventCommand = {
  builder: () => {
    const builder = new SlashCommandBuilder()
      .setName(configuration.commandName)
      .setDescription("Create an event");

    if (configuration.eventTypes.length > 1) {
      builder.addStringOption((option) => {
        option.setName("type").setDescription("The type of event to schedule");
        option.addChoices(
          ...configuration.eventTypes.map((eventType) => {
            return { name: eventType.name, value: eventType.channel };
          })
        );
        option.setRequired(true);
        return option;
      });
    }

    builder.addStringOption((option) => {
      option
        .setName("location")
        .setDescription("The type of location the event will be at");
      option.addChoices(
        ...[
          {
            name: "External",
            value: GuildScheduledEventEntityType.External.toString(),
            entityType: GuildScheduledEventEntityType.External,
          },
          {
            name: "Voice",
            value: GuildScheduledEventEntityType.Voice.toString(),
            entityType: GuildScheduledEventEntityType.Voice,
          },
          {
            name: "Stage",
            value: GuildScheduledEventEntityType.StageInstance.toString(),
            entityType: GuildScheduledEventEntityType.StageInstance,
          },
        ].filter(
          (x) =>
            !configuration.allowedEntityTypes ||
            configuration.allowedEntityTypes.includes(x.entityType)
        )
      );
      option.setRequired(true);
      return option;
    });

    return builder;
  },
  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild || !interaction.channel) return;
    if (!interaction.member?.roles || !interaction.memberPermissions) {
      interaction.reply({
        content: "This command can only be used in a channel.",
        ephemeral: true,
      });
      return;
    }

    if (!checkRolePermissions(interaction)) {
      return;
    }

    const forumChannelId = interaction.options.getString("type") ?? "";
    const entityType = Number(
      interaction.options.getString("location")
    ) as GuildScheduledEventEntityType;
    const defaultStartTime = new Date();
    defaultStartTime.setDate(defaultStartTime.getDate() + 1);
    const defaultDuration = 1;

    var newEvent: EventMonkeyEvent =
      interaction.user.id in eventsUnderConstruction
        ? eventsUnderConstruction[interaction.user.id][1]
        : {
            name: "New Meetup",
            description: "Your meetup description",
            image: "",
            scheduledStartTime: defaultStartTime,
            duration: defaultDuration,
            entityMetadata: {
              location:
                entityType === GuildScheduledEventEntityType.External
                  ? "Meetup Location"
                  : "Channel Name",
            },
            privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
            id: crypto.randomUUID(),
            forumChannelId,
            author: interaction.user,
            entityType,
          };

    newEvent.entityType = entityType;
    eventsUnderConstruction[interaction.user.id] = [new Date(), newEvent];

    await showEventModal(newEvent, interaction);
  },
};

export const editEventCommand = {
  builder: () =>
    new SlashCommandBuilder()
      .setName(`${configuration.commandName}-edit`)
      .setDescription("Edit an event")
      .addChannelOption((option) =>
        option
          .setName("thread")
          .setRequired(true)
          .setDescription("The thread for the event you want to edit.")
          .addChannelTypes(ChannelType.PublicThread, ChannelType.PrivateThread)
      ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild || !interaction.channel) return;
    const channel = interaction.options.getChannel("thread") as ThreadChannel;
    if (!checkRolePermissions(interaction)) {
      return;
    }

    const event = await deseralizePreviewEmbed(
      channel,
      configuration.discordClient as Client
    );

    if (event.author.id !== interaction.user.id) {
      interaction.reply({
        content: "Sorry, you can only edit events that you created!",
        ephemeral: true,
      });

      return;
    }

    if (
      event.threadChannel &&
      event.scheduledStartTime.valueOf() < new Date().valueOf()
    ) {
      interaction.reply({
        content: "You can't edit an event that is in the past.",
        ephemeral: true,
      });

      return;
    }

    if (event.threadChannel && event.threadChannel.archived) {
      interaction.reply({
        content: "You can't edit an event that has been cancelled.",
        ephemeral: true,
      });

      return;
    }

    await showEventModal(event, interaction);
  },
};

export async function showEventModal(
  event: EventMonkeyEvent,
  interactionToReply: ChatInputCommandInteraction | ButtonInteraction
) {
  const modal = eventEditModal(event);

  await interactionToReply.showModal(modal);
  const modalSubmission = await interactionToReply.awaitModalSubmit({
    time: configuration.editingTimeout,
    filter: (submitInteraction, collected) => {
      if (
        submitInteraction.user.id === interactionToReply.user.id &&
        submitInteraction.customId === event.id
      ) {
        return true;
      }

      return false;
    },
  });

  const deserializationConfig: ModalDeserializationConfig = {
    validators: {
      scheduledStartTime: (fieldValue: string) =>
        /\d\d?\/\d\d?\/\d{2,4}\s+\d\d?:\d\d\s+(am|pm)/i.test(fieldValue)
          ? undefined
          : "Invalid date format.",
      duration: (fieldValue: string) =>
        isNaN(Number(fieldValue)) ? "Invalid duration" : undefined,
    },
    customDeserializers: {
      scheduledStartTime: (fieldValue: string) =>
        new Date(Date.parse(fieldValue)),
      duration: (fieldValue: string) => Number(fieldValue),
      recurrence: deserializeRecurrence,
    },
  };

  try {
    deserializeModalFields<EventMonkeyEvent>(
      modalSubmission.fields.fields.entries(),
      event,
      deserializationConfig
    );
  } catch (error: any) {
    await modalSubmission.reply({
      content: error.toString(),
      ephemeral: true,
    });

    eventsUnderConstruction[modalSubmission.user.id] = [new Date(), event];
    return;
  }

  if (event.entityType !== GuildScheduledEventEntityType.External) {
    let matchingChannel = modalSubmission.guild?.channels.cache.find(
      (x) =>
        x.name.toLowerCase() === event.entityMetadata.location.toLowerCase()
    );
    if (!matchingChannel) {
      await modalSubmission.reply({
        content: `Couldn't find a channel named "${event.entityMetadata.location}".`,
        ephemeral: true,
      });

      eventsUnderConstruction[modalSubmission.user.id] = [new Date(), event];
      return;
    }
    if (
      matchingChannel.type !== ChannelType.GuildVoice &&
      matchingChannel.type !== ChannelType.GuildStageVoice
    ) {
      await modalSubmission.reply({
        content: `The channel must be a Voice or Stage channel.`,
        ephemeral: true,
      });

      eventsUnderConstruction[modalSubmission.user.id] = [new Date(), event];
      return;
    }

    event.channel = matchingChannel;
    event.entityMetadata.location = matchingChannel.url;
  }

  let submissionEmbed = createSubmissionEmbed(
    event,
    "",
    configuration.discordClient?.user?.id ?? ""
  );
  await modalSubmission.reply(submissionEmbed);
  event.submissionCollector?.stop();
  event.submissionCollector = undefined;
  event.submissionCollector = getEmbedSubmissionCollector(
    event,
    modalSubmission
  );
}

export async function listenForButtonsInChannel(
  channel: ForumChannel | TextChannel
) {
  for (const thread of channel.threads.cache.values()) {
    if (!thread.archived) await listenForButtonsInThread(thread);
  }
}

export async function listenForButtonsInThread(thread: ThreadChannel) {
  const collector = thread.createMessageComponentCollector({
    filter: (submissionInteraction) =>
      (configuration.discordClient?.user &&
        submissionInteraction.customId.startsWith(
          configuration.discordClient.user.id
        )) == true,
  }) as InteractionCollector<ButtonInteraction>;

  collector.on("collect", (interaction: ButtonInteraction) => {
    const buttonId = interaction.customId.match(/(?<=_button_).*$/i)?.[0];
    if (!buttonId) throw new Error("Unable to get button ID from customId");

    const handler = buttonHandlers[buttonId];
    if (!handler) throw new Error(`No handler for button ID ${buttonId}`);

    handler(interaction);
  });
}

export function getEmbedSubmissionCollector(
  event: EventMonkeyEvent,
  modalSubmission: ModalSubmitInteraction
): InteractionCollector<ButtonInteraction> {
  if (!modalSubmission.channel)
    throw new Error("This command needs to be triggered in a channel.");

  if (event.submissionCollector) return event.submissionCollector;

  const submissionCollector =
    modalSubmission.channel.createMessageComponentCollector({
      filter: (submissionInteraction) =>
        submissionInteraction.user.id === modalSubmission.user.id &&
        submissionInteraction.customId.startsWith(
          configuration.discordClient?.user?.id ?? ""
        ),
      time: configuration.editingTimeout,
    }) as InteractionCollector<ButtonInteraction>;

  submissionCollector.on(
    "collect",
    async (submissionInteraction: ButtonInteraction) => {
      const handlerName = submissionInteraction.customId.replace(
        `${configuration.discordClient?.user?.id}_${event.id}_button_`,
        ""
      );
      const handler = eventCreationButtonHandlers[handlerName];
      if (handler) {
        if (!configuration.discordClient || !configuration.discordClient.user) {
          throw new Error("Client not set or not connected.");
        }

        await handler(
          event,
          submissionInteraction,
          modalSubmission,
          configuration.discordClient
        );
      }
    }
  );

  submissionCollector.on("end", (collected, reason) => {
    if (reason === "time") {
      modalSubmission.editReply({
        content:
          "Sorry, your event editing timed out! You can continue from where you left off when ready.",
        embeds: [],
        components: [],
      });
    }
  });

  return submissionCollector;
}

function checkRolePermissions(
  interaction: ChatInputCommandInteraction
): boolean {
  if (!interaction.member) return false;

  let allowed = configuration.roleIds?.allowed == null;
  const memberPermissions = interaction.memberPermissions;
  if (memberPermissions && memberPermissions.has("Administrator")) {
    return true;
  }

  if (memberPermissions) {
    const userRoles = interaction.member.roles as GuildMemberRoleManager;
    if (configuration.roleIds?.allowed) {
      for (const roleId of configuration.roleIds.allowed) {
        if (userRoles.cache.has(roleId)) {
          allowed = true;
          break;
        }
      }
    }

    if (configuration.roleIds?.denied) {
      for (const roleId of configuration.roleIds.denied) {
        if (userRoles.cache.has(roleId)) {
          allowed = false;
          break;
        }
      }
    }
  }

  if (!allowed) {
    interaction.reply({
      content:
        "Sorry, but you do not have permissions to create or edit events.",
      ephemeral: true,
    });
  }

  return allowed;
}

export async function resolveChannelString(text: string): Promise<Channel> {
  if (text.match(/^\d+$/)) {
    const channel = await configuration.discordClient?.channels.fetch(text);
    if (channel) return channel;
  }

  const channel = await configuration.discordClient?.channels.cache.find(
    (x) =>
      (x.type === ChannelType.GuildText || x.type === ChannelType.GuildForum) &&
      x.name === text
  );
  if (channel) return channel;

  throw new Error(`Unable to resolve channel from string "${text}"`);
}
