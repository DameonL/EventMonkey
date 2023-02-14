import {
  ChannelType,
  EmbedBuilder,
  GuildForumThreadManager,
  GuildScheduledEvent,
  GuildTextThreadManager,
  ThreadChannel,
} from "discord.js";
import { configuration, resolveChannelString } from "./EventMonkey";
import { deseralizePreviewEmbed, getTimeFromString } from "./Serialization";
import { days } from "./TimeConversion";

interface ChannelWithThreads {
  threads:
    | GuildForumThreadManager
    | GuildTextThreadManager<ChannelType.PublicThread>;
}

export async function closeAllOutdatedThreads() {
  if (!configuration.discordClient) return;

  for (const [guildId, guild] of configuration.discordClient.guilds.cache) {
    for (const { name, channel } of configuration.eventTypes) {
      const resolvedChannel = await resolveChannelString(channel, guild);
      if (
        resolvedChannel.type === ChannelType.GuildText ||
        resolvedChannel.type === ChannelType.GuildForum
      ) {
        closeOutdatedThreadsInChannel(resolvedChannel);
      }
    }
  }
}

export async function closeOutdatedThreadsInChannel(
  channel: ChannelWithThreads
) {
  const threads = await (await channel.threads.fetchActive()).threads;
  const client = configuration.discordClient;
  const now = new Date();
  if (!client) throw new Error("Client not set in configuration.");

  for (const [threadName, threadChannel] of threads) {
    const threadEvent = await deseralizePreviewEmbed(threadChannel, client);
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

export async function closeEventThread(
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

  const closeThreadsAfter = configuration.closeThreadsAfter ?? days(1);
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