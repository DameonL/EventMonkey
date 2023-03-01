import { ChannelType, GuildScheduledEventStatus } from "discord.js";
import Configuration from "../Configuration";
import { deseralizeEventEmbed } from "../Content/Embed/eventEmbed";
import EventCreators from "../EventCreators";
import { getNextRecurrence } from "../Recurrence";
import { resolveChannelString } from "./resolveChannelString";

export async function restartRecurringEvents() {
  const configuration = Configuration.current;

  if (!configuration.discordClient) return;

  const now = Date.now() + configuration.timeZone.offset;
  for (const [
    guildName,
    guildAuth,
  ] of await configuration.discordClient.guilds.fetch()) {
    const guild = await guildAuth.fetch();
    for (const eventType of configuration.eventTypes) {
      const channel = await resolveChannelString(eventType.discussionChannel, guild);
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
            eventMonkeyEvent.scheduledStartTime = getNextRecurrence(
              eventMonkeyEvent.recurrence
            );
            eventMonkeyEvent.recurrence.timesHeld++;
          }
          eventMonkeyEvent.scheduledEvent = undefined;
          eventMonkeyEvent.scheduledEvent = await EventCreators.createGuildScheduledEvent(
            eventMonkeyEvent,
            guild,
            thread
          );
          await EventCreators.createThreadChannelEvent(
            eventMonkeyEvent,
            guild,
          );
        }
      }
    }
  }
}
