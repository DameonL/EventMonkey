import { ChannelType, GuildScheduledEvent, GuildScheduledEventStatus } from "discord.js";
import Configuration from "../Configuration";
import eventAnnouncement from "../Content/Embed/eventAnnouncement";
import { deseralizeEventEmbed } from "../Content/Embed/eventEmbed";
import { resolveChannelString } from "./resolveChannelString";
import Threads from "./Threads";
import logger from "../Logger";

export default async function performAnnouncements() {
  if (!Configuration.current.discordClient) return;

  try {
    for (const guild of Configuration.current.discordClient.guilds.cache.values()) {
      for (const event of (await guild.scheduledEvents.fetch()).values()) {
        performEventAnnouncement(event);
      }
    }
  } catch (error) {
    logger.error("Error while performing announcments", error);
  }
}

async function performEventAnnouncement(event: GuildScheduledEvent) {
  if (!event.description || !event.scheduledStartAt || !event.guild) return;

  const thread = await Threads.getThreadFromEventDescription(event.description);
  if (!thread) return;

  const eventType = Configuration.current.eventTypes.find(
    (x) => x.discussionChannel === thread.parent?.id || x.discussionChannel === thread.parent?.name
  );
  if (!eventType || !eventType.announcement || !eventType.announcement.beforeStart) return;

  const timeBeforeStart = event.scheduledStartAt.valueOf() - new Date().valueOf();

  if (
    timeBeforeStart < 0 ||
    timeBeforeStart > eventType.announcement.beforeStart ||
    event.status === GuildScheduledEventStatus.Active
  )
    return;

  const monkeyEvent = await deseralizeEventEmbed(thread, event.client);
  const announcementEmbed = eventAnnouncement(monkeyEvent, timeBeforeStart);

  let threadAnnouncement = (await thread.messages.fetch()).find((x) =>
    x.embeds.find((x) => x.footer?.text === announcementEmbed.footer?.text && x.title === announcementEmbed.title)
  );

  try {
    if (!threadAnnouncement) thread.send({ embeds: [announcementEmbed] });
  } catch (error) {
    logger.error("Error sending event announcement to thread:", { announcementEmbed, error });
  }

  const announcementChannels = Array.isArray(eventType.announcement.channel)
    ? eventType.announcement.channel
    : eventType.announcement.channel
    ? [eventType.announcement.channel]
    : [];

  for (const channelId of announcementChannels) {
    const announcementChannel = await resolveChannelString(channelId, event.guild);
    if (
      !announcementChannel ||
      (announcementChannel.type !== ChannelType.GuildText && announcementChannel.type !== ChannelType.GuildAnnouncement)
    )
      continue;

    const existingAnnouncement = (await announcementChannel.messages.fetch()).find((x) =>
      x.embeds.find((x) => x.footer?.text === announcementEmbed.footer?.text && x.title === announcementEmbed.title)
    );

    if (!existingAnnouncement) {
      try {
        announcementChannel.send({ embeds: [announcementEmbed] });
      } catch (error) {
        logger.error("Error sending event announcement to channel:", { announcementEmbed, error });
      }
    }
  }
}
