import {
  ButtonInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Events,
  ForumChannel,
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
  ThreadChannel,
  User,
  VoiceBasedChannel,
} from "discord.js";

import { createSubmissionEmbed, eventEditModal } from "./ContentCreators";
import buttonHandlers from "./EventButtonHandlers";
import eventCreationButtonHandlers from "./EventCreationButtonHandlers";
import { sortEventThreads } from "./EventCreators";
import {
  deseralizePreviewEmbed,
  deserializeModalFields,
  ModalDeserializationConfig,
} from "./Serialization";
import { hours, minutes } from "./TimeConversion";

export interface EventMonkeyEvent {
  author: User;
  name: string;
  description: string;
  image: string;
  entityMetadata: { location: string };
  channel?: VoiceBasedChannel;
  scheduledStartTime: Date;
  scheduledEndTime?: Date;
  duration: number;
  privacyLevel: GuildScheduledEventPrivacyLevel;
  id: string;
  submissionCollector?: InteractionCollector<ButtonInteraction>;
  forumChannelId: string;
  entityType: GuildScheduledEventEntityType;
  threadChannel?: ThreadChannel;
  scheduledEvent?: GuildScheduledEvent;
}

export interface EventConfiguration {
  commandName: string;
  discordClient?: Client;
  eventTypes: EventTypeInformation[];
  editingTimeoutInMinutes: number;
}

interface UserEventMap {
  [userId: string]: [Date, EventMonkeyEvent];
}

type EventTypeInformation = {
  name: string;
  channelId: string;
};

let configuration: EventConfiguration;

const eventsInProgress: UserEventMap = {};

export function saveEvent(event: EventMonkeyEvent) {
  eventsInProgress[event.author.id] = [new Date(), event];
}

export function deleteEvent(userId: string) {
  delete eventsInProgress[userId];
}

export function configure(newConfiguration: EventConfiguration) {
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
        if (thread) closeEventThread(thread, "This event has been cancelled!");
      }
    );

    client.on("guildScheduledEventUserAdd", userShowedInterest);

    client.on("guildScheduledEventUpdate", async (oldEvent, newEvent) => {
      if (
        (newEvent.status === GuildScheduledEventStatus.Completed ||
          newEvent.status === GuildScheduledEventStatus.Canceled) &&
        newEvent.description
      ) {
        eventWasCompletedOrCancelled(newEvent);
      }
    });

    for (const eventChannel of configuration.eventTypes) {
      const channel = configuration.discordClient?.channels.cache.get(
        eventChannel.channelId
      );

      if (channel?.type === ChannelType.GuildForum) {
        sortEventThreads(channel);
      }
    }
  }
}

async function eventWasCompletedOrCancelled(event: GuildScheduledEvent) {
  if (
    (event.status === GuildScheduledEventStatus.Completed ||
      event.status === GuildScheduledEventStatus.Canceled) &&
    event.description
  ) {
    const thread = getThreadFromEventDescription(event.description);
    if (thread) {
      await closeEventThread(
        thread,
        event.status === GuildScheduledEventStatus.Completed
          ? "This event is over!"
          : "This event has been cancelled!"
      );
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
    /(?<=Discussion: https:\/\/discord.com\/channels\/)(?<guildId>\d+)\/(?<threadId>\d+)$/im
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

export async function closeEventThread(thread: ThreadChannel, reason: string) {
  if (thread.archived) return;

  const pinnedMessage = (await thread.messages.fetchPinned()).at(0);
  if (pinnedMessage) {
    await pinnedMessage.edit({ components: [] });
  }

  await (
    await thread.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(reason)
          .setDescription("Thread has been locked and archived.")
          .setColor("DarkRed"),
      ],
    })
  ).pin();

  await thread.setLocked(true);
  await thread.setArchived(true);
}

setInterval(clearEventsInProgress, hours(1));

function clearEventsInProgress() {
  const clearList: string[] = [];
  const now = new Date().valueOf();

  for (const userId in eventsInProgress) {
    const eventTimestamp = eventsInProgress[userId][0];
    if (Math.abs(now - eventTimestamp.valueOf()) >= hours(2)) {
      clearList.push(userId);
    }
  }

  for (const userId of clearList) {
    delete eventsInProgress[userId];
  }
}

export function getDefaultConfiguration(): EventConfiguration {
  return {
    commandName: "event",
    eventTypes: [],
    editingTimeoutInMinutes: 30,
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

export function listenForButtons() {
  for (const eventType of configuration.eventTypes) {
    const channel = configuration.discordClient?.channels.cache.get(
      eventType.channelId
    );
    if (channel && channel.type === ChannelType.GuildForum) {
      listenForButtonsInChannel(channel);
    } else {
      throw new Error(
        `Channel with ID ${eventType.channelId} does not exist or is not a forum channel.`
      );
    }
  }
}

export const eventCommand = {
  builder: () =>
    new SlashCommandBuilder()
      .setName(configuration.commandName)
      .setDescription("Create or edit an event")
      .addStringOption((option) => {
        option.setName("type").setDescription("The type of event to schedule");
        option.addChoices(
          ...configuration.eventTypes.map((eventType) => {
            return { name: eventType.name, value: eventType.channelId };
          })
        );
        option.setRequired(true);
        return option;
      })
      .addStringOption((option) => {
        option
          .setName("location")
          .setDescription("The type of location the event will be at");
        option.addChoices(
          {
            name: "External",
            value: GuildScheduledEventEntityType.External.toString(),
          },
          {
            name: "Voice",
            value: GuildScheduledEventEntityType.Voice.toString(),
          },
          {
            name: "Stage",
            value: GuildScheduledEventEntityType.StageInstance.toString(),
          }
        );
        option.setRequired(true);
        return option;
      }),
  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild || !interaction.channel) return;

    const forumChannelId = interaction.options.getString("type") ?? "";
    const entityType = Number(
      interaction.options.getString("location")
    ) as GuildScheduledEventEntityType;
    const defaultStartTime = new Date();
    defaultStartTime.setDate(defaultStartTime.getDate() + 1);
    const defaultDuration = 1;

    var newEvent: EventMonkeyEvent =
      interaction.user.id in eventsInProgress
        ? eventsInProgress[interaction.user.id][1]
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
            id: interaction.id,
            forumChannelId,
            author: interaction.user,
            entityType,
          };

    newEvent.entityType = entityType;
    eventsInProgress[interaction.user.id] = [new Date(), newEvent];

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
    time: minutes(configuration.editingTimeoutInMinutes),
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
    },
  };

  try {
    deserializeModalFields<EventMonkeyEvent>(
      `${event.id}_`,
      modalSubmission.fields.fields.entries(),
      event,
      deserializationConfig
    );
  } catch (error: any) {
    await modalSubmission.reply({
      content: error.toString(),
      ephemeral: true,
    });

    eventsInProgress[modalSubmission.user.id] = [new Date(), event];
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

      eventsInProgress[modalSubmission.user.id] = [new Date(), event];
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

      eventsInProgress[modalSubmission.user.id] = [new Date(), event];
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

export async function listenForButtonsInChannel(channel: ForumChannel) {
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
      time: minutes(configuration.editingTimeoutInMinutes),
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
