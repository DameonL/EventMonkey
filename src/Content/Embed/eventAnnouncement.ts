import { APIEmbedField, EmbedBuilder } from "discord.js";
import { EventMonkeyEvent } from "../../EventMonkeyEvent";
import Time from "../../Utility/TimeUtilities";

export default function eventAnnouncement(
  event: EventMonkeyEvent,
  timeBeforeStart?: number
) {
  var idString = `Event ID: ${event.id}`;
  const startingString = timeBeforeStart
    ? `will be starting in ${Math.round(
        timeBeforeStart / Time.toMilliseconds.minutes(1)
      )} minutes`
    : `is starting now`;
  const announcementEmbed = new EmbedBuilder({
    title: "Event Reminder",
    description: `The event "${
      event.name
    }" hosted by ${event.author.toString()} ${startingString}!`,
    footer: {
      text: idString,
    },
  }).setThumbnail(event.image);

  const announcementFields: APIEmbedField[] = [
    { name: "Event Link", value: event.scheduledEvent?.toString() ?? event.threadChannel?.toString() ?? "" },
  ];
  if (event.channel)
    announcementFields.push({
      name: "Channel",
      value: event.channel.toString(),
    });
  else
    announcementFields.push({
      name: "Location",
      value: event.entityMetadata?.location ?? "",
    });

  announcementEmbed.addFields(announcementFields);

  return announcementEmbed;
}
