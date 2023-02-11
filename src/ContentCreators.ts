import {
  ActionRowBuilder,
  AnyComponentBuilder,
  APIEmbedField,
  ButtonBuilder,
  ButtonStyle,
  ComponentBuilder,
  EmbedBuilder,
  GuildScheduledEventEntityType,
  MessageActionRowComponentBuilder,
  MessageActionRowComponentData,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { EventMonkeyEvent } from "./EventMonkeyEvent";
import {
  getTimeString,
  ModalSerializationConfig,
  serializeToModal,
} from "./Serialization";
import {
  deserialize as deserializeRecurrence,
  getRecurrenceUnit,
  serializeFrequency,
} from "./Recurrence";

export function createSubmissionEmbed(
  event: EventMonkeyEvent,
  content: string,
  clientId: string
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
  ephemeral: boolean;
  fetchReply: boolean;
  content: string;
} {
  const submissionEmbed = new EmbedBuilder().setTitle("Creating an event...");
  const prefix = `${clientId}_${event.id}_button`;
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setLabel("Edit")
      .setCustomId(`${prefix}_edit`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel("Make Recurring")
      .setCustomId(`${prefix}_makeRecurring`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel(event.image === "" ? "Add An Image" : "Change Image")
      .setCustomId(`${prefix}_addImage`)
      .setStyle(ButtonStyle.Secondary),
  ]);

  return {
    embeds: [submissionEmbed, createPreviewEmbed(event)],
    components: [
      buttonRow,
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Save For Later")
          .setCustomId(`${prefix}_save`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setLabel("Finish")
          .setCustomId(`${prefix}_finish`)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setLabel("Cancel")
          .setCustomId(`${prefix}_cancel`)
          .setStyle(ButtonStyle.Danger)
      ),
    ],
    ephemeral: true,
    fetchReply: true,
    content,
  };
}

export function createPreviewEmbed(event: EventMonkeyEvent): EmbedBuilder {
  const previewEmbed = new EmbedBuilder().setTitle(
    `${event.scheduledStartTime
      .toLocaleString()
      .replace(/(?<=\d?\d:\d\d):\d\d/, " ")} - ${event.name}`
  );
  if (event.image !== "") {
    previewEmbed.setThumbnail(event.image);
  }
  previewEmbed.setDescription(event.description);
  const fields: APIEmbedField[] = [];
  fields.push({
    name:
      event.entityType === GuildScheduledEventEntityType.External
        ? "Location"
        : "Channel",
    value: event.entityMetadata.location,
    inline: true,
  });
  fields.push({
    name: "Duration",
    value: `${event.duration} hour${event.duration > 1 ? "s" : ""}`,
    inline: true,
  });

  if (event.recurrence) {
    fields.push({
      name: "Event Frequency",
      value: serializeFrequency(event.recurrence),
    });
  }
  fields.push({ name: "Event ID", value: event.id });
  previewEmbed.addFields(fields);
  previewEmbed.setAuthor({
    name: `${event.author.username} (${event.author.id})`,
    iconURL: event.author.avatarURL() ?? "",
  });

  return previewEmbed;
}

export function createAttendeesEmbed(event: EventMonkeyEvent): EmbedBuilder {
  const attendeesEmbed = new EmbedBuilder();
  attendeesEmbed.addFields([
    {
      name: "Attending",
      value: `${event.author.username} (${event.author.id})`,
    },
  ]);
  return attendeesEmbed;
}

export function eventEditModal(event: EventMonkeyEvent) {
  const modal = new ModalBuilder();
  modal.setTitle("Create a New Meetup");
  modal.setCustomId(event.id);

  const serializationObject = {
    name: event.name,
    description: event.description,
    "entityMetadata.location": event.entityMetadata.location,
    scheduledStartTime: event.scheduledStartTime,
    duration: event.duration,
  };
  const serializationConfig: ModalSerializationConfig = {
    labels: {
      "entityMetadata.location":
        event.entityType === GuildScheduledEventEntityType.External
          ? "Location"
          : "Channel",
      scheduledStartTime: "Scheduled Start Time",
    },
    formatters: {
      scheduledStartTime: getTimeString,
    },
    styles: {
      description: TextInputStyle.Paragraph,
    },
  };
  modal.addComponents(
    serializeToModal(`${event.id}_`, serializationObject, serializationConfig)
  );

  return modal;
}

export function recurrenceModal(event: EventMonkeyEvent) {
  if (!event.recurrence)
    throw new Error("Unable to show modal for nonexistent recurrence.");

  const modal = new ModalBuilder();
  modal.setTitle("Recurring Event");
  modal.setCustomId(event.id);

  let unit = getRecurrenceUnit(event.recurrence);
  if (!unit) throw new Error("Unable to get unit from EventRecurrence.");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId(`${event.id}_frequency`)
        .setLabel("Time before next recurrence")
        .setStyle(TextInputStyle.Short)
        .setValue("1")
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId(`${event.id}_unit`)
        .setLabel("Hours, days, weeks, or months")
        .setStyle(TextInputStyle.Short)
        .setValue(unit)
    )
  );

  return modal;
}

export function createAttendanceButtons(
  event: EventMonkeyEvent,
  clientId: string
): ActionRowBuilder<ButtonBuilder> {
  const buttonRow = new ActionRowBuilder<ButtonBuilder>();
  buttonRow.addComponents([
    new ButtonBuilder()
      .setLabel("Attending")
      .setStyle(ButtonStyle.Success)
      .setCustomId(`${clientId}_${event.id}_button_attending`),
    new ButtonBuilder()
      .setLabel("Not Attending")
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`${clientId}_${event.id}_button_notAttending`),
  ]);
  return buttonRow;
}
