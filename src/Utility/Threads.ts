import {
  ChannelType,
  EmbedBuilder,
  GuildForumThreadManager,
  GuildScheduledEvent,
  GuildTextThreadManager,
  ThreadChannel,
} from "discord.js";
import Configuration from "../Configuration";
import { deseralizeEventEmbed } from "../Content/Embed/eventEmbed";
import { resolveChannelString } from "./resolveChannelString";
import Time from "./TimeUtilities";

interface ChannelWithThreads {
  threads:
    | GuildForumThreadManager
    | GuildTextThreadManager<ChannelType.PublicThread>;
}

export default {
  closeAllOutdatedThreads,
  closeOutdatedThreadsInChannel,
  closeEventThread,
  getThreadFromEventDescription
}

async function closeAllOutdatedThreads() {
  if (!Configuration.current.discordClient) return;

  for (const [guildId, guild] of Configuration.current.discordClient.guilds.cache) {
    for (const { name, channel } of Configuration.current.eventTypes) {
      const resolvedChannel = await resolveChannelString(channel, guild);
      if (
        resolvedChannel.type === ChannelType.GuildText ||
        resolvedChannel.type === ChannelType.GuildForum
      ) {
        await closeOutdatedThreadsInChannel(resolvedChannel);
      }
    }
  }
}

async function closeOutdatedThreadsInChannel(
  channel: ChannelWithThreads
) {
  const threads = await (await channel.threads.fetchActive()).threads;
  const client = channel.threads.client;

  for (const [threadName, threadChannel] of threads) {
    const threadEvent = await deseralizeEventEmbed(threadChannel, client);
    if (
      threadEvent &&
      (!threadEvent.scheduledEvent ||
        threadEvent.scheduledEvent.isCompleted() ||
        threadEvent.scheduledEvent.isCanceled())
    ) {
      closeEventThread(threadChannel, threadEvent.scheduledEvent);
    }
  }
}

async function closeEventThread(
  thread: ThreadChannel,
  event?: GuildScheduledEvent
) {
  if (thread.archived) return;

  const pinnedMessage = (await thread.messages.fetchPinned()).at(0);
  if (pinnedMessage && pinnedMessage.components.length > 0) {
    await pinnedMessage.edit({ components: [] });
  }

  let lastMessage = await thread.messages.cache.last();
  let threadAge = thread.createdAt;
  if (lastMessage && lastMessage.createdAt) {
    threadAge =
      thread.lastPinAt && lastMessage.createdAt < thread.lastPinAt
        ? thread.lastPinAt
        : lastMessage.createdAt;
  }

  const closeThreadsAfter = Configuration.current.closeThreadsAfter ?? Time.toMilliseconds.days(1);
  if (
    threadAge &&
    new Date().valueOf() - threadAge.valueOf() < closeThreadsAfter
  )
    return;

  await (
    await thread.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(
            `Event is ${event && event.isCanceled() ? "Canceled" : "Over"}`
          )
          .setDescription("Thread has been locked and archived.")
          .setColor("DarkRed"),
      ],
    })
  ).pin();

  await thread.setLocked(true);
  await thread.setArchived(true);
}

async function getThreadFromEventDescription(
  eventDescription: string
): Promise<ThreadChannel | undefined> {
  const guildAndThread = eventDescription.match(
    /(?<=https:\/\/discord.com\/channels\/\d+\/)(?<threadId>\d+)/im
  );
  if (guildAndThread && guildAndThread.groups) {
    const threadId = guildAndThread.groups.threadId;
    const thread = await Configuration.current.discordClient?.channels.fetch(threadId);
    if (thread && thread.type === ChannelType.PublicThread) {
      return thread;
    }
  }

  return undefined;
}