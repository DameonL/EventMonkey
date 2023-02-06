import { Client } from "discord.js";

export interface EventMonkeyConfiguration {
  commandName: string;
  discordClient?: Client;
  eventTypes: {
    name: string;
    channelId: string;
  }[];
  editingTimeoutInMinutes: number;
}

