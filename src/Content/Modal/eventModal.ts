import {
  ButtonInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  GuildScheduledEventEntityType,
  ModalBuilder,
  TextInputStyle,
} from "discord.js";
import Configuration from "../../Configuration";
import { EventMonkeyEvent } from "../../EventMonkey";
import EventsUnderConstruction from "../../EventsUnderConstruction";
import Listeners from "../../Listeners";
import Time from "../../Utility/TimeUtilities";
import submission from "../Embed/submission";
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

      EventsUnderConstruction.saveEvent(event);
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

      EventsUnderConstruction.saveEvent(event);
      return;
    }

    event.channel = matchingChannel;
    event.entityMetadata.location = matchingChannel.url;
  }

  let submissionEmbed = submission(
    event,
    "",
    Configuration.current.discordClient?.user?.id ?? ""
  );

  await modalSubmission.reply(submissionEmbed);
  const replyMessage = await modalSubmission.fetchReply();
  event.submissionCollector?.stop();
  event.submissionCollector = undefined;
  event.submissionCollector = Listeners.getEmbedSubmissionCollector(event, replyMessage, modalSubmission);
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
