import { APIEmbed, APIEmbedField, GuildScheduledEventEntityType, GuildScheduledEventStatus } from "discord.js";
import { EventAnnouncement, EventAnnouncementType } from "../../EventMonkeyConfiguration";
import { EventMonkeyEvent } from "../../EventMonkeyEvent";
import logger from "../../Logger";
import Time from "../../Utility/Time";

export default async function eventAnnouncement(event: EventMonkeyEvent, announcement: EventAnnouncement) {
  var idString = getFooter(event);

  if (!event.scheduledEvent) {
    logger.error(event);
    throw new Error("Expected a scheduled event associated with MonkeyEvent, but there was none.");
  }

  const scheduledStart =
    event.scheduledEvent?.status === GuildScheduledEventStatus.Active
      ? undefined
      : event.scheduledEvent?.scheduledStartAt
      ? event.scheduledEvent.scheduledStartAt
      : event.scheduledStartTime;
  const scheduledEnd =
    event.scheduledEvent?.status !== GuildScheduledEventStatus.Active
      ? undefined
      : event.scheduledEvent?.scheduledEndAt
      ? event.scheduledEvent.scheduledEndAt
      : event.scheduledEndTime;

  const timeBeforeStart = scheduledStart ? scheduledStart.valueOf() - new Date().valueOf() : undefined;
  const timeBeforeEnd = scheduledEnd ? scheduledEnd.valueOf() - new Date().valueOf() : undefined;

  const startingString =
    announcement.type === EventAnnouncementType.starting
      ? `will be starting in ${timeBeforeStart ? Time.getDurationDescription(timeBeforeStart) : "ERROR"}`
      : announcement.type === EventAnnouncementType.started
      ? `is starting now`
      : announcement.type === EventAnnouncementType.ended
      ? `has ended`
      : announcement.type === EventAnnouncementType.ending
      ? `will be ending in ${timeBeforeEnd ? Time.getDurationDescription(timeBeforeEnd) : "ERROR"}`
      : undefined;

  const announcementEmbed: APIEmbed = {
    title: await getTitle(event, announcement),
    description: `The event "${event.name}" hosted by ${event.author.displayName} ${startingString}!`,
    footer: {
      text: idString,
    },
  };

  if (event.image) {
    announcementEmbed.thumbnail = { url: event.image };
  }

  const announcementFields: APIEmbedField[] = [
    {
      name: "Event Link",
      value: event.scheduledEvent?.toString() ?? event.threadChannel?.toString() ?? "",
    },
  ];

  announcementEmbed.fields = announcementFields;

  if (event.entityType !== GuildScheduledEventEntityType.External) {
    announcementFields.push({
      name: "Channel",
      value: event.channel?.toString() ?? "Not yet chosen",
    });
  } else {
    announcementFields.push({
      name: "Location",
      value: event.entityMetadata.location ?? "",
    });
  }
  return announcementEmbed;
}

export function getFooter(event: EventMonkeyEvent) {
  return `Event ID: ${event.id}`;
}

export async function getTitle(event: EventMonkeyEvent, announcement: EventAnnouncement) {
  if (!event.scheduledEvent) {
    throw new Error("Could not get GuildScheduledEvent from EventMonkeyEvent.");
  }

  switch (announcement.type) {
    case EventAnnouncementType.starting:
      return `Upcoming Event Reminder - ${await Time.getTimeString(
        event.scheduledStartTime,
        event.scheduledEvent.guildId
      )} (${Time.getDurationDescription(announcement.timeBefore)})`;

    case EventAnnouncementType.started:
      return `Event Starting - ${await Time.getTimeString(event.scheduledStartTime, event.scheduledEvent.guildId)}`;

    case EventAnnouncementType.ending:
      return `Event Ending Soon - ${
        event.scheduledEvent?.scheduledEndAt
          ? await Time.getTimeString(event.scheduledEvent?.scheduledEndAt, event.scheduledEvent.guildId)
          : event.name
      } (${Time.getDurationDescription(announcement.timeBefore)})`;

    case EventAnnouncementType.ended:
      return `Event Ending - ${
        event.scheduledEvent?.scheduledEndAt
          ? await Time.getTimeString(event.scheduledEvent?.scheduledEndAt, event.scheduledEvent.guildId)
          : event.name
      }`;
  }
}
