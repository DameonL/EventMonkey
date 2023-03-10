import {
  ActionRowBuilder,
  APISelectMenuOption,
  ChannelType,
  ChatInputCommandInteraction,
  ComponentType,
  GuildMemberRoleManager,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  MessageCreateOptions,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  StringSelectMenuBuilder,
  ThreadChannel,
} from "discord.js";
import { v4 as uuidv4 } from "uuid";
import eventCreationButtonHandlers, { EventCreationButtonHandlerResponse } from "./ButtonHandlers/EventCreationButtonHandlers";
import Configuration from "./Configuration";
import editEventMessage from "./Content/Embed/editEventMessage";
import { deseralizeEventEmbed } from "./Content/Embed/eventEmbed";
import { EventMonkeyEventType } from "./EventMonkeyConfiguration";
import { EventMonkeyEvent } from "./EventMonkeyEvent";
import EventsUnderConstruction from "./EventsUnderConstruction";
import Listeners from "./Listeners";
import logger from "./Logger";
import { getValidVoiceOrStageChannel } from "./Utility/getValidVoiceOrStageChannel";
import { resolveChannelString } from "./Utility/resolveChannelString";
import Time from "./Utility/Time";

export const eventCommand = {
  builder: getEventCommandBuilder,
  execute: executeEventCommand,
};

function getEventCommandBuilder() {
  const builder = new SlashCommandBuilder()
    .setName(Configuration.current.commandName)
    .setDescription("Create an event");

  const createSubCommand = new SlashCommandSubcommandBuilder().setName("create").setDescription("Create a new event");
  const editSubCommand = new SlashCommandSubcommandBuilder().setName("edit").setDescription("Edit an existing event");
  editSubCommand.addChannelOption((x) =>
    x
      .setName("thread")
      .setDescription("The name of the event thread")
      .addChannelTypes(ChannelType.PublicThread)
      .setRequired(true)
  );

  builder.addSubcommand(createSubCommand);
  builder.addSubcommand(editSubCommand);

  return builder;
}

async function executeEventCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.channel || !("createMessageComponentCollector" in interaction.channel)) return;
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.member?.roles || !interaction.memberPermissions) {
    interaction.editReply({
      content: "This command can only be used in a channel.",
    });
    return;
  }

  if (!checkRolePermissions(interaction)) {
    return;
  }

  if (interaction.options.getSubcommand() === "edit") {
    await executeEditCommand(interaction);
    return;
  }

  const defaultStartTime = new Date();
  defaultStartTime.setHours(defaultStartTime.getHours());
  defaultStartTime.setDate(defaultStartTime.getDate() + 1);
  const defaultEndTime = new Date(defaultStartTime);
  defaultEndTime.setHours(defaultEndTime.getHours() + 1);
  const selectMenuOptions: APISelectMenuOption[] = [];
  for (const eventType of Configuration.current.eventTypes) {
    const channel = await resolveChannelString(eventType.discussionChannel, interaction.guild);
    if (channel) {
      selectMenuOptions.push({ label: eventType.name, value: eventType.name, description: eventType.description });
    }
  }

  let eventType: EventMonkeyEventType | undefined;
  try {
    const eventTypeMessage = await interaction.editReply({
      content: "What kind of event do you want to create?",
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().setComponents([
          new StringSelectMenuBuilder().setCustomId(interaction.id).setOptions(selectMenuOptions),
        ]),
      ],
    });

    const eventTypeResponse = await eventTypeMessage.awaitMessageComponent<ComponentType.StringSelect>({
      filter: (x) => x.customId === interaction.id,
      time: Time.toMilliseconds.minutes(5),
    });
    await eventTypeResponse.deferUpdate();
    interaction.editReply({ content: "Working...", components: [] });

    eventType = Configuration.current.eventTypes.find(
      (x) => x.name === eventTypeResponse.values[0]
    ) as EventMonkeyEventType;
  } catch (error) {
    logger.error("", error);
    await interaction.editReply({ content: "Timed out! Come back when you're ready!", components: [] });
    return;
  }

  if (!eventType) throw new Error();

  let baseEvent: Omit<EventMonkeyEvent, "channel" | "entityMetadata"> = {
    name: "New Meetup",
    description: "Your meetup description",
    image: "",
    scheduledStartTime: defaultStartTime,
    scheduledEndTime: defaultEndTime,
    duration: 1,
    privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    id: uuidv4(),
    discussionChannelId: "",
    author: interaction.user,
    attendees: [],
    entityType: eventType.entityType,
    eventType,
  };

  const discussionChannel = await resolveChannelString(eventType.discussionChannel, interaction.guild);
  if (!discussionChannel) throw new Error("Tried to create an event but couldn't find the discussion channel.");

  baseEvent.discussionChannelId = discussionChannel.id;
  let newEvent: EventMonkeyEvent | undefined;
  if (eventType.entityType !== GuildScheduledEventEntityType.External) {
    const channel = await getValidVoiceOrStageChannel(baseEvent, eventType, interaction.guild);

    if (!channel) throw new Error();

    if (channel.type === ChannelType.GuildVoice && eventType.entityType === GuildScheduledEventEntityType.Voice) {
      newEvent = {
        ...baseEvent,
        channel,
        eventType,
        entityType: GuildScheduledEventEntityType.Voice,
      };
      EventsUnderConstruction.saveEvent(newEvent);
    }
  } else {
    newEvent = {
      ...baseEvent,
      entityMetadata: { location: "Event Location" },
      eventType,
      entityType: GuildScheduledEventEntityType.External,
    };
  }
  if (!newEvent) throw new Error();

  EventsUnderConstruction.saveEvent(newEvent);
  editEvent(newEvent, interaction)
}

async function executeEditCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.channel) return;
  const channel = interaction.options.getChannel("thread") as ThreadChannel;
  if (!checkRolePermissions(interaction)) {
    return;
  }

  let event: EventMonkeyEvent | undefined = undefined;
  try {
    event = await deseralizeEventEmbed(channel, channel.client);
  } catch (error) {
    interaction.editReply({
      content: "It doesn't look like that's an event thread.",
    });

    return;
  }
  if (!event) throw new Error();

  if (event.author.id !== interaction.user.id) {
    interaction.editReply({
      content: "Sorry, you can only edit events that you created!",
    });

    return;
  }

  if (event.threadChannel && event.scheduledStartTime.valueOf() < Date.now()) {
    interaction.editReply({
      content: "You can't edit an event that is in the past.",
    });

    return;
  }

  if (event.threadChannel && event.threadChannel.archived) {
    interaction.editReply({
      content: "You can't edit an event that has been cancelled.",
    });

    return;
  }

  const submissionMessage = await editEventMessage(event, "Editing your existing event...", interaction);
  await interaction.editReply({
    ...submissionMessage,
  });
  editEvent(event, interaction);
}

function checkRolePermissions(interaction: ChatInputCommandInteraction): boolean {
  if (!interaction.member) return false;

  const configuration = Configuration.current;
  let allowed = configuration.roles?.allowed == null;
  const memberPermissions = interaction.memberPermissions;
  if (memberPermissions && memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
    return true;
  }

  if (memberPermissions) {
    const userRoles = interaction.member.roles as GuildMemberRoleManager;
    if (configuration.roles?.allowed) {
      for (const role of configuration.roles.allowed) {
        if (userRoles.cache.find((value, key) => key === role || value.name === role)) {
          allowed = true;
          break;
        }
      }
    }

    if (configuration.roles?.denied) {
      for (const role of configuration.roles.denied) {
        if (userRoles.cache.find((value, key) => key === role || value.name === role)) {
          allowed = false;
          break;
        }
      }
    }
  }

  if (!allowed) {
    interaction.reply({
      content: "Sorry, but you do not have permissions to create or edit events.",
      ephemeral: true,
    });
  }

  return allowed;
}

async function editEvent(event: EventMonkeyEvent, interaction: ChatInputCommandInteraction) {
  const eventMessage = await editEventMessage(event, "", interaction);
  const editingMessage = await interaction.editReply(eventMessage);

  try {
    while (true) {
      const editingInteraction = await editingMessage.awaitMessageComponent<ComponentType.Button>({
        filter: (x) => x.user.id === interaction.user.id && x.customId.startsWith(`${interaction.id}_button_`),
        time: Time.toMilliseconds.minutes(5),
      });

      const handlerName = editingInteraction.customId.replace(`${interaction.id}_button_`, "");
      const handler = eventCreationButtonHandlers[handlerName];
      if (handler) {
        try {
          const response = await handler(event, editingInteraction, interaction);
          if (response === EventCreationButtonHandlerResponse.EndEditing) break;
        } catch (error) {
          logger.error(`Error while running event creation button handler "${handlerName}".`, error);
          await interaction.editReply("Sorry, but something went wrong! Rest assured, somebody will be punished.");
          return;
        }
      }
    }
  } catch (error) {
    interaction.editReply({
      content: "Sorry, editing timed out! You can continue editing later.",
      components: [],
      embeds: [],
    });
    return;
  }
}