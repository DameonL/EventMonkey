import {
  Client,
  Guild,
  GuildScheduledEventEntityType,
  ThreadChannel,
} from "discord.js";
import { attendanceButtons } from "./Content/Component/attendanceButtons";
import { attendeesToEmbed } from "./Content/Embed/attendees";
import { eventEmbed } from "./Content/Embed/eventEmbed";
import { EventMonkeyEvent } from "./EventMonkeyEvent";
import Listeners from "./Listeners";
import { resolveChannelString } from "./Utility/resolveChannelString";

export async function createGuildScheduledEvent(
  event: EventMonkeyEvent,
  guild: Guild,
  thread: ThreadChannel
) {
  const eventToSubmit = { ...event } as any;
  const scheduledEndTime = new Date(eventToSubmit.scheduledStartTime);
  scheduledEndTime.setHours(
    scheduledEndTime.getHours() + eventToSubmit.duration
  );
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

export async function createForumChannelEvent(
  event: EventMonkeyEvent,
  guild: Guild,
  client: Client
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
    components: [attendanceButtons(event, client.user?.id ?? "")],
  };

  const threadChannel = event.threadChannel
    ? event.threadChannel
    : await targetChannel.threads.create({
        name: threadName,
        message: threadMessage,
      });

  if (event.threadChannel) {
    await event.threadChannel.setName(threadName);
    (await event.threadChannel.messages.fetchPinned())
      .at(0)
      ?.edit(threadMessage);
  } else {
    threadChannel.messages.cache.at(0)?.pin();
  }

  await Listeners.listenForButtonsInThread(threadChannel);

  return threadChannel;
}
