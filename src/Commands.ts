import {
  ChannelType,
  ChatInputCommandInteraction,
  GuildMemberRoleManager,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  ThreadChannel,
} from "discord.js";
import { v4 as uuidv4 } from "uuid";
import Configuration from "./Configuration";
import editEventMessage from "./Content/Embed/editEventMessage";
import { deseralizeEventEmbed } from "./Content/Embed/eventEmbed";
import { EventMonkeyEvent } from "./EventMonkey";
import EventsUnderConstruction from "./EventsUnderConstruction";
import Listeners from "./Listeners";
import { resolveChannelString } from "./Utility/resolveChannelString";

export const eventCommand = {
  builder: getEventCommandBuilder,
  execute: executeEventCommand,
};

function getEventCommandBuilder() {
  const builder = new SlashCommandBuilder()
    .setName(Configuration.current.commandName)
    .setDescription("Create an event");

  const createSubCommand = new SlashCommandSubcommandBuilder()
    .setName("create")
    .setDescription("Create a new event");
  if (Configuration.current.eventTypes.length > 1) {
    createSubCommand.addStringOption((option) => {
      option.setName("type").setDescription("The type of event to schedule");
      option.addChoices(
        ...Configuration.current.eventTypes.map((eventType) => {
          return { name: eventType.name, value: eventType.name };
        })
      );
      option.setRequired(true);
      return option;
    });
  }

  const editSubCommand = new SlashCommandSubcommandBuilder()
    .setName("edit")
    .setDescription("Edit an existing event");
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
  if (
    !interaction.guild ||
    !interaction.channel ||
    !("createMessageComponentCollector" in interaction.channel)
  )
    return;
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

  if (interaction.options.getSubcommand() === "edit") {
    await executeEditCommand(interaction);
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const eventTypeName =
    interaction.options.getString("type") ??
    Configuration.current.eventTypes[0].name;
  const eventType = Configuration.current.eventTypes.find(
    (x) => x.name === eventTypeName
  );
  if (!eventType) throw new Error();

  const entityType = eventType.voiceChannel
    ? GuildScheduledEventEntityType.Voice
    : eventType.stageChannel
    ? GuildScheduledEventEntityType.StageInstance
    : GuildScheduledEventEntityType.External;
  const voiceOrForumChannel =
    entityType === GuildScheduledEventEntityType.External
      ? undefined
      : await resolveChannelString(
          (entityType === GuildScheduledEventEntityType.Voice
            ? eventType.voiceChannel
            : eventType.stageChannel) as string,
          interaction.guild
        );
  const discussionChannelId = (
    await resolveChannelString(eventType.discussionChannel, interaction.guild)
  ).id;
  const defaultStartTime = new Date();
  defaultStartTime.setHours(
    defaultStartTime.getHours() + Configuration.current.timeZone.offset
  );
  defaultStartTime.setDate(defaultStartTime.getDate() + 1);
  const defaultDuration = 1;

  const newEvent: EventMonkeyEvent = EventsUnderConstruction.getEvent(
    interaction.user.id
  ) ?? {
    name: "New Meetup",
    description: "Your meetup description",
    image: "",
    scheduledStartTime: defaultStartTime,
    duration: defaultDuration,
    entityMetadata: {
      location:
        entityType === GuildScheduledEventEntityType.External
          ? "Meetup Location"
          : voiceOrForumChannel?.id ?? "",
    },
    privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    id: uuidv4(),
    discussionChannelId,
    author: interaction.user,
    entityType,
    attendees: [],
  };

  newEvent.entityType = entityType;
  EventsUnderConstruction.saveEvent(newEvent);
  var newEventMessage = await editEventMessage(newEvent, "", interaction);
  await interaction.editReply(newEventMessage);
  const replyMessage = await interaction.fetchReply();
  newEvent.submissionCollector = Listeners.getEmbedSubmissionCollector(
    newEvent,
    interaction
  );
}

async function executeEditCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.channel) return;
  const channel = interaction.options.getChannel("thread") as ThreadChannel;
  if (!checkRolePermissions(interaction)) {
    return;
  }

  const event = await deseralizeEventEmbed(channel, channel.client);

  if (event.author.id !== interaction.user.id) {
    interaction.reply({
      content: "Sorry, you can only edit events that you created!",
      ephemeral: true,
    });

    return;
  }

  if (event.threadChannel && event.scheduledStartTime.valueOf() < Date.now()) {
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

  const submissionMessage = await editEventMessage(
    event,
    "Editing your existing event...",
    interaction
  );
  await interaction.reply({
    ...submissionMessage,
    flags: MessageFlags.Ephemeral,
  });
  const message = await interaction.fetchReply();
  event.submissionCollector = Listeners.getEmbedSubmissionCollector(
    event,
    interaction
  );
}

function checkRolePermissions(
  interaction: ChatInputCommandInteraction
): boolean {
  if (!interaction.member) return false;

  const configuration = Configuration.current;
  let allowed = configuration.roles?.allowed == null;
  const memberPermissions = interaction.memberPermissions;
  if (
    memberPermissions &&
    memberPermissions.has(PermissionsBitField.Flags.Administrator)
  ) {
    return true;
  }

  if (memberPermissions) {
    const userRoles = interaction.member.roles as GuildMemberRoleManager;
    if (configuration.roles?.allowed) {
      for (const role of configuration.roles.allowed) {
        if (
          userRoles.cache.find(
            (value, key) => key === role || value.name === role
          )
        ) {
          allowed = true;
          break;
        }
      }
    }

    if (configuration.roles?.denied) {
      for (const role of configuration.roles.denied) {
        if (
          userRoles.cache.find(
            (value, key) => key === role || value.name === role
          )
        ) {
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
