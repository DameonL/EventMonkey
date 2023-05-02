import {
  ChannelType,
  EmbedBuilder,
  GuildForumThreadManager,
  GuildScheduledEvent,
  GuildTextThreadManager,
  ThreadChannel,
} from "discord.js";
import Configuration from "../Configuration";
import { deseralizeEventEmbed, getEventDetailsMessage } from "../Content/Embed/eventEmbed";
import { resolveChannelString } from "./resolveChannelString";
import Time from "./Time";
import logger from "../Logger";

interface ChannelWithThreads {
  threads: GuildForumThreadManager | GuildTextThreadManager<ChannelType.PublicThread>;
}

export default {
  closeAllOutdatedThreads,
  closeOutdatedThreadsInChannel,
  closeEventThread,
  getThreadFromEventDescription,
};

async function closeAllOutdatedThreads() {
  if (!Configuration.current.discordClient) return;

  for (const [guildId, guild] of Configuration.current.discordClient.guilds.cache) {
    for (const { name, discussionChannel } of Configuration.current.eventTypes) {
      try {
        const resolvedChannel = await resolveChannelString(discussionChannel, guild);
        if (!resolvedChannel) continue;

        if (resolvedChannel.type === ChannelType.GuildText || resolvedChannel.type === ChannelType.GuildForum) {
          await closeOutdatedThreadsInChannel(resolvedChannel);
        }
      } catch (error) {
        logger.error(`Error trying to close outdated threads in ${discussionChannel} on ${guild.name}`, error);
        continue;
      }
    }
  }
}

async function closeOutdatedThreadsInChannel(channel: ChannelWithThreads) {
  const threads = (await channel.threads.fetchActive()).threads;
  const client = channel.threads.client;

  for (const [threadName, threadChannel] of threads) {
    try {
      const threadEvent = await deseralizeEventEmbed(threadChannel, client);
      if (
        threadEvent &&
        !threadEvent.recurrence &&
        (!threadEvent.scheduledEvent ||
          threadEvent.scheduledEvent.isCompleted() ||
          threadEvent.scheduledEvent.isCanceled())
      ) {
        await closeEventThread(threadChannel, threadEvent.scheduledEvent);
      }
    } catch (error) {
      logger.error("Error closing thread", { threadChannel, error });
    }
  }
}

async function closeEventThread(thread: ThreadChannel, event?: GuildScheduledEvent) {
  if (thread.archived) return;

  const pinnedMessage = await getEventDetailsMessage(thread);
  if (pinnedMessage && pinnedMessage.components.length > 0) {
    await pinnedMessage.edit({ components: [] });
  }

  let lastMessage = thread.messages.cache.last();
  let threadAge = thread.createdAt;
  if (lastMessage && lastMessage.createdAt) {
    threadAge = thread.lastPinAt && lastMessage.createdAt < thread.lastPinAt ? thread.lastPinAt : lastMessage.createdAt;
  }

  const closeThreadsAfter = Configuration.current.closeThreadsAfter ?? Time.toMilliseconds.days(1);
  if (threadAge && new Date().valueOf() - threadAge.valueOf() < closeThreadsAfter) return;

  await (
    await thread.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`Event is ${event && event.isCanceled() ? "Canceled" : "Over"}`)
          .setDescription("Thread has been locked and archived.")
          .setColor("DarkRed"),
      ],
    })
  ).pin();

  await thread.setLocked(true);
  await thread.setArchived(true);
}

async function getThreadFromEventDescription(eventDescription: string): Promise<ThreadChannel | undefined> {
  const guildAndThread = eventDescription.match(/(?<=https:\/\/discord.com\/channels\/\d+\/)(?<threadId>\d+)/im);
  if (guildAndThread && guildAndThread.groups) {
    const threadId = guildAndThread.groups.threadId;
    const thread = await Configuration.current.discordClient?.channels.fetch(threadId);
    if (thread && thread.type === ChannelType.PublicThread) {
      return thread;
    }
  }

  return undefined;
}
