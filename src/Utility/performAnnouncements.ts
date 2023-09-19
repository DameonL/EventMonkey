import {
  APIEmbed,
  ChannelType,
  GuildScheduledEvent,
  GuildScheduledEventStatus,
  Message,
  ThreadChannel,
} from "discord.js";
import Configuration from "../Configuration";
import { attendeeTags } from "../Content/Embed/attendees";
import eventAnnouncement from "../Content/Embed/eventAnnouncement";
import { deseralizeEventEmbed } from "../Content/Embed/eventEmbed";
import { EventAnnouncement } from "../EventMonkeyConfiguration";
import logger from "../Logger";
import { resolveChannelString } from "./resolveChannelString";
import Threads from "./Threads";

export async function performAnnouncements() {
  if (!Configuration.current.discordClient) return;

  try {
    for (const guild of Configuration.current.discordClient.guilds.cache.values()) {
      for (const event of (await guild.scheduledEvents.fetch()).values()) {
        performEventAnnouncements(event);
      }
    }
  } catch (error) {
    logger.error("Error while performing announcments", error);
  }
}

export async function performEventAnnouncements(event: GuildScheduledEvent) {
  if (!event.description || !event.scheduledStartAt || !event.guild) return;

  const thread = await Threads.getThreadFromEventDescription(event.description);
  if (!thread) return;

  const eventType = Configuration.current.eventTypes.find(
    (x) => x.discussionChannel === thread.parent?.id || x.discussionChannel === thread.parent?.name
  );
  if (!eventType || !eventType.announcements) return;

  const monkeyEvent = await deseralizeEventEmbed(thread, event.client);
  if (!monkeyEvent) {
    return;
  }

  const timeBeforeStart = event.scheduledStartAt.valueOf() - new Date().valueOf();

  const announcementEmbed = eventAnnouncement(monkeyEvent, timeBeforeStart);

  let threadAnnouncement = (await thread.messages.fetch()).find((x) =>
    x.embeds.find((x) => x.footer?.text === announcementEmbed.footer?.text && x.title === announcementEmbed.title)
  );

  for (const announcement of eventType.announcements) {
    performEventAnnouncement({ announcement, event, threadAnnouncement, thread, announcementEmbed });
  }
}

export async function performEventAnnouncement(options: {
  announcement: EventAnnouncement;
  event: GuildScheduledEvent;
  threadAnnouncement: Message | undefined;
  thread: ThreadChannel;
  announcementEmbed: APIEmbed;
}) {
  if (!options.event.scheduledStartAt) {
    return;
  }

  const timeBeforeStart = options.event.scheduledStartAt.valueOf() - new Date().valueOf();

  if (
    !options.event.guild ||
    !options.announcement.beforeStart ||
    timeBeforeStart < 0 ||
    timeBeforeStart > options.announcement.beforeStart ||
    options.event.status === GuildScheduledEventStatus.Active
  ) {
    return;
  }

  let content = "";
  if (options.announcement.mention) {
    const mentionOptions = options.announcement.mention;

    if (mentionOptions.attendees) {
      content += `${content !== "" ? " " : ""}${await attendeeTags(options.thread)}`;
    }

    if (mentionOptions.everyone) {
      content += `${content !== "" ? " " : ""}@everyone`;
    }

    if (mentionOptions.here) {
      content += `${content !== "" ? " " : ""}@here`;
    }
  }

  try {
    if (!options.threadAnnouncement) options.thread.send({ content, embeds: [options.announcementEmbed] });
  } catch (error) {
    logger.error("Error sending event announcement to thread:", {
      announcementEmbed: options.threadAnnouncement,
      error,
    });
  }

  const announcementChannels = Array.isArray(options.announcement.channel)
    ? options.announcement.channel
    : options.announcement.channel
    ? [options.announcement.channel]
    : [];

  for (const channelId of announcementChannels) {
    const announcementChannel = await resolveChannelString(channelId, options.event.guild);
    if (
      !announcementChannel ||
      (announcementChannel.type !== ChannelType.GuildText && announcementChannel.type !== ChannelType.GuildAnnouncement)
    )
      continue;

    const existingAnnouncement = (await announcementChannel.messages.fetch()).find((x) =>
      x.embeds.find(
        (x) => x.footer?.text === options.announcementEmbed.footer?.text && x.title === options.announcementEmbed.title
      )
    );

    if (!existingAnnouncement) {
      try {
        announcementChannel.send({ content, embeds: [options.announcementEmbed] });
      } catch (error) {
        logger.error("Error sending event announcement to channel:", { embed: options.announcementEmbed, error });
      }
    }
  }
}
