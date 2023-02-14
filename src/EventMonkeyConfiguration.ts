import { Client, GuildScheduledEventEntityType } from "discord.js";

export interface EventMonkeyConfiguration {
  commandName: string;
  discordClient?: Client;
  timeZone?: string;
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
  editingTimeout: number;
  closeThreadsAfter?: number;
  allowedEntityTypes?: GuildScheduledEventEntityType[];
  roleIds?: {
    allowed?: string[],
    denied?: string[]
  };
}

