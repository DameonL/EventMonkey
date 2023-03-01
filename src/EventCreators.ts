import {
  ActionRowBuilder,
  ButtonBuilder,
  Client,
  Guild,
  GuildScheduledEventEntityType,
  Message,
  ThreadChannel,
} from "discord.js";
import Configuration from "./Configuration";
import { attendanceButtons } from "./Content/Component/attendanceButtons";
import { attendeesToEmbed } from "./Content/Embed/attendees";
import {
  eventEmbed,
  getEventDetailsEmbed,
  getEventDetailsMessage,
} from "./Content/Embed/eventEmbed";
import { EventMonkeyEvent } from "./EventMonkeyEvent";
import Listeners from "./Listeners";
import { resolveChannelString } from "./Utility/resolveChannelString";

export default {
  createGuildScheduledEvent,
  createThreadChannelEvent
}

async function createGuildScheduledEvent(
  event: EventMonkeyEvent,
  guild: Guild,
  thread: ThreadChannel
) {
  const eventToSubmit = { ...event } as any;
  const scheduledStartTime = new Date(eventToSubmit.scheduledStartTime);
  scheduledStartTime.setHours(
    scheduledStartTime.getHours() - Configuration.current.timeZone.offset
  );

  const scheduledEndTime = new Date(eventToSubmit.scheduledEndTime);
  scheduledEndTime.setHours(
    scheduledStartTime.getHours() - Configuration.current.timeZone.offset
  );
  eventToSubmit.scheduledStartTime = scheduledStartTime;
  eventToSubmit.scheduledEndTime = scheduledEndTime;
  eventToSubmit.description = `${eventToSubmit.description}\nDiscussion: ${
    thread.url
  }\nHosted by: ${eventToSubmit.author.toString()}`;
  eventToSubmit.name = `${eventToSubmit.name} hosted by ${eventToSubmit.author.username}`;
  if (eventToSubmit.entityType !== GuildScheduledEventEntityType.External) {
    eventToSubmit.channel = eventToSubmit.entityMetadata.location;
    delete eventToSubmit.entityMetadata;
  }

  const scheduledEvent = await (event.scheduledEvent
    ? guild.scheduledEvents.edit(event.scheduledEvent.id, eventToSubmit)
    : guild.scheduledEvents.create(eventToSubmit));

  return scheduledEvent;
}

async function createThreadChannelEvent(
  event: EventMonkeyEvent,
  guild: Guild,
) {
  const scheduledEndTime = new Date(event.scheduledStartTime);
  scheduledEndTime.setHours(scheduledEndTime.getHours() + event.duration);
  const targetChannel = await resolveChannelString(
    event.discussionChannelId,
    guild
  );

  if (!targetChannel)
    throw new Error(
      `Unable to resolve ID "${event.discussionChannelId}" to a channel.`
    );

  if (!("threads" in targetChannel))
    throw new Error(
      `Channel with ID ${event.discussionChannelId} is of type "${targetChannel.type}". The discussion channel needs to be able to have threads.`
    );

  const threadName = `${event.scheduledStartTime
    .toLocaleString()
    .replace(/(?<=\d?\d:\d\d):\d\d/, " ")} - ${event.name} hosted by ${
    event.author.username
  }`;
  const threadMessage = {
    embeds: [await eventEmbed(event, guild), attendeesToEmbed(event.attendees)],
    components: new Array<ActionRowBuilder<ButtonBuilder>>(),
  };

  let channelMessage: Message | undefined;
  if (event.threadChannel) {
    channelMessage = await getEventDetailsMessage(event.threadChannel);
    if (!channelMessage)
      throw new Error("Unable to get channel message from thread.");

    threadMessage.components = [attendanceButtons(event, channelMessage.id)];
    await event.threadChannel.setName(threadName);
  } else {
    const threadChannel = await targetChannel.threads.create({
      name: threadName,
      message: threadMessage,
    });
    event.threadChannel = threadChannel;

    channelMessage = threadChannel.messages.cache.at(0);
    if (!channelMessage)
      throw new Error(
        "Unable to get channel message from freshly created thread."
      );

    channelMessage.pin();
  }
  channelMessage.edit(threadMessage);

  await Listeners.listenForButtonsInThread(event.threadChannel);

  return event.threadChannel;
}
