import { Client, GuildScheduledEventEntityType } from "discord.js";

export interface EventMonkeyConfiguration {
  commandName: string;
  discordClient?: Client;
  editingTimeout: number;
  eventTypes: {
    name: string;
    channel: string;
    announcement?: {
      channel?: string | string[];
      beforeStart?: number;
      onStart?: boolean;
      message?: string;
    }
  }[];
  timeZone?: string;
  closeThreadsAfter?: number;
  allowedEntityTypes?: GuildScheduledEventEntityType[];
  roles?: {
    allowed?: string[],
    denied?: string[]
  };
}