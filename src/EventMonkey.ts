import {
  ChannelType,
  EmbedBuilder,
  Events,
  GuildScheduledEvent,
  GuildScheduledEventStatus,
  ThreadChannel,
  User,
} from "discord.js";
import { deseralizeEventEmbed } from "./Content/Embed/eventEmbed";

import {
  createForumChannelEvent,
  createGuildScheduledEvent,
} from "./EventCreators";
import { EventMonkeyConfiguration } from "./EventMonkeyConfiguration";
import { EventMonkeyEvent } from "./EventMonkeyEvent";
import { maintainEvents } from "./EventsUnderConstruction";
import { getNextRecurrence } from "./Recurrence";
import { getAttendeeTags, getTimeString } from "./Serialization";
import {
  closeAllOutdatedThreads,
  closeEventThread,
  getThreadFromEventDescription,
} from "./ThreadUtilities";
import { hours, minutes } from "./TimeConversion";

import { performAnnouncements } from "./Announcements";
import { editEventCommand, eventCommand } from "./Commands";
import { listenForButtons } from "./Listeners";
import { resolveChannelString } from "./Utilities";
const commands = { create: eventCommand, edit: editEventCommand };
export { commands };
export { EventMonkeyConfiguration, EventMonkeyEvent };
export { configuration };

let configuration: EventMonkeyConfiguration;

export function getDefaultConfiguration(): EventMonkeyConfiguration {
  return {
    commandName: "event",
    eventTypes: [],
    editingTimeout: minutes(30),
  };
}

export async function configure(newConfiguration: EventMonkeyConfiguration) {
  const cachedClient = configuration?.discordClient;
  configuration = newConfiguration;

  if (configuration.eventTypes.length === 0) {
    throw new Error(
      "You must define at least one event type in the configuration."
    );
  }

  const client = configuration.discordClient;
  if (client && client !== cachedClient) {
    listenForButtons();
    client.on(
      Events.GuildScheduledEventDelete,
      async (guildScheduledEvent: GuildScheduledEvent) => {
        if (!guildScheduledEvent.description) return;

        const thread = await getThreadFromEventDescription(
          guildScheduledEvent.description
        );

        if (thread) {
          sendEventClosingMessage(thread, GuildScheduledEventStatus.Canceled);
          closeEventThread(thread, guildScheduledEvent);
        }
      }
    );

    client.on(Events.GuildScheduledEventUserAdd, userShowedInterest);
    client.on(
      Events.GuildScheduledEventUpdate,
      (oldEvent: GuildScheduledEvent | null, event: GuildScheduledEvent) => {
        if (event.status === GuildScheduledEventStatus.Active) {
          eventStarted(oldEvent, event);
        } else if (event.status === GuildScheduledEventStatus.Completed) {
          eventCompleted(oldEvent, event);
        }
      }
    );

    closeAllOutdatedThreads();
    restartRecurringEvents();
    performAnnouncements();
    startRecurringTasks();
  }
}

function startRecurringTasks() {
  setInterval(maintainEvents, hours(1));
  setInterval(closeAllOutdatedThreads, minutes(30));
  setInterval(performAnnouncements, minutes(1));
}

async function eventStarted(
  oldEvent: GuildScheduledEvent | null,
  event: GuildScheduledEvent
) {
  if (!event.description || !event.scheduledStartAt) return;
  if (!configuration.discordClient) return;

  const thread = await getThreadFromEventDescription(event.description);
  if (!thread) return;
  const monkeyEvent = await deseralizeEventEmbed(
    thread,
    configuration.discordClient
  );
  var idString = `Event ID: ${monkeyEvent.id}`;

  const eventType = configuration.eventTypes.find(
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
    const thread = await getThreadFromEventDescription(event.description);
    if (thread && !thread.archived) {
      const eventMonkeyEvent = await deseralizeEventEmbed(thread, event.client);

      if (eventMonkeyEvent.recurrence) {
        const nextStartDate = getNextRecurrence(eventMonkeyEvent.recurrence);
        eventMonkeyEvent.scheduledStartTime = nextStartDate;
        eventMonkeyEvent.scheduledEndTime = new Date(nextStartDate);
        eventMonkeyEvent.scheduledEndTime.setHours(
          eventMonkeyEvent.scheduledEndTime.getHours() +
            eventMonkeyEvent.duration
        );
        eventMonkeyEvent.recurrence.timesHeld++;
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
                `We'll see you next time at ${getTimeString(nextStartDate)}!`
              ),
          ],
        });
      } else {
        sendEventClosingMessage(thread, GuildScheduledEventStatus.Completed);
        await closeEventThread(thread, event);
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

  const thread = await getThreadFromEventDescription(
    guildScheduledEvent.description
  );

  if (!thread) return;

  await user.send({
    content: `Hi ${user.username}, I noticed you showed interest in ${guildScheduledEvent.name}!\nIf you'd like to signal you're attending, please visit the discussion thread at ${thread.url} and click the "Attending" button! You can always update your RSVP status if you change your mind!`,
  });
}

function sendEventClosingMessage(
  thread: ThreadChannel<boolean>,
  Canceled: GuildScheduledEventStatus
) {
  throw new Error("Function not implemented.");
}

function restartRecurringEvents() {
  throw new Error("Function not implemented.");
}
