import { Client, GuildScheduledEventEntityType } from "discord.js";
import { EventMonkeyConfiguration } from "./EventMonkeyConfiguration";

let configuration: EventMonkeyConfiguration = defaultConfiguration();
function defaultConfiguration(): EventMonkeyConfiguration {
  return {
    commandName: "eventmonkey",
    eventTypes: [
      {
        name: "Meetup",
        discussionChannel: "meetups",
        entityType: GuildScheduledEventEntityType.External,
        announcements: [{
          beforeStart: 0,
        }],
      },
    ],
    timeZones: [
      {
        name: "PST",
        offset: -8,
      },
    ],
    editingTimeout: 108000, // Default of 30 minutes
  };
}

export default {
  defaultConfiguration,
  get current() {
    return configuration;
  },
  set current(value: EventMonkeyConfiguration) {
    configuration = value;
  },
  get client() {
    if (!configuration.discordClient)
      throw new Error(
        "No client configured yet. You must ensure you set the discordClient in the configuration before trying to get the client from the configuration."
      );

    return this.current.discordClient as Client;
  },
};
