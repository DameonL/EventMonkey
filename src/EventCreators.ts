import { AttachmentBuilder, Guild, GuildScheduledEventEntityType, Message, ThreadChannel } from "discord.js";
import { attendanceButtons } from "./Content/Component/attendanceButtons";
import { attendeesToEmbed } from "./Content/Embed/attendees";
import { eventEmbed, getEventDetailsMessage } from "./Content/Embed/eventEmbed";
import { EventMonkeyEvent } from "./EventMonkeyEvent";
import Listeners from "./Listeners";
import logger from "./Logger";
import Time from "./Utility/Time";
import { resolveChannelString } from "./Utility/resolveChannelString";

export default {
  createGuildScheduledEvent,
  createThreadChannelEvent,
};

async function createGuildScheduledEvent(event: EventMonkeyEvent, guild: Guild, thread: ThreadChannel) {
  const eventToSubmit = {} as any;
  eventToSubmit.description = `${event.description}\nDiscussion: ${thread.url}\nHosted by: ${event.author.toString()}`;
  eventToSubmit.name = `${event.name} hosted by ${event.author.username}`;
  eventToSubmit.entityType = event.eventType.entityType;
  eventToSubmit.scheduledStartTime = new Date(event.scheduledStartTime);

  const endTime = new Date(eventToSubmit.scheduledStartTime);
  endTime.setHours(endTime.getHours() + event.duration);
  eventToSubmit.scheduledEndTime = endTime;

  if (event.entityType === GuildScheduledEventEntityType.External) {
    eventToSubmit.entityMetadata = event.entityMetadata;
  } else {
    eventToSubmit.channel = event.channel;
  }

  eventToSubmit.image = event.image;
  eventToSubmit.privacyLevel = event.privacyLevel;
  const scheduledEvent = await (event.scheduledEvent
    ? guild.scheduledEvents.edit(event.scheduledEvent.id, eventToSubmit)
    : guild.scheduledEvents.create(eventToSubmit));

  return scheduledEvent;
}

async function createThreadChannelEvent(event: EventMonkeyEvent, guild: Guild) {
  const scheduledEndTime = new Date(event.scheduledStartTime);
  scheduledEndTime.setHours(scheduledEndTime.getHours() + event.duration);
  const targetChannel = await resolveChannelString(event.discussionChannelId, guild);

  if (!targetChannel) throw new Error(`Unable to resolve ID "${event.discussionChannelId}" to a channel.`);

  if (!("threads" in targetChannel))
    throw new Error(
      `Channel with ID ${event.discussionChannelId} is of type "${targetChannel.type}". The discussion channel needs to be able to have threads.`
    );

  const threadName = `${await Time.getTimeString(event.scheduledStartTime, guild.id)} - ${event.name} hosted by ${
    event.author.username
  }`;

  const threadMessage: any = {
    embeds: [await eventEmbed(event, guild.id), attendeesToEmbed(event.attendees)],
    files: event.image ? [new AttachmentBuilder(event.image)] : undefined,
  };

  let channelMessage: Message | undefined;
  if (event.threadChannel) {
    channelMessage = await getEventDetailsMessage(event.threadChannel);
    if (!channelMessage) throw new Error("Unable to get channel message from thread.");

    await event.threadChannel.setName(threadName);
  } else {
    if (event.image) {
      const imageAttachment = new AttachmentBuilder(event.image);
      threadMessage.files = [imageAttachment];
    }

    const threadChannel = await targetChannel.threads.create({
      name: threadName,
      message: threadMessage,
    });
    event.threadChannel = threadChannel;
    await Listeners.listenForButtonsInThread(threadChannel);

    channelMessage = (await threadChannel.messages.fetch()).at(0);
    if (!channelMessage) throw new Error("Unable to get channel message from freshly created thread.");

    await channelMessage.pin();
    threadChannel.members.add(event.author.id);
  }
  threadMessage.components = [attendanceButtons(event, channelMessage.id)];
  await channelMessage.edit(threadMessage);

  return event.threadChannel;
}
