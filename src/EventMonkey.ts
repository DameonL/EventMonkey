import {
  Events,
  GuildScheduledEvent,
  GuildScheduledEventStatus,
} from "discord.js";

import { EventMonkeyConfiguration } from "./EventMonkeyConfiguration";
import { EventMonkeyEvent } from "./EventMonkeyEvent";
import { maintainEvents } from "./EventsUnderConstruction";

import {
  eventCompleted,
  eventStarted,
  userShowedInterest,
} from "./ClientEvents";
import { editEventCommand, eventCommand } from "./Commands";
import { listenForButtons } from "./Listeners";
import performAnnouncements from "./Utility/performAnnouncements";
import { restartRecurringEvents } from "./Utility/restartRecurringEvents";
import { sendEventClosingMessage } from "./Utility/sendEventClosingMessage";
import Threads from "./Utility/Threads";
import Time from "./Utility/Time";
export { EventMonkeyConfiguration, EventMonkeyEvent };
export { configuration };

let configuration: EventMonkeyConfiguration;

export default {
  commands: { create: eventCommand, edit: editEventCommand }, 
  getDefaultConfiguration,
  configure,
};

function getDefaultConfiguration(): EventMonkeyConfiguration {
  return {
    commandName: "event",
    eventTypes: [],
    editingTimeout: Time.toMilliseconds.minutes(30),
  };
}

async function configure(newConfiguration: EventMonkeyConfiguration) {
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

        const thread = await Threads.getThreadFromEventDescription(
          guildScheduledEvent.description
        );

        if (thread) {
          sendEventClosingMessage(thread, GuildScheduledEventStatus.Canceled);
          await Threads.closeEventThread(thread, guildScheduledEvent);
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

    Threads.closeAllOutdatedThreads();
    restartRecurringEvents();
    performAnnouncements();
    startRecurringTasks();
  }
}

function startRecurringTasks() {
  setInterval(maintainEvents, Time.toMilliseconds.hours(1));
  setInterval(Threads.closeAllOutdatedThreads, Time.toMilliseconds.minutes(30));
  setInterval(performAnnouncements, Time.toMilliseconds.minutes(1));
}
