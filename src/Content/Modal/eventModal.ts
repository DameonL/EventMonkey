import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  GuildScheduledEventEntityType,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputStyle,
} from "discord.js";
import Configuration from "../../Configuration";
import { EventMonkeyEvent } from "../../EventMonkey";
import { ExternalEvent, StageEvent, VoiceEvent } from "../../EventMonkeyEvent";
import EventsUnderConstruction from "../../EventsUnderConstruction";
import logger from "../../Logger";
import Time from "../../Utility/Time";
import editEventMessage from "../Embed/editEventMessage";
import {
  ModalDeserializationConfig,
  ModalSerializationConfig,
  deserializeModal,
  serializeToModal,
} from "./SerializedModal";

export async function eventModal(
  event: EventMonkeyEvent,
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  originalInteraction: ChatInputCommandInteraction,
  page = 0
) {
  if (!interaction.guildId) {
    return;
  }

  const modal = await eventEditModal(event, interaction.id, interaction.guildId, page);

  await interaction.showModal(modal);
  const configuration = await Configuration.getCurrent({ guildId: interaction.guildId });
  let modalSubmission: ModalSubmitInteraction;
  try {
    modalSubmission = await interaction.awaitModalSubmit({
      time: configuration.editingTimeout,
      filter: (submitInteraction, collected) => {
        if (submitInteraction.user.id === interaction.user.id && submitInteraction.customId === interaction.id) {
          return true;
        }

        return false;
      },
    });
  } catch (error) {
    return;
  }

  await modalSubmission.deferReply({ ephemeral: true });

  const startTime = event.scheduledStartTime;
  try {
    await deserializeModal<EventMonkeyEvent>(
      modalSubmission.fields.fields.entries(),
      interaction.guildId,
      event,
      pages[page].deserializeConfig
    );
  } catch (error: any) {
    logger.log(error.toString());
    await modalSubmission.editReply({
      content: error.toString(),
    });

    EventsUnderConstruction.saveEvent(event);
    return;
  }

  // If the scheduled time has changed, we need to update recurrence settings.
  if (event.recurrence && event.scheduledStartTime.valueOf() !== startTime.valueOf()) {
    event.recurrence.firstStartTime = event.scheduledStartTime;
    event.recurrence.timesHeld = 0;
  }

  let submissionEmbed = await editEventMessage(event, "Edited event.", originalInteraction);

  await originalInteraction.editReply(submissionEmbed);
  await modalSubmission.deleteReply();

  return event;
}

export async function eventEditModal(event: EventMonkeyEvent, id: string, guildId: string, page = 0) {
  const modal = new ModalBuilder();
  modal.setTitle("Edit Your Event");
  modal.setCustomId(id);

  const serializationObject: any = {
    name: event.name,
    description: event.description,
    scheduledStartTime: event.scheduledStartTime,
    duration: event.duration,
  };

  if (event.entityType === GuildScheduledEventEntityType.External) {
    serializationObject["entityMetadata.location"] = event.entityMetadata.location;
  }

  modal.addComponents(
    await serializeToModal(`${event.id}_`, pages[page].converter(event), guildId, pages[page].serializeConfig)
  );

  return modal;
}

interface EditModalPage {
  converter: (event: EventMonkeyEvent) => any;
  serializeConfig: ModalSerializationConfig;
  deserializeConfig: ModalDeserializationConfig;
}

const pages: EditModalPage[] = [
  {
    converter: (event: EventMonkeyEvent<VoiceEvent | StageEvent | ExternalEvent>) => {
      const converted: any = {
        name: event.name,
        description: event.description,
        scheduledStartTime: event.scheduledStartTime,
        duration: event.duration,
        "entityMetadata.location": "entityMetadata" in event ? event.entityMetadata.location : undefined,
      };

      return converted;
    },
    serializeConfig: {
      labels: {
        "entityMetadata.location": "Location",
        scheduledStartTime: "Scheduled Start Time",
      },
      formatters: {
        scheduledStartTime: Time.getTimeString,
      },
      styles: {
        description: TextInputStyle.Paragraph,
      },
    },
    deserializeConfig: {
      validators: {
        scheduledStartTime: (fieldValue: string) =>
          /\d\d?\/\d\d?\/\d{2,4}\s+\d\d?:\d\d\s+(am|pm)/i.test(fieldValue) ? undefined : "Invalid date format.",
        duration: (fieldValue: string) => (isNaN(Number(fieldValue)) ? "Invalid duration" : undefined),
        description: (fieldValue) =>
          fieldValue.length >= 1000 ? "Event description must be less than 1000 characters." : undefined,
      },
      customDeserializers: {
        scheduledStartTime: async (fieldValue, guildId) => {
          const output = await Time.getTimeFromString(fieldValue, guildId);

          return output;
        },
        duration: (fieldValue: string) => Number(fieldValue),
      },
    },
  },
  {
    converter: (event: EventMonkeyEvent) => {
      return {
        maxAttendees: event.maxAttendees ?? "No Max",
      };
    },
    serializeConfig: {
      labels: {
        maxAttendees: "Max Attendees",
      },
      formatters: {
        maxAttendees: (maxAttendees) => (maxAttendees ? maxAttendees.toString() : "No Max"),
      },
    },
    deserializeConfig: {
      customDeserializers: {
        maxAttendees: (fieldValue: string) => (isNaN(Number(fieldValue)) ? undefined : Number(fieldValue)),
      },
    },
  },
];
