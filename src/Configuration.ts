import { Client, GuildScheduledEventEntityType } from "discord.js";
import { EventAnnouncementType, EventMonkeyConfiguration } from "./EventMonkeyConfiguration";
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
    editingTimeout: Time.toMilliseconds.minutes(30),
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
