import { Client, GuildScheduledEventEntityType } from "discord.js";

export interface EventMonkeyConfiguration {
  commandName: string;
  discordClient?: Client;
  editingTimeout: number;
  eventTypes: EventMonkeyEventType[];
  timeZone?: string;
  closeThreadsAfter?: number;
  roles?: {
    allowed?: string[],
    denied?: string[]
  };
}

export interface EventMonkeyEventType {
  name: string;
  discussionChannel: string;
  voiceChannel?: string;
  stageChannel?: string;
  announcement?: EventAnnouncement
}

export interface EventAnnouncement {
  channel?: string | string[];
  beforeStart?: number;
  onStart?: boolean;
  message?: string;
}