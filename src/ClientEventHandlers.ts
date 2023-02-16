import { ChannelType, EmbedBuilder, GuildScheduledEvent, GuildScheduledEventStatus, User } from "discord.js";
import Configuration from "./Configuration";
import { deseralizeEventEmbed } from "./Content/Embed/eventEmbed";
import { createForumChannelEvent, createGuildScheduledEvent } from "./EventCreators";
import { getNextRecurrence } from "./Recurrence";
import { getAttendeeTags } from "./Utility/Attendees";
import { resolveChannelString } from "./Utility/resolveChannelString";
import { sendEventClosingMessage } from "./Utility/sendEventClosingMessage";
import Threads from "./Utility/Threads";
import Time from "./Utility/TimeUtilities";

export default {
  eventStarted,
  eventCompleted,
  userShowedInterest
}

async function eventStarted(
  oldEvent: GuildScheduledEvent | null,
  event: GuildScheduledEvent
) {
  if (!event.description || !event.scheduledStartAt) return;
  if (!Configuration.current.discordClient) return;

  const thread = await Threads.getThreadFromEventDescription(event.description);
  if (!thread) return;
  const monkeyEvent = await deseralizeEventEmbed(
    thread,
    Configuration.current.discordClient
  );
  var idString = `Event ID: ${monkeyEvent.id}`;

  const eventType = Configuration.current.eventTypes.find(
    (x) => x.channel === thread.parent?.id || x.channel === thread.parent?.name
  );
  if (!eventType || !eventType.announcement || !eventType.announcement.onStart)
    return;

  const message = {
    content: (await getAttendeeTags(thread)) ?? "",
    embeds: [
      new EmbedBuilder({
        title: "Event Starting",
        description: `The event "${
          monkeyEvent.name
        }" hosted by ${monkeyEvent.author.toString()} is starting now!\nEvent link: ${
          event.url
        }`,
        footer: {
          text: idString,
        },
      }),
    ],
  };

  thread.send(message);
  const announcementChannels = Array.isArray(eventType.announcement.channel)
    ? eventType.announcement.channel
    : eventType.announcement.channel
    ? [eventType.announcement.channel]
    : [];

  for (const channelId of announcementChannels) {
    if (!event.guild) continue;

    const announcementChannel = await resolveChannelString(
      channelId,
      event.guild
    );

    if (
      !announcementChannel ||
      (announcementChannel.type !== ChannelType.GuildText &&
        announcementChannel.type !== ChannelType.GuildAnnouncement)
    )
      continue;

    announcementChannel.send(message);
  }
}

async function eventCompleted(
  oldEvent: GuildScheduledEvent | null,
  event: GuildScheduledEvent
) {
  if (!event.guild || !event.description) return;

  try {
    const thread = await Threads.getThreadFromEventDescription(event.description);
    if (thread && !thread.archived) {
      const eventMonkeyEvent = await deseralizeEventEmbed(thread, event.client);

      if (eventMonkeyEvent.recurrence) {
        const now = Date.now();
        let nextStartDate: Date;
        do {
          eventMonkeyEvent.recurrence.timesHeld++;
          nextStartDate = getNextRecurrence(eventMonkeyEvent.recurrence);
        }
        while (nextStartDate.valueOf() < now);
        
        eventMonkeyEvent.scheduledStartTime = nextStartDate;
        eventMonkeyEvent.scheduledEndTime = new Date(nextStartDate);
        eventMonkeyEvent.scheduledEndTime.setHours(
          eventMonkeyEvent.scheduledEndTime.getHours() +
            eventMonkeyEvent.duration
        );
        eventMonkeyEvent.scheduledEvent = undefined;
        eventMonkeyEvent.scheduledEvent = await createGuildScheduledEvent(
          eventMonkeyEvent,
          event.guild,
          thread
        );

        await createForumChannelEvent(
          eventMonkeyEvent,
          event.guild,
          event.client
        );
        await thread.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("Event is over")
              .setDescription(
                `We'll see you next time at ${Time.getTimeString(nextStartDate)}!`
              ),
          ],
        });
      } else {
        sendEventClosingMessage(thread, GuildScheduledEventStatus.Completed);
        await Threads.closeEventThread(thread, event);
      }
    }
  } catch (error) {
    console.error(error);
  }
}

async function userShowedInterest(
  guildScheduledEvent: GuildScheduledEvent<GuildScheduledEventStatus>,
  user: User
) {
  if (!guildScheduledEvent.description) return;

  const thread = await Threads.getThreadFromEventDescription(
    guildScheduledEvent.description
  );

  if (!thread) return;

  await user.send({
    content: `Hi ${user.username}, I noticed you showed interest in ${guildScheduledEvent.name}!\nIf you'd like to signal you're attending, please visit the discussion thread at ${thread.url} and click the "Attending" button! You can always update your RSVP status if you change your mind!`,
  });
}
