import {
  Events,
  GuildScheduledEvent,
  GuildScheduledEventStatus,
  Routes,
} from "discord.js";

import { EventMonkeyConfiguration } from "./EventMonkeyConfiguration";
import { EventMonkeyEvent } from "./EventMonkeyEvent";
import EventsUnderConstruction from "./EventsUnderConstruction";

import ClientEventHandlers from "./ClientEventHandlers";
import { eventCommand } from "./Commands";
import Configuration from "./Configuration";
import Listeners from "./Listeners";
import performAnnouncements from "./Utility/performAnnouncements";
import { restartRecurringEvents } from "./Utility/restartRecurringEvents";
import { sendEventClosingMessage } from "./Utility/sendEventClosingMessage";
import Threads from "./Utility/Threads";
import Time from "./Utility/TimeUtilities";
export { EventMonkeyConfiguration, EventMonkeyEvent };

export default {
  command: eventCommand,
  defaultConfiguration: Configuration.defaultConfiguration,
  configure,
  registerCommands,
};

async function registerCommands() {
  if (!Configuration.current.discordClient?.application?.id) {
    throw new Error(
      `discordClient in the configuration must be set before commands can be registered.`
    );
  }

  const builtCommand = eventCommand.builder();
  await Configuration.current.discordClient.rest.put(
    Routes.applicationCommands(
      Configuration.current.discordClient.application?.id
    ),
    {
      body: [builtCommand.toJSON()],
    }
  );

  Configuration.current.discordClient.on(
    Events.InteractionCreate,
    (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      if (
        interaction.applicationId ===
          Configuration.current.discordClient?.application?.id &&
        interaction.commandName === Configuration.current.commandName
      ) {
        eventCommand.execute(interaction);
      }
    }
  );
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

    client.on(
      Events.GuildScheduledEventUserAdd,
      ClientEventHandlers.userShowedInterest
    );
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
  setInterval(
    EventsUnderConstruction.maintainEvents,
    Time.toMilliseconds.hours(1)
  );
  setInterval(Threads.closeAllOutdatedThreads, Time.toMilliseconds.minutes(30));
  setInterval(performAnnouncements, Time.toMilliseconds.minutes(1));
}
