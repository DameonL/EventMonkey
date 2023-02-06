import {
  ActionRowBuilder,
  APIEmbedField,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildScheduledEventEntityType,
  ModalBuilder,
  TextInputStyle,
} from "discord.js";
import { EventMonkeyEvent } from "./EventMonkeyEvent";
import {
  ModalSerializationConfig,
  serializeToModal,
} from "./Serialization";

export function createSubmissionEmbed(
  event: EventMonkeyEvent,
  content: string,
  clientId: string
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
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
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel(event.image === "" ? "Add An Image" : "Change Image")
      .setCustomId(`${prefix}_addImage`)
      .setStyle(ButtonStyle.Primary),
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
      .setStyle(ButtonStyle.Danger),
  ]);

  return {
    embeds: [submissionEmbed, createPreviewEmbed(event)],
    components: [buttonRow],
    ephemeral: true,
    fetchReply: true,
    content,
  };
}

export function createPreviewEmbed(
  event: EventMonkeyEvent
): EmbedBuilder {
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
  previewEmbed.addFields(fields);
  previewEmbed.setAuthor({
    name: `${event.author.username} (${event.author.id})`,
    iconURL: event.author.avatarURL() ?? "",
  });

  return previewEmbed;
}

export function createAttendeesEmbed(
  event: EventMonkeyEvent
): EmbedBuilder {
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
      scheduledStartTime: (startTime: any) =>
        startTime
          .toLocaleString("en-us", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
          .replace(",", "")
          .replace(" ", " "),
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

export function createAttendanceButtons(
  event: EventMonkeyEvent,
  clientId: string
): ActionRowBuilder<ButtonBuilder> {
  const buttonRow = new ActionRowBuilder<ButtonBuilder>();
  buttonRow.addComponents([
    new ButtonBuilder()
      .setLabel("Attending")
      .setStyle(ButtonStyle.Success)
      .setCustomId(
        `${clientId}_${event.id}_button_attending`
      ),
    new ButtonBuilder()
      .setLabel("Not Attending")
      .setStyle(ButtonStyle.Danger)
      .setCustomId(
        `${clientId}_${event.id}_button_notAttending`
      ),
  ]);
  return buttonRow;
}

