import {
  APIEmbedField,
  ChannelType,
  EmbedBuilder,
  GuildScheduledEvent,
  GuildScheduledEventStatus,
} from "discord.js";
import Configuration from "../Configuration";
import { attendeeTags } from "../Content/Embed/attendees";
import { deseralizeEventEmbed } from "../Content/Embed/eventEmbed";
import { resolveChannelString } from "./resolveChannelString";
import Threads from "./Threads";
import Time from "./TimeUtilities";

export default async function performAnnouncements() {
  if (!Configuration.current.discordClient) return;

  try {
    for (const guild of Configuration.current.discordClient.guilds.cache.values()) {
      for (const event of await (
        await guild.scheduledEvents.fetch()
      ).values()) {
        performEventAnnouncement(event);
      }
    }
  } catch (error) {
    console.error(error);
  }
}

async function performEventAnnouncement(event: GuildScheduledEvent) {
  if (!event.description || !event.scheduledStartAt || !event.guild) return;

  const thread = await Threads.getThreadFromEventDescription(event.description);
  if (!thread) return;

  const eventType = Configuration.current.eventTypes.find(
    (x) =>
      x.discussionChannel === thread.parent?.id ||
      x.discussionChannel === thread.parent?.name
  );
  if (
    !eventType ||
    !eventType.announcement ||
    !eventType.announcement.beforeStart
  )
    return;

  const timeBeforeStart =
    event.scheduledStartAt.valueOf() - new Date().valueOf();

  if (
    timeBeforeStart < 0 ||
    timeBeforeStart > eventType.announcement.beforeStart ||
    event.status === GuildScheduledEventStatus.Active
  )
    return;

  const monkeyEvent = await deseralizeEventEmbed(thread, event.client);

  var idString = `Event ID: ${monkeyEvent.id}`;
  const announcementEmbed = new EmbedBuilder({
    title: "Event Reminder",
    description: `The event "${
      monkeyEvent.name
    }" hosted by ${monkeyEvent.author.toString()} will be starting in ${Math.round(
      timeBeforeStart / Time.toMilliseconds.minutes(1)
    )} minutes!`,
    footer: {
      text: idString,
    },
  }).setThumbnail(monkeyEvent.image);

  const announcementFields: APIEmbedField[] = [{ name: "Event Link", value: event.toString()}];
  if (event.channel) announcementFields.push({name: "Channel", value: event.channel.toString()});
  else announcementFields.push({ name: "Location", value: event.entityMetadata?.location ?? "" });

  announcementEmbed.addFields(announcementFields)

  let threadAnnouncement = (await thread.messages.fetch()).find((x) =>
    x.embeds.find(
      (x) => x.footer?.text === idString && x.title === "Event Reminder"
    )
  );

  if (!threadAnnouncement)
    thread.send({ embeds: [announcementEmbed] });

  const announcementChannels = Array.isArray(eventType.announcement.channel)
    ? eventType.announcement.channel
    : eventType.announcement.channel
    ? [eventType.announcement.channel]
    : [];

  for (const channelId of announcementChannels) {
    const announcementChannel = await resolveChannelString(
      channelId,
      event.guild
    );
    if (
      announcementChannel.type !== ChannelType.GuildText &&
      announcementChannel.type !== ChannelType.GuildAnnouncement
    )
      continue;

    const existingAnnouncement = (
      await announcementChannel.messages.fetch()
    ).find((x) =>
      x.embeds.find(
        (x) => x.footer?.text === idString && x.title === "Event Reminder"
      )
    );

    if (!existingAnnouncement) {
      announcementChannel.send({ embeds: [announcementEmbed] });
    }
  }
}
