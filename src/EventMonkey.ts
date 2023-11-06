import { Client, Events, Guild, GuildScheduledEvent, GuildScheduledEventStatus, Routes } from "discord.js";

import { ConfigurationProvider, EventMonkeyConfiguration } from "./EventMonkeyConfiguration";
import { EventMonkeyEvent } from "./EventMonkeyEvent";
import EventsUnderConstruction from "./EventsUnderConstruction";

import ClientEventHandlers from "./ClientEventHandlers";
import { eventCommand } from "./Commands";
import Configuration, { isDynamicConfiguration } from "./Configuration";
import simpleConfigurationProvider from "./simpleConfigurationProvider";
import Listeners from "./Listeners";
import logger from "./Logger";
import Threads from "./Utility/Threads";
import Time from "./Utility/Time";
import { performAnnouncements } from "./Utility/performAnnouncements";
import { restartRecurringEvents } from "./Utility/restartRecurringEvents";
import updateVoiceAndStageEvents from "./Utility/updateVoiceAndStageEvents";
export { EventMonkeyConfiguration, EventMonkeyEvent };

export default {
  command: eventCommand,
  defaultConfiguration: Configuration.defaultConfiguration,
  configure,
  registerCommands,
  registerCommandsInGuild,
  time: Time,
};

async function registerCommands() {
  if (!Configuration.discordClient?.application?.id) {
    throw new Error(`discordClient in the configuration must be set before commands can be registered.`);
  }

  for (const [guildId, guild] of Configuration.discordClient.guilds.cache) {
    registerCommandsInGuild(guild);
  }
}

async function registerCommandsInGuild(guild: Guild) {
  const applicationId = Configuration.discordClient.application?.id;
  if (!applicationId) {
    throw new Error("Commands cannot be registered before the client application is ready.");
  }

  const configuration = await Configuration.getCurrent({ guildId: guild.id });
  const builtCommand = await eventCommand.builder(guild.id);
  await Configuration.discordClient.rest.put(Routes.applicationCommands(applicationId), {
    body: [builtCommand.toJSON()],
  });

  Configuration.discordClient.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (
      interaction.applicationId === Configuration.discordClient?.application?.id &&
      interaction.commandName === configuration.commandName
    ) {
      eventCommand.execute(interaction);
    }
  });
}

async function configure(newConfiguration: EventMonkeyConfiguration | ConfigurationProvider, client: Client) {
  Configuration.discordClient = client;
  let configuration: ConfigurationProvider = !isDynamicConfiguration(newConfiguration)
    ? simpleConfigurationProvider(newConfiguration)
    : newConfiguration;
  Configuration.setCurrent(newConfiguration);
  const serverOffset = Math.round(new Date().getTimezoneOffset() / 60);
  for (const [guildId, guild] of await Configuration.discordClient.guilds.fetch()) {
    const guildConfig = await configuration.get(guild.id);

    if (!guildConfig) {
      continue;
    }

    for (const timeZone of guildConfig.timeZones) {
      timeZone.offset += serverOffset;
    }
  }

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
