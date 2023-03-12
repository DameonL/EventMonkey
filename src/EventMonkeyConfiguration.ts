import { Client, GuildScheduledEventEntityType } from "discord.js";

export interface EventMonkeyConfiguration {
  commandName: string;
  discordClient?: Client;
  editingTimeout: number;
  eventTypes: EventMonkeyEventType[];
  timeZone: {
    name: string;
    offset: number;
  };
  closeThreadsAfter?: number;
  roles?: {
    allowed?: string[];
    denied?: string[];
  };
}

export interface BaseEventMonkeyEventType {
  name: string;
  description?: string;
  discussionChannel: string;
  announcement?: EventAnnouncement;
  defaultImageUrl?: string;
}

export interface EventMonkeyEventTypeExternal extends BaseEventMonkeyEventType {
  entityType: GuildScheduledEventEntityType.External;
}

export interface EventMonkeyEventTypeVoice extends BaseEventMonkeyEventType {
  entityType: GuildScheduledEventEntityType.Voice;
  channel: string | string[];
}

export interface EventMonkeyEventTypeStage extends BaseEventMonkeyEventType {
  entityType: GuildScheduledEventEntityType.StageInstance;
  channel: string | string[];
}

export type EventMonkeyEventType = EventMonkeyEventTypeExternal | EventMonkeyEventTypeStage | EventMonkeyEventTypeVoice;

export interface EventAnnouncement {
  channel?: string | string[];
  beforeStart?: number;
  onStart?: boolean;
  message?: string;
}
