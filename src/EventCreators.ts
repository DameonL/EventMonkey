import {
  ButtonInteraction,
  ChannelType,
  Client,
  ForumChannel,
  Guild,
  GuildScheduledEventEntityType,
} from "discord.js";
import {
  createAttendanceButtons,
  createAttendeesEmbed,
  createPreviewEmbed,
} from "./ContentCreators";
import { listenForButtonsInThread, resolveChannelString } from "./EventMonkey";
import { EventMonkeyEvent } from "./EventMonkeyEvent";
import { sortEventThreads } from "./ThreadUtilities";

export async function createGuildScheduledEvent(
  event: EventMonkeyEvent,
  guild: Guild,
  threadUrl: string
) {
  const eventToSubmit = { ...event } as any;
  const scheduledEndTime = new Date(eventToSubmit.scheduledStartTime);
  scheduledEndTime.setHours(
    scheduledEndTime.getHours() + eventToSubmit.duration
  );
  eventToSubmit.scheduledEndTime = scheduledEndTime;
  eventToSubmit.description = `${
    eventToSubmit.description
  }\nDiscussion: ${threadUrl}\nHosted by: ${eventToSubmit.author.toString()}`;
  eventToSubmit.name = `${eventToSubmit.name} hosted by ${eventToSubmit.author.username}`;
  if (eventToSubmit.entityType !== GuildScheduledEventEntityType.External) {
    eventToSubmit.channelId = eventToSubmit.entityMetadata.location;
    delete eventToSubmit.entityMetadata;
  }

  const scheduledEvent = await (event.scheduledEvent
    ? guild.scheduledEvents.edit(
        event.scheduledEvent.id,
        eventToSubmit
      )
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
  const targetChannel = await resolveChannelString(event.forumChannelId, guild);

  if (targetChannel.type !== ChannelType.GuildForum && targetChannel.type !== ChannelType.GuildText)
    throw new Error(
      `Channel with ID ${event.forumChannelId} is of type ${targetChannel.type}, but expected a forum channel!`
    );

  if (!targetChannel)
    throw new Error(
      `Unable to resolve ID ${event.forumChannelId} to a channel.`
    );

  const threadName = `${event.scheduledStartTime
    .toLocaleString()
    .replace(/(?<=\d?\d:\d\d):\d\d/, " ")} - ${event.name} hosted by ${
    event.author.username
  }`;
  const threadMessage = {
    embeds: [createPreviewEmbed(event), createAttendeesEmbed(event)],
    components: [createAttendanceButtons(event, client.user?.id ?? "")],
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

  await sortEventThreads(targetChannel);
  await listenForButtonsInThread(threadChannel);

  return threadChannel;
}
