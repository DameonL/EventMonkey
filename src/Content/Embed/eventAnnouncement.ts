import { APIEmbed, APIEmbedField, GuildScheduledEventEntityType } from "discord.js";
import { EventMonkeyEvent } from "../../EventMonkeyEvent";
import Time from "../../Utility/Time";
import { EventAnnouncement } from "../../EventMonkeyConfiguration";

export default function eventAnnouncement(event: EventMonkeyEvent) {
  var idString = getFooter(event);
  const timeBeforeStart = event.scheduledStartTime.valueOf() - new Date().valueOf();

  const startingString = timeBeforeStart
    ? `will be starting in ${Math.round(timeBeforeStart / Time.toMilliseconds.minutes(1))} minutes`
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
  const timeBeforeStart = event.scheduledEvent?.scheduledStartAt?.valueOf() ?? new Date().valueOf() - new Date().valueOf();

  return `${timeBeforeStart ? "Upcoming " : ""}Event Reminder - ${Time.getTimeString(event.scheduledStartTime)}`
}