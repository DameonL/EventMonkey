import {
  ChannelType,
  EmbedBuilder,
  GuildForumThreadManager,
  ThreadChannel,
} from "discord.js";
import { configuration } from "./EventMonkey";
import { deseralizePreviewEmbed, getEventNameAndStart } from "./Serialization";

interface ChannelWithThreads {
  threads: GuildForumThreadManager;
}

export async function sortEventThreads(channel: ChannelWithThreads) {
  const threadMessages = [
    ...(await (await channel.threads.fetchActive()).threads.values()),
  ].sort((a, b) => {
    const aStart = getEventNameAndStart(a.name).scheduledStartTime.valueOf();
    const bStart = getEventNameAndStart(b.name).scheduledStartTime.valueOf();

    if (aStart === bStart) return 0;
    return aStart > bStart ? -1 : 1;
  });

  for (const threadMessage of threadMessages) {
    await (await threadMessage.send("Delete me")).delete();
  }
}

export async function closeAllOutdatedThreads() {
  for (const { name, channelId } of configuration.eventTypes) {
    const channel = await configuration.discordClient?.channels.fetch(
      channelId
    );
    if (channel && channel.type === ChannelType.GuildForum) {
      closeOutdatedThreadsInChannel(channel);
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
      (threadEvent.scheduledEvent?.isCompleted() ||
        threadEvent.scheduledEvent?.isCanceled())
    ) {
      closeEventThread(
        threadChannel,
        `Event is ${
          threadEvent.scheduledEvent?.isCanceled() ? "Canceled" : "Over"
        }`
      );
    }
  }
}

export async function closeEventThread(thread: ThreadChannel, reason: string) {
  if (thread.archived) return;

  const pinnedMessage = (await thread.messages.fetchPinned()).at(0);
  if (pinnedMessage) {
    await pinnedMessage.edit({ components: [] });
  }

  await (
    await thread.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(reason)
          .setDescription("Thread has been locked and archived.")
          .setColor("DarkRed"),
      ],
    })
  ).pin();

  await thread.setLocked(true);
  await thread.setArchived(true);
  await sortAllEventThreads();
}

export async function sortAllEventThreads() {
  for (const eventChannel of configuration.eventTypes) {
    const channel = await configuration.discordClient?.channels.fetch(
      eventChannel.channelId
    );

    if (channel?.type === ChannelType.GuildForum) {
      await sortEventThreads(channel);
    }
  }
}
