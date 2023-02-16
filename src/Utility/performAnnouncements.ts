import {
  ChannelType,
  EmbedBuilder,
  GuildScheduledEvent,
  GuildScheduledEventStatus,
} from "discord.js";
import { deseralizeEventEmbed } from "../Content/Embed/eventEmbed";
import { configuration } from "../EventMonkey";
import { getAttendeeTags } from "./Attendees";
import { resolveChannelString } from "./resolveChannelString";
import Threads from "./Threads";
import Time from "./Time";

export default async function performAnnouncements() {
  if (!configuration.discordClient) return;

  try {
    for (const guild of configuration.discordClient.guilds.cache.values()) {
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

  const eventType = configuration.eventTypes.find(
    (x) => x.channel === thread.parent?.id || x.channel === thread.parent?.name
  );
  if (
    !eventType ||
    !eventType.announcement ||
    !eventType.announcement.beforeStart
  )
    return;

  const timeBeforeStart = event.scheduledStartAt.valueOf() - Date.now();
  if (
    timeBeforeStart < 0 ||
    timeBeforeStart > eventType.announcement.beforeStart ||
    event.status === GuildScheduledEventStatus.Active
  )
    return;

  const monkeyEvent = await deseralizeEventEmbed(thread, event.client);

  var idString = `Event ID: ${monkeyEvent.id}`;
  const announcementMessage = {
    content: (await getAttendeeTags(thread)) ?? "",
    embeds: [
      new EmbedBuilder({
        title: "Event Reminder",
        description: `The event "${
          monkeyEvent.name
        }" hosted by ${monkeyEvent.author.toString()} will be starting in ${Math.round(
          timeBeforeStart / Time.toMilliseconds.minutes(1)
        )} minutes!\nEvent link: ${event.url}`,
        footer: {
          text: idString,
        },
      }),
    ],
  };

  let threadAnnouncement = (await thread.messages.fetch()).find((x) =>
    x.embeds.find(
      (x) => x.footer?.text === idString && x.title === "Event Reminder"
    )
  );

  if (!threadAnnouncement) thread.send(announcementMessage);

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
      announcementChannel.send(announcementMessage);
    }
  }
}
