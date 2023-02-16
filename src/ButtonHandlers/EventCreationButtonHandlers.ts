import {
  ButtonInteraction,
  Client,
  GuildScheduledEvent,
  Message,
  ModalSubmitInteraction,
  PermissionsBitField,
  TextInputModalData,
  ThreadChannel,
} from "discord.js";
import Submission from "../Content/Embed/submission";
import { editRecurrence } from "../Content/Modal/editRecurrence";
import { eventModal } from "../Content/Modal/eventModal";
import {
  createForumChannelEvent,
  createGuildScheduledEvent,
} from "../EventCreators";
import { EventMonkeyEvent } from "../EventMonkeyEvent";
import EventsUnderConstruction from "../EventsUnderConstruction";
import Listeners from "../Listeners";
import Threads from "../Utility/Threads";
import Time from "../Utility/TimeUtilities";

const eventCreationButtonHandlers: {
  [handlerName: string]: (
    event: EventMonkeyEvent,
    submissionInteraction: ButtonInteraction,
    message: Message,
    client: Client
  ) => void;
} = {
  edit: async (
    event: EventMonkeyEvent,
    submissionInteraction: ButtonInteraction,
    message: Message,
    client: Client
  ) => {
    await message.delete();
    await eventModal(event, submissionInteraction);
  },
  makeRecurring: async (
    event: EventMonkeyEvent,
    submissionInteraction: ButtonInteraction,
    message: Message,
    client: Client
  ) => {
    event.recurrence = {
      firstStartTime: event.scheduledStartTime,
      timesHeld: 0,
      weeks: 1,
    };
    await submissionInteraction.showModal(editRecurrence(event));
    var submission = await submissionInteraction.awaitModalSubmit({
      time: Time.toMilliseconds.minutes(5),
      filter: (submitInteraction, collected) => {
        if (
          submitInteraction.user.id === event.author.id &&
          submitInteraction.customId === event.id
        ) {
          return true;
        }

        return false;
      },
    });
    var unitField = submission.fields.getField(
      `${event.id}_unit`
    ) as TextInputModalData;
    let unit = unitField.value;

    if (!unit.endsWith("s")) unit += "s";
    if (
      unit !== "hours" &&
      unit !== "days" &&
      unit !== "weeks" &&
      unit !== "months"
    ) {
      await submission.reply({
        content: `Invalid time unit. Valid options are "hours", "days", "weeks", or "months"`,
        ephemeral: true,
      });
      return;
    }

    const frequencyField = submission.fields.getField(
      `${event.id}_frequency`
    ) as TextInputModalData;
    if (frequencyField.value.match(/[^\d]/)) {
      await submission.reply({
        content: `Frequency must be a whole number.`,
        ephemeral: true,
      });
      return;
    }

    const frequency = Number(frequencyField.value);
    if (isNaN(frequency)) {
      await submission.reply({
        content: `The time before the next recurrence must be a number.`,
        ephemeral: true,
      });
      return;
    }

    const recurrence: any = {
      firstStartTime: event.scheduledStartTime,
      timesHeld: 0,
    };

    recurrence[unit] = frequency;

    event.recurrence = recurrence;
    await submission.reply({
      content: `Event will recur every ${frequency} ${unit}`,
      ephemeral: true,
    });
    const submissionEmbed = Submission(
      event,
      "Image added!",
      client?.user?.id ?? ""
    );
    await message.edit(submissionEmbed);
  },
  addImage: async (
    event: EventMonkeyEvent,
    submissionInteraction: ButtonInteraction,
    message: Message,
    client: Client
  ) => {
    await message.edit({
      content: "Adding image...",
      embeds: [],
      components: [],
    });

    const imageResponse = await submissionInteraction.reply({
      content: `Hi ${submissionInteraction.user.toString()}, just reply to this message with your image!`,
      fetchReply: true,
    });

    let replies = await imageResponse.channel.awaitMessages({
      filter: (replyInteraction) =>
        replyInteraction.reference?.messageId === imageResponse.id,
      time: Time.toMilliseconds.minutes(10),
      max: 1,
    });

    if (!replies.at(0)) {
      imageResponse.edit("Sorry, you took too long! Please try again.");
      setTimeout(() => imageResponse.delete(), Time.toMilliseconds.minutes(1));
      const submissionEmbed = Submission(event, "", client?.user?.id ?? "");
      await message.edit(submissionEmbed);
      return;
    }

    if (replies.at(0)?.attachments.at(0)?.url) {
      event.image = replies.at(0)?.attachments.at(0)?.url as string;
      await replies.at(0)?.delete();
      await imageResponse.delete();
      const submissionEmbed = Submission(
        event,
        "Image added!",
        client?.user?.id ?? ""
      );
      await message.edit(submissionEmbed);
    }
  },
  save: async (
    event: EventMonkeyEvent,
    submissionInteraction: ButtonInteraction,
    message: Message,
    client: Client
  ) => {
    await submissionInteraction.update({
      content: `Saved for later! You can continue from where you left off with "/meetup create". Don't wait too long, or you will have to start over again!`,
      embeds: [],
      components: [],
    });
    EventsUnderConstruction.saveEvent(event);
    Listeners.getEmbedSubmissionCollector(event, message)?.stop();
  },
  finish: async (
    event: EventMonkeyEvent,
    submissionInteraction: ButtonInteraction,
    message: Message,
    client: Client
  ) => {
    if (!message.guild) return;

    if (!submissionInteraction.deferred) submissionInteraction.deferUpdate();

    if (
      event.scheduledStartTime.valueOf() - new Date().valueOf() <
      Time.toMilliseconds.minutes(30)
    ) {
      const member = await message.guild.members.fetch(event.author.id);
      if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await message.edit({
          content:
            "Sorry, your start time needs to be more than 30 minutes from now!",
        });

        return;
      }
    }

    await message.edit({
      content: "Creating event...",
      embeds: [],
      components: [],
    });

    const forumThread = await createForumChannelEvent(
      event,
      message.guild,
      client
    );

    try {
      const guildScheduledEvent = await createGuildScheduledEvent(
        event,
        message.guild,
        forumThread
      );

      if (guildScheduledEvent) {
        await updateScheduledEventUrl(guildScheduledEvent, forumThread);
      }
    } catch (error) {
      console.error(error);
      console.log(event);
      await message.edit({
        content: `Sorry, something went wrong!`,
        embeds: [],
        components: [],
      });

      EventsUnderConstruction.saveEvent(event);
    } finally {
      Listeners.getEmbedSubmissionCollector(event, message)?.stop();
    }

    await message.edit({
      content: "Event created successfully!",
      embeds: [],
      components: [],
    });

    EventsUnderConstruction.deleteEvent(submissionInteraction.user.id);
  },
  cancel: async (
    event: EventMonkeyEvent,
    submissionInteraction: ButtonInteraction,
    message: Message,
    client: Client
  ) => {
    await message.edit({
      content: "Cancelled event creation.",
      embeds: [],
      components: [],
    });

    if (event.threadChannel && event.scheduledEvent) {
      await Threads.closeEventThread(event.threadChannel, event.scheduledEvent);
    }

    if (event.scheduledEvent) {
      await event.scheduledEvent.delete();
    }

    EventsUnderConstruction.deleteEvent(submissionInteraction.user.id);
    Listeners.getEmbedSubmissionCollector(event, message)?.stop();
  },
};

export default eventCreationButtonHandlers;
export async function updateScheduledEventUrl(
  guildScheduledEvent: GuildScheduledEvent,
  forumThread: ThreadChannel
) {
  const eventMessage = forumThread.messages.cache.at(0);
  if (eventMessage) {
    const embeds = [...eventMessage.embeds];
    let embedField = embeds[0].fields.find((x) => x.name === "Event Link");
    if (!embedField) {
      embedField = { name: "Event Link", value: guildScheduledEvent.url };
      embeds[0].fields.push(embedField);
    } else {
      embedField.value = guildScheduledEvent.url;
    }

    await eventMessage.edit({ embeds });
  }
}
