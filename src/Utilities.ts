import {
  Channel,
  ChannelType,
  EmbedBuilder,
  Guild,
  GuildScheduledEventStatus,
  ThreadChannel,
} from "discord.js";
import { deseralizeEventEmbed } from "./Content/Embed/eventEmbed";
import {
  createForumChannelEvent,
  createGuildScheduledEvent,
} from "./EventCreators";
import { configuration } from "./EventMonkey";
import { getNextRecurrence } from "./Recurrence";
import { getAttendeeTags } from "./Serialization";
import { days, hours, minutes } from "./TimeConversion";

async function restartRecurringEvents() {
  if (!configuration.discordClient) return;

  const now = Date.now();
  for (const [
    guildName,
    guildAuth,
  ] of await configuration.discordClient.guilds.fetch()) {
    const guild = await guildAuth.fetch();
    for (const eventType of configuration.eventTypes) {
      const channel = await resolveChannelString(eventType.channel, guild);
      if (
        channel.type !== ChannelType.GuildText &&
        channel.type !== ChannelType.GuildForum
      )
        continue;

      for (const [threadName, thread] of await (
        await channel.threads.fetchActive()
      ).threads) {
        const threadPins = [...(await thread.messages.fetchPinned())];
        if (threadPins.length === 0) continue;
        if (
          threadPins.find(
            (x) => x[1].embeds.at(0)?.title === "Event is Canceled"
          )
        )
          continue;

        const eventMonkeyEvent = await deseralizeEventEmbed(
          thread,
          configuration.discordClient
        );
        if (
          eventMonkeyEvent.recurrence &&
          (!eventMonkeyEvent.scheduledEvent ||
            eventMonkeyEvent.scheduledEvent.status ===
              GuildScheduledEventStatus.Completed)
        ) {
          while (eventMonkeyEvent.scheduledStartTime.valueOf() < now) {
            eventMonkeyEvent.recurrence.timesHeld++;
            eventMonkeyEvent.scheduledStartTime = getNextRecurrence(
              eventMonkeyEvent.recurrence
            );
          }
          eventMonkeyEvent.scheduledEvent = undefined;
          eventMonkeyEvent.scheduledEvent = await createGuildScheduledEvent(
            eventMonkeyEvent,
            guild,
            thread
          );
          createForumChannelEvent(
            eventMonkeyEvent,
            guild,
            configuration.discordClient
          );
        }
      }
    }
  }
}

async function sendEventClosingMessage(
  thread: ThreadChannel,
  status:
    | GuildScheduledEventStatus.Canceled
    | GuildScheduledEventStatus.Completed
) {
  const completed = status === GuildScheduledEventStatus.Completed;
  let nextTime = (configuration.closeThreadsAfter ?? days(1)) / days(1);
  let timeUnit = "day";
  if (nextTime <= 1) {
    nextTime = (configuration.closeThreadsAfter ?? days(1)) / hours(1);
    timeUnit = "hour";
  }
  if (nextTime <= 1) {
    nextTime = (configuration.closeThreadsAfter ?? days(1)) / minutes(1);
    timeUnit = "minute";
  }

  nextTime = Math.round(nextTime);
  if (nextTime > 1) timeUnit += "s";

  const closeMessage = await thread.send({
    content: (await getAttendeeTags(thread)) ?? "",
    embeds: [
      new EmbedBuilder()
        .setTitle(`Event is ${completed ? "Over" : "Canceled"}`)
        .setDescription(
          `This event ${
            completed ? "is over" : "has been canceled"
          }. The thread will be locked and archived after ${nextTime} ${timeUnit} of inactivity.`
        ),
    ],
  });
  await closeMessage.pin();
}

export async function resolveChannelString(
  text: string,
  guild: Guild
): Promise<Channel> {
  if (text.match(/^\d+$/)) {
    const channel = await guild.channels.fetch(text);
    if (channel) return channel;
  }

  const channel = await guild.channels.cache.find(
    (x) =>
      (x.type === ChannelType.GuildText || x.type === ChannelType.GuildForum) &&
      x.name === text
  );
  if (channel) return channel;

  throw new Error(`Unable to resolve channel from string "${text}"`);
}
