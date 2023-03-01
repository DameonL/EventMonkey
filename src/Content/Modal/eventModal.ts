import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Guild,
  GuildScheduledEventEntityType,
  ModalBuilder,
  TextInputStyle,
} from "discord.js";
import Configuration from "../../Configuration";
import { EventMonkeyEvent } from "../../EventMonkey";
import EventsUnderConstruction from "../../EventsUnderConstruction";
import Listeners from "../../Listeners";
import Time from "../../Utility/TimeUtilities";
import editEventMessage from "../Embed/editEventMessage";
import {
  deserializeModal,
  ModalDeserializationConfig,
  ModalSerializationConfig,
  serializeToModal,
} from "./SerializedModal";

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
    scheduledStartTime: (fieldValue: string) => {
      const output = new Date(Date.parse(fieldValue));
      if (Configuration.current.timeZone) {
        output.setHours(
          output.getHours() + Configuration.current.timeZone.offset
        );
      }

      return output;
    },
    duration: (fieldValue: string) => Number(fieldValue),
  },
};

export async function eventModal(
  event: EventMonkeyEvent,
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  originalInteraction: ChatInputCommandInteraction
) {
  const modal = eventEditModal(event, interaction.id);

  await interaction.showModal(modal);
  const modalSubmission = await interaction.awaitModalSubmit({
    time: Configuration.current.editingTimeout,
    filter: (submitInteraction, collected) => {
      if (
        submitInteraction.user.id === interaction.user.id &&
        submitInteraction.customId === interaction.id
      ) {
        return true;
      }

      return false;
    },
  });
  await modalSubmission.deferReply({ ephemeral: true });

  const startTime = event.scheduledStartTime;
  try {
    deserializeModal<EventMonkeyEvent>(
      modalSubmission.fields.fields.entries(),
      event,
      deserializationConfig
    );
  } catch (error: any) {
    await modalSubmission.editReply({
      content: JSON.stringify(error),
    });

    EventsUnderConstruction.saveEvent(event);
    return;
  }

  // If the scheduled time has changed, we need to update recurrence settings.
  if (
    event.recurrence &&
    event.scheduledStartTime.valueOf() !== startTime.valueOf()
  ) {
    event.recurrence.firstStartTime = event.scheduledStartTime;
    event.recurrence.timesHeld = 0;
  }

  let submissionEmbed = await editEventMessage(
    event,
    "",
    interaction.guild as Guild,
    originalInteraction.id
  );

  await originalInteraction.editReply(submissionEmbed);
  await modalSubmission.deleteReply();

  return event;
}

export function eventEditModal(event: EventMonkeyEvent, id: string) {
  const modal = new ModalBuilder();
  modal.setTitle("Create a New Meetup");
  modal.setCustomId(id);

  const serializationObject: any = {
    name: event.name,
    description: event.description,
    scheduledStartTime: event.scheduledStartTime,
    duration: event.duration,
  };

  if (event.entityType === GuildScheduledEventEntityType.External) {
    serializationObject["entityMetadata.location"] =
      event.entityMetadata.location;
  }

  const serializationConfig: ModalSerializationConfig = {
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
  };
  modal.addComponents(
    serializeToModal(`${event.id}_`, serializationObject, serializationConfig)
  );

  return modal;
}
