import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildScheduledEvent,
  GuildScheduledEventEntityType,
  MessageCreateOptions,
  ModalBuilder,
  PermissionsBitField,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  ThreadChannel,
} from "discord.js";
import { getEventDetailsMessage } from "../Content/Embed/eventEmbed";
import { eventModal } from "../Content/Modal/eventModal";
import EventCreators from "../EventCreators";
import { EventMonkeyEvent } from "../EventMonkeyEvent";
import EventsUnderConstruction from "../EventsUnderConstruction";
import logger from "../Logger";
import { getValidVoiceOrStageChannel } from "../Utility/getValidVoiceOrStageChannel";
import Threads from "../Utility/Threads";
import Time from "../Utility/Time";
import editEventMessage from "../Content/Embed/editEventMessage";

export enum EventCreationButtonHandlerResponse {
  ContinueEditing,
  EndEditing,
}

const eventCreationButtonHandlers: {
  [handlerName: string]: (
    event: EventMonkeyEvent,
    submissionInteraction: ButtonInteraction,
    originalInteraction: ChatInputCommandInteraction
  ) => Promise<EventCreationButtonHandlerResponse>;
} = {
  edit: async (event, submissionInteraction, originalInteraction) => {
    await eventModal(event, submissionInteraction, originalInteraction);
    return EventCreationButtonHandlerResponse.ContinueEditing
  },
  makeRecurring: async (event, submissionInteraction, originalInteraction) => {
    const periodId = `${submissionInteraction.id}_${event.id}_recurrencePeriod`;
    const submissionFilter = (x: { customId: string; user: { id: string } }) =>
      x.customId === periodId && x.user.id === submissionInteraction.user.id;

    const recurrenceUnitMessage = {
      content: "What period will your event recur over?",
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().setComponents([
          new StringSelectMenuBuilder()
            .setCustomId(periodId)
            .setOptions(
              { label: "hours", value: "hours" },
              { label: "days", value: "days" },
              { label: "weeks", value: "weeks" },
              { label: "months", value: "months" }
            )
            .setMaxValues(1),
        ]),
      ],
      fetchReply: true,
      ephemeral: true,
    };

    const unitReply = await submissionInteraction.reply(recurrenceUnitMessage);

    let unitInteraction: StringSelectMenuInteraction | undefined = undefined;
    let unit: string = "hours";

    try {
      unitInteraction = (await unitReply.awaitMessageComponent({
        filter: submissionFilter,
        time: Time.toMilliseconds.minutes(5),
      })) as StringSelectMenuInteraction;
      unit = unitInteraction.values[0];
      await submissionInteraction.editReply({ content: `${unit}! Got it!`, components: [] });
    } catch {
      await submissionInteraction.editReply({ content: "Sorry, you took too long!", components: [] });
    }

    if (!unitInteraction) return EventCreationButtonHandlerResponse.ContinueEditing
    ;

    await unitInteraction.showModal(
      new ModalBuilder()
        .setTitle(`How many ${unit} between events?`)
        .setCustomId(periodId)
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setLabel(unit).setValue("1").setStyle(TextInputStyle.Short).setCustomId("units")
          )
        )
    );

    let frequency: number | undefined = undefined;
    try {
      const modalSubmit = await unitInteraction.awaitModalSubmit({
        filter: submissionFilter,
        time: Time.toMilliseconds.minutes(5),
      });
      await modalSubmit.deferUpdate();
      const fieldValue = Number(modalSubmit.fields.fields.first()?.value);
      if (isNaN(Number(fieldValue))) {
        await submissionInteraction.editReply({ content: "That's not a valid number!", components: [] });
        return EventCreationButtonHandlerResponse.ContinueEditing;
      }

      frequency = Number(fieldValue);
    } catch {
      await submissionInteraction.editReply({ content: "Sorry, you took too long!", components: [] });
      return EventCreationButtonHandlerResponse.EndEditing;
    }

    await submissionInteraction.editReply({ content: `Every ${frequency} ${unit}! Got it!`, components: [] });

    const recurrence: any = {
      firstStartTime: event.scheduledStartTime,
      timesHeld: 0,
    };

    recurrence[unit] = frequency;

    event.recurrence = recurrence;
    return EventCreationButtonHandlerResponse.ContinueEditing
  },
  addImage: async (event, submissionInteraction, originalInteraction) => {
    await originalInteraction.editReply({
      content: "Adding image...",
      embeds: [],
      components: [],
    });

    const imageResponse = await submissionInteraction.reply({
      content: `Hi ${submissionInteraction.user.toString()}, just reply to this message with your image!`,
      fetchReply: true,
    });

    if (!("awaitMessages" in imageResponse.channel)) return EventCreationButtonHandlerResponse.EndEditing;

    let replies = await imageResponse.channel.awaitMessages({
      filter: (replyInteraction) =>
        replyInteraction.reference?.messageId === imageResponse.id &&
        replyInteraction.author.id === originalInteraction.user.id,
      time: Time.toMilliseconds.minutes(10),
      max: 1,
    });

    if (!replies.at(0)) {
      imageResponse.edit("Sorry, you took too long! Please try again.");
      setTimeout(() => imageResponse.delete(), Time.toMilliseconds.minutes(1));
      return EventCreationButtonHandlerResponse.ContinueEditing;
    }

    await submissionInteraction.editReply({
      content: "Adding image. Please be patient! If your image is large, this may take a minute.",
      embeds: [],
      components: [],
    });

    let submissionEmbed: MessageCreateOptions;
    try {
      const attachmentUrl = replies.at(0)?.attachments.at(0)?.url;
      if (attachmentUrl) {
        event.image = attachmentUrl;
        submissionEmbed = await editEventMessage(event, "Image added!", originalInteraction);
        submissionEmbed.files = [new AttachmentBuilder(event.image)];
        await originalInteraction.editReply(submissionEmbed);
      } else {
        await submissionInteraction.editReply({content: "Your message didn't have a valid image attached!"});
      }
    } catch (error) {
      logger.error("Error adding image", error);
      event.image = "";
      submissionEmbed = await editEventMessage(
        event,
        "Sorry, I wasn't able to add your image. It may be too large.",
        originalInteraction
      );
      await originalInteraction.editReply(submissionEmbed);
    } finally {
      await replies.at(0)?.delete();
      await imageResponse.delete();
    }
    return EventCreationButtonHandlerResponse.ContinueEditing
  },
  save: async (event, submissionInteraction, originalInteraction) => {
    await originalInteraction.editReply({
      content: `Saved for later! You can continue from where you left off. Don't wait too long, or you will have to start over again!`,
      embeds: [],
      components: [],
    });
    EventsUnderConstruction.saveEvent(event);
    return EventCreationButtonHandlerResponse.EndEditing
  },
  finish: async (event, submissionInteraction, originalInteraction) => {
    if (!originalInteraction.guild) return EventCreationButtonHandlerResponse.EndEditing;

    await submissionInteraction.deferReply({ ephemeral: true });

    if (event.scheduledStartTime.valueOf() - Date.now() < Time.toMilliseconds.minutes(30)) {
      const member = await originalInteraction.guild.members.fetch(event.author.id);
      if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await originalInteraction.editReply({
          content: "Sorry, your start time needs to be more than 30 minutes from now!",
        });

        return EventCreationButtonHandlerResponse.ContinueEditing;
      }
    }

    if (!event.scheduledEndTime) {
      event.scheduledEndTime = new Date(event.scheduledStartTime);
      event.scheduledEndTime.setHours(event.scheduledEndTime.getHours() + event.duration);
    }

    if (event.entityType !== GuildScheduledEventEntityType.External) {
      const channelList = event.eventType.channel;

      if (!channelList)
        throw new Error(
          `No valid channels for event type ${event.eventType?.name} on guild ${originalInteraction.guild?.name}`
        );

      const channel = await getValidVoiceOrStageChannel(event, event.eventType, originalInteraction.guild);
      if (!channel) {
        await submissionInteraction.editReply({
          content: `Sorry, it looks like that time overlaps with another event! Please change your event's time.`,
        });
        return EventCreationButtonHandlerResponse.ContinueEditing;
      }
      event.channel = channel;
    }

    if (!event.attendees.includes(submissionInteraction.user.id)) event.attendees.push(submissionInteraction.user.id);

    const attachmentUrl = submissionInteraction.message.attachments.at(0)?.url;
    if (attachmentUrl) {
      event.image = attachmentUrl;
    }

    if (!event.image && event.eventType.defaultImageUrl) {
      event.image = event.eventType.defaultImageUrl;
    }

    await originalInteraction.editReply({
      content: "Creating event...",
      embeds: [],
      components: [],
    });

    const forumThread = await EventCreators.createThreadChannelEvent(event, originalInteraction.guild);

    try {
      const guildScheduledEvent = await EventCreators.createGuildScheduledEvent(
        event,
        originalInteraction.guild,
        forumThread
      );

      if (guildScheduledEvent) {
        await updateScheduledEventUrl(guildScheduledEvent, forumThread);
      }
    } catch (error) {
      logger.error("Error while creating GuildScheduledEvent", { event, error });
      await originalInteraction.editReply({
        content: `Sorry, something went wrong!`,
        embeds: [],
        components: [],
      });

      if (forumThread && !event.scheduledEvent) await forumThread.delete();

      EventsUnderConstruction.saveEvent(event);
      return EventCreationButtonHandlerResponse.EndEditing;
    }

    await originalInteraction.editReply({
      content: "Event created successfully!",
      embeds: [],
      components: [],
    });

    EventsUnderConstruction.deleteEvent(submissionInteraction.user.id);
    await submissionInteraction.deleteReply();
    return EventCreationButtonHandlerResponse.EndEditing;
  },
  cancel: async (event, submissionInteraction, originalInteraction) => {
    const submissionMessage = submissionInteraction.message;
    if (event.threadChannel) {
      const yesNoButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("CANCEL EVENT")
          .setStyle(ButtonStyle.Danger)
          .setCustomId(`${submissionInteraction.id}_cancelEvent`),
        new ButtonBuilder()
          .setLabel("Cancel Editing")
          .setStyle(ButtonStyle.Success)
          .setCustomId(`${submissionInteraction.id}_cancelEdit`)
      );
      const response = await submissionInteraction.reply({
        content: "Do you want to cancel your existing event, or just cancel editing?",
        ephemeral: true,
        components: [yesNoButtons],
      });
      let collected;
      try {
        collected = await response.awaitMessageComponent({
          filter: (interaction) => interaction.customId.startsWith(`${submissionInteraction.id}_`),
          time: Time.toMilliseconds.minutes(1),
        });
      } catch {}
      if (!collected) {
        await submissionInteraction.editReply({
          content: "Sorry, your response timed out!",
        });
        return EventCreationButtonHandlerResponse.EndEditing;
      }

      await collected.deferUpdate();
      await submissionInteraction.deleteReply();
      if (collected.customId.endsWith(`_cancelEvent`)) {
        await originalInteraction.editReply({
          content: "Cancelled event.",
          embeds: [],
          components: [],
        });

        if (event.threadChannel && event.scheduledEvent) {
          await Threads.closeEventThread(event.threadChannel, event.scheduledEvent);
        }

        if (event.scheduledEvent) {
          await event.scheduledEvent.delete();
        }
      }
    }

    await originalInteraction.editReply({
      content: "Cancelled event creation.",
      embeds: [],
      components: [],
    });

    EventsUnderConstruction.deleteEvent(submissionInteraction.user.id);
    return EventCreationButtonHandlerResponse.EndEditing;
  },
};

export async function updateScheduledEventUrl(guildScheduledEvent: GuildScheduledEvent, thread: ThreadChannel) {
  const eventMessage = await getEventDetailsMessage(thread);
  if (eventMessage) {
    const embeds: any[] = [...eventMessage.embeds];
    embeds[0] = new EmbedBuilder(embeds[0].data).setURL(guildScheduledEvent.url);
    await eventMessage.edit({ embeds });
  }
}

export default eventCreationButtonHandlers;
