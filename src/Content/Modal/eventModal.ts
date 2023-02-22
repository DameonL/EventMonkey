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
    scheduledStartTime: (fieldValue: string) =>
      new Date(Date.parse(fieldValue)),
    duration: (fieldValue: string) => Number(fieldValue),
  },
};

export async function eventModal(
  event: EventMonkeyEvent,
  interactionToReply: ChatInputCommandInteraction | ButtonInteraction
) {
  const modal = eventEditModal(event);

  await interactionToReply.showModal(modal);
  const modalSubmission = await interactionToReply.awaitModalSubmit({
    time: Configuration.current.editingTimeout,
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

  try {
    deserializeModal<EventMonkeyEvent>(
      modalSubmission.fields.fields.entries(),
      event,
      deserializationConfig
    );
  } catch (error: any) {
    await modalSubmission.reply({
      content: error.toString(),
      ephemeral: true,
    });

    EventsUnderConstruction.saveEvent(event);
    return;
  }

  let submissionEmbed = await editEventMessage(
    event,
    "",
    interactionToReply.guild as Guild,
    Configuration.current.discordClient?.user?.id ?? ""
  );

  await modalSubmission.reply(submissionEmbed);
  const replyMessage = await modalSubmission.fetchReply();
  event.submissionCollector?.stop();
  event.submissionCollector = undefined;
  event.submissionCollector = Listeners.getEmbedSubmissionCollector(
    event,
    replyMessage,
    modalSubmission
  );
}

export function eventEditModal(event: EventMonkeyEvent) {
  const modal = new ModalBuilder();
  modal.setTitle("Create a New Meetup");
  modal.setCustomId(event.id);

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
