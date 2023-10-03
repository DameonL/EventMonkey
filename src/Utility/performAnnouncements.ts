import { APIEmbed, ChannelType, GuildScheduledEvent, GuildScheduledEventStatus } from "discord.js";
import Configuration from "../Configuration";
import { attendeeTags } from "../Content/Embed/attendees";
import eventAnnouncement, { getFooter, getTitle } from "../Content/Embed/eventAnnouncement";
import { deseralizeEventEmbed } from "../Content/Embed/eventEmbed";
import { EventAnnouncement } from "../EventMonkeyConfiguration";
import { EventMonkeyEvent } from "../EventMonkeyEvent";
import logger from "../Logger";
import Threads from "./Threads";
import { resolveChannelString } from "./resolveChannelString";

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

  const announcementEmbed = eventAnnouncement(monkeyEvent);

  for (const announcement of eventType.announcements) {
    performEventAnnouncement({ announcement, event: monkeyEvent, announcementEmbed });
  }
}

export async function performEventThreadAnnouncement(options: {
  announcement: EventAnnouncement;
  announcementEmbed: APIEmbed;
  event: EventMonkeyEvent;
}) {
  const thread = options.event.threadChannel;
  if (!thread) {
    return;
  }

  let threadAnnouncement = (await thread.messages.fetch()).find((x) =>
    x.embeds.find((x) => x.footer?.text === getFooter(options.event) && x.title === getTitle(options.event))
  );

  if (!threadAnnouncement) {
    return;
  }

  try {
    thread.send({ content: await getAnnouncementMessage(options), embeds: [options.announcementEmbed] });
  } catch (error) {
    logger.error("Error sending event announcement to thread:", {
      announcementEmbed: options.announcementEmbed,
      error,
    });
  }
}

async function getAnnouncementMessage(options: {
  announcement: EventAnnouncement;
  event: EventMonkeyEvent;
}): Promise<string> {
  if (!options.event.threadChannel) {
    return "";
  }

  let attendeeMentions = "";
  if (options.announcement.mention) {
    const mentionOptions = options.announcement.mention;

    if (mentionOptions.attendees) {
      attendeeMentions += `${attendeeMentions !== "" ? " " : ""}${await attendeeTags(options.event.threadChannel)}`;
    }

    if (mentionOptions.everyone) {
      attendeeMentions += `${attendeeMentions !== "" ? " " : ""}@everyone`;
    }

    if (mentionOptions.here) {
      attendeeMentions += `${attendeeMentions !== "" ? " " : ""}@here`;
    }
  }

  const content = `${options.announcement.message ? options.announcement.message + "\n" : ""}${attendeeMentions}`;
  return content;
}

export async function performEventAnnouncement(options: {
  announcement: EventAnnouncement;
  event: EventMonkeyEvent;
  announcementEmbed: APIEmbed;
}) {
  if (!options.event.scheduledEvent?.scheduledStartAt) {
    return;
  }

  const timeBeforeStart = options.event.scheduledStartTime.valueOf() - new Date().valueOf();

  if (
    !options.event.scheduledEvent.guild ||
    !options.announcement.beforeStart ||
    timeBeforeStart < 0 ||
    timeBeforeStart > options.announcement.beforeStart ||
    options.event.scheduledEvent.status === GuildScheduledEventStatus.Active
  ) {
    return;
  }

  const announcementChannels = Array.isArray(options.announcement.channel)
    ? options.announcement.channel
    : options.announcement.channel
    ? [options.announcement.channel]
    : [];

  for (const channelId of announcementChannels) {
    const announcementChannel = await resolveChannelString(channelId, options.event.scheduledEvent.guild);
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
        announcementChannel.send({
          content: await getAnnouncementMessage({ announcement: options.announcement, event: options.event }),
          embeds: [options.announcementEmbed],
        });
      } catch (error) {
        logger.error("Error sending event announcement to channel:", { embed: options.announcementEmbed, error });
      }
    }
  }
}
