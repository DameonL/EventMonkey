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
import EventsUnderConstruction from "../../EventsUnderConstruction";
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
  const modal = eventEditModal(event, interaction.id, page);

  await interaction.showModal(modal);
  let modalSubmission: ModalSubmitInteraction;
  try {
    modalSubmission = await interaction.awaitModalSubmit({
      time: Configuration.current.editingTimeout,
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
    deserializeModal<EventMonkeyEvent>(modalSubmission.fields.fields.entries(), event, pages[page].deserializeConfig);
  } catch (error: any) {
    await modalSubmission.editReply({
      content: JSON.stringify(error),
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

export function eventEditModal(event: EventMonkeyEvent, id: string, page = 0) {
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

  modal.addComponents(serializeToModal(`${event.id}_`, pages[page].converter(event), pages[page].serializeConfig));

  return modal;
}

interface EditModalPage {
  converter: (event: EventMonkeyEvent) => any;
  serializeConfig: ModalSerializationConfig;
  deserializeConfig: ModalDeserializationConfig;
}

const pages: EditModalPage[] = [
  {
    converter: (event: EventMonkeyEvent) => {
      return {
        name: event.name,
        description: event.description,
        scheduledStartTime: event.scheduledStartTime,
        duration: event.duration,
      };
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
      },
      customDeserializers: {
        scheduledStartTime: (fieldValue: string) => {
          const output = Time.getTimeFromString(fieldValue);

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
