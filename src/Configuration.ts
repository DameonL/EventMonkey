import { Client, GuildScheduledEventEntityType } from "discord.js";
import { EventMonkeyConfiguration } from "./EventMonkeyConfiguration";
import logger from "./Logger";
import Time from "./Utility/Time";

let configuration: EventMonkeyConfiguration = defaultConfiguration();
function defaultConfiguration(): EventMonkeyConfiguration {
  return {
    commandName: "eventmonkey",
    eventTypes: [
      {
        name: "Meetup",
        discussionChannel: "meetups",
        entityType: GuildScheduledEventEntityType.External,
        announcement: {
          onStart: true,
        },
      },
    ],
    timeZones: [
      {
        name: "PST",
        offset: -8,
        start: Time.getNthWeekday(new Date().getFullYear() - 1, 10, 0, 1),
        end: Time.getNthWeekday(new Date().getFullYear(), 2, 0, 2),
      },
      {
        name: "PDT",
        offset: -7,
        start: Time.getNthWeekday(new Date().getFullYear(), 2, 0, 2),
        end: Time.getNthWeekday(new Date().getFullYear(), 10, 0, 1),
      },
      {
        name: "PST",
        offset: -8,
        start: Time.getNthWeekday(new Date().getFullYear(), 10, 0, 1),
        end: Time.getNthWeekday(new Date().getFullYear() + 1, 2, 0, 2),
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
