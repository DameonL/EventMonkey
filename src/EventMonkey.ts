import { Events, GuildScheduledEvent, GuildScheduledEventStatus, Routes } from "discord.js";

import { EventMonkeyConfiguration } from "./EventMonkeyConfiguration";
import { EventMonkeyEvent } from "./EventMonkeyEvent";
import EventsUnderConstruction from "./EventsUnderConstruction";

import ClientEventHandlers from "./ClientEventHandlers";
import { eventCommand } from "./Commands";
import Configuration from "./Configuration";
import Listeners from "./Listeners";
import logger from "./Logger";
import { performAnnouncements } from "./Utility/performAnnouncements";
import { restartRecurringEvents } from "./Utility/restartRecurringEvents";
import Threads from "./Utility/Threads";
import Time from "./Utility/Time";
import updateVoiceAndStageEvents from "./Utility/updateVoiceAndStageEvents";
export { EventMonkeyConfiguration, EventMonkeyEvent };

export default {
  command: eventCommand,
  defaultConfiguration: Configuration.defaultConfiguration,
  configure,
  registerCommands,
  time: Time,
};

async function registerCommands() {
  if (!Configuration.current.discordClient?.application?.id) {
    throw new Error(`discordClient in the configuration must be set before commands can be registered.`);
  }

  const builtCommand = eventCommand.builder();
  await Configuration.current.discordClient.rest.put(
    Routes.applicationCommands(Configuration.current.discordClient.application?.id),
    {
      body: [builtCommand.toJSON()],
    }
  );

  Configuration.current.discordClient.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (
      interaction.applicationId === Configuration.current.discordClient?.application?.id &&
      interaction.commandName === Configuration.current.commandName
    ) {
      eventCommand.execute(interaction);
    }
  });
}

async function configure(newConfiguration: EventMonkeyConfiguration | (() => EventMonkeyConfiguration)) {
  let configuration: EventMonkeyConfiguration | undefined;
  if (typeof newConfiguration === "function") {
    configuration = (newConfiguration as () => EventMonkeyConfiguration)();
  }

  if (!configuration) {
    configuration = newConfiguration as EventMonkeyConfiguration;
  }

  const serverOffset = Math.round(new Date().getTimezoneOffset() / 60);
  for (const timeZone of configuration.timeZones) {
    timeZone.offset += serverOffset;
  }

  const cachedClient = Configuration.current.discordClient;
  Configuration.current = configuration;

  if (Configuration.current.eventTypes.length === 0) {
    throw new Error("You must define at least one event type in the configuration.");
  }

  const client = Configuration.current.discordClient;
  if (client && client !== cachedClient) {
    await Listeners.listenForButtons();
    client.on(Events.GuildScheduledEventDelete, async (guildScheduledEvent: GuildScheduledEvent) =>
      ClientEventHandlers.eventCompleted(null, guildScheduledEvent)
    );

    client.on(Events.GuildScheduledEventUserAdd, ClientEventHandlers.userShowedInterest);

    client.on(Events.GuildScheduledEventUpdate, (oldEvent: GuildScheduledEvent | null, event: GuildScheduledEvent) => {
      if (event.status === GuildScheduledEventStatus.Active) {
        ClientEventHandlers.eventStarted(oldEvent, event);
      } else if (event.status === GuildScheduledEventStatus.Completed) {
        ClientEventHandlers.eventCompleted(oldEvent, event);
      }
    });

    logger.log("Pre-loading channels and events...");
    for (const [guildId, partialGuild] of await client.guilds.fetch()) {
      const guild = await partialGuild.fetch();
      const channels = await guild.channels.fetch();
      const threads = await guild.channels.fetchActiveThreads();
    }
    await startupMaintenanceTasks();
    startRecurringTasks();
  }
}

async function startupMaintenanceTasks() {
  try {
    logger.log("Performing startup maintenance...");
    await Threads.closeAllOutdatedThreads();
    await restartRecurringEvents();
    await performAnnouncements();
    logger.log("Startup maintenance complete.");
  } catch (error) {
    logger.error("Error in startup maintenance task:", error);
  }
}

function startRecurringTasks() {
  setInterval(EventsUnderConstruction.maintainEvents, Time.toMilliseconds.hours(1));
  setInterval(Threads.closeAllOutdatedThreads, Time.toMilliseconds.minutes(30));
  setInterval(performAnnouncements, Time.toMilliseconds.minutes(1));
  setInterval(updateVoiceAndStageEvents, Time.toMilliseconds.minutes(1));
}
