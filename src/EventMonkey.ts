import {
  Events,
  GuildScheduledEvent,
  GuildScheduledEventStatus,
  REST,
  Routes,
} from "discord.js";

import { EventMonkeyConfiguration } from "./EventMonkeyConfiguration";
import { EventMonkeyEvent } from "./EventMonkeyEvent";
import EventsUnderConstruction from "./EventsUnderConstruction";

import ClientEventHandlers from "./ClientEventHandlers";
import { editEventCommand, eventCommand } from "./Commands";
import Listeners from "./Listeners";
import performAnnouncements from "./Utility/performAnnouncements";
import { restartRecurringEvents } from "./Utility/restartRecurringEvents";
import { sendEventClosingMessage } from "./Utility/sendEventClosingMessage";
import Threads from "./Utility/Threads";
import Time from "./Utility/TimeUtilities";
import Configuration from "./Configuration";
export { EventMonkeyConfiguration, EventMonkeyEvent };

export default {
  commands: { create: eventCommand, edit: editEventCommand }, 
  defaultConfiguration: Configuration.defaultConfiguration,
  configure,
  registerCommands,
};

async function registerCommands() {
  if (!Configuration.current.discordClient?.user?.id) {
    throw new Error(`discordClient in the configuration must be set before commands can be registered.`);
  }

  const rest = new REST({ version: "10" });
  await rest.put(Routes.applicationCommands(Configuration.current.discordClient?.user?.id), { body: [eventCommand.builder(), editEventCommand.builder()]})
}

async function configure(newConfiguration: EventMonkeyConfiguration) {
  const cachedClient = Configuration.current.discordClient;
  Configuration.current = newConfiguration;

  if (Configuration.current.eventTypes.length === 0) {
    throw new Error(
      "You must define at least one event type in the configuration."
    );
  }

  const client = Configuration.current.discordClient;
  if (client && client !== cachedClient) {
    await Listeners.listenForButtons();
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

    client.on(Events.GuildScheduledEventUserAdd, ClientEventHandlers.userShowedInterest);
    client.on(
      Events.GuildScheduledEventUpdate,
      (oldEvent: GuildScheduledEvent | null, event: GuildScheduledEvent) => {
        if (event.status === GuildScheduledEventStatus.Active) {
          ClientEventHandlers.eventStarted(oldEvent, event);
        } else if (event.status === GuildScheduledEventStatus.Completed) {
          ClientEventHandlers.eventCompleted(oldEvent, event);
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
  setInterval(EventsUnderConstruction.maintainEvents, Time.toMilliseconds.hours(1));
  setInterval(Threads.closeAllOutdatedThreads, Time.toMilliseconds.minutes(30));
  setInterval(performAnnouncements, Time.toMilliseconds.minutes(1));
}
