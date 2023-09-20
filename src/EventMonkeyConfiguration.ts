import { Client, GuildScheduledEventEntityType } from "discord.js";

export interface EventMonkeyConfiguration {
  commandName: string;
  discordClient?: Client;
  editingTimeout: number;
  eventTypes: EventMonkeyEventType[];
  timeZones: EventMonkeyTimeZone[];
  closeThreadsAfter?: number;
  roles?: {
    allowed?: string[];
    denied?: string[];
  };
}

export interface EventMonkeyTimeZone {
  name: string;
  offset: number;
  start?: Date;
  end?: Date;
}

export interface BaseEventMonkeyEventType {
  name: string;
  description?: string;
  discussionChannel: string;
  announcements?: EventAnnouncement[];
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
  message?: string;
  mention?: {
    attendees?: boolean;
    here?: boolean;
    everyone?: boolean;
  };
}
