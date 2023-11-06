import { Client, GuildScheduledEventEntityType } from "discord.js";
import { ConfigurationProvider, EventAnnouncementType, EventMonkeyConfiguration } from "./EventMonkeyConfiguration";

let discordClient: Client | undefined;
let configuration: EventMonkeyConfiguration | ConfigurationProvider = defaultConfiguration();

export function isDynamicConfiguration(
  configuration: EventMonkeyConfiguration | ConfigurationProvider
): configuration is ConfigurationProvider {
  return typeof configuration === "function";
}

function defaultConfiguration(): EventMonkeyConfiguration {
  return {
    commandName: "eventmonkey",
    eventTypes: [
      {
        name: "Meetup",
        discussionChannel: "meetups",
        entityType: GuildScheduledEventEntityType.External,
        announcements: [
          {
            type: EventAnnouncementType.started,
          },
        ],
      },
    ],
    timeZones: [
      {
        name: "PST",
        offset: -8,
      },
    ],
    editingTimeout: 1800000, // 30 minutes
  };
}

export interface GetConfigurationOptions {
  guildId: string;
}

export default {
  defaultConfiguration,
  async getCurrent(options?: GetConfigurationOptions): Promise<EventMonkeyConfiguration> {
    if (isDynamicConfiguration(configuration)) {
      if (!options) {
        throw new Error("A dynamic configuration requires options provided when getting the configuration.");
      }

      const foundConfig = await configuration.get(options.guildId);

      if (!foundConfig) {
        throw new Error(`Unable to get configuration for server with ID ${options.guildId}`);
      }

      return foundConfig;
    } else {
      return configuration;
    }
  },
  async setCurrent(value: EventMonkeyConfiguration | ConfigurationProvider) {
    configuration = value;
  },
  set discordClient(value: Client) {
    if (discordClient) {
      throw new Error("Attempting to set Configuration.discordClient multiple times. This is not supported.");
    }

    discordClient = value;
  },
  get discordClient() {
    if (!discordClient)
      throw new Error(
        "No client configured yet. You must ensure you set the discordClient in the configuration before trying to get the client from the configuration."
      );

    return discordClient as Client;
  },
};
