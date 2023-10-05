import { APIEmbed, APIEmbedField, GuildScheduledEventEntityType, GuildScheduledEventStatus } from "discord.js";
import { EventMonkeyEvent } from "../../EventMonkeyEvent";
import Time from "../../Utility/Time";

export default function eventAnnouncement(event: EventMonkeyEvent) {
  var idString = getFooter(event);
  const scheduledStart =
    event.scheduledEvent?.status === GuildScheduledEventStatus.Active
      ? undefined
      : event.scheduledEvent?.scheduledStartAt
      ? event.scheduledEvent.scheduledStartAt
      : event.scheduledStartTime;
  const timeBeforeStart = scheduledStart ? scheduledStart.valueOf() - new Date().valueOf() : undefined;

  const startingString =
    timeBeforeStart && timeBeforeStart > 0
      ? `will be starting in ${Time.getDurationDescription(timeBeforeStart)}`
      : `is starting now`;

  const announcementEmbed: APIEmbed = {
    title: getTitle(event),
    description: `The event "${event.name}" hosted by ${event.author.toString()} ${startingString}!`,
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

export function getTitle(event: EventMonkeyEvent) {
  const scheduledStart =
    event.scheduledEvent?.status === GuildScheduledEventStatus.Active
      ? undefined
      : event.scheduledEvent?.scheduledStartAt
      ? event.scheduledEvent.scheduledStartAt
      : event.scheduledStartTime;
  const timeBeforeStart = scheduledStart ? scheduledStart.valueOf() - new Date().valueOf() : undefined;

  return `${timeBeforeStart && timeBeforeStart > 0 ? "Upcoming " : ""}Event Reminder - ${Time.getTimeString(
    event.scheduledStartTime
  )}`;
}
