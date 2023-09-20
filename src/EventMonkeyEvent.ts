import {
  ButtonInteraction,
  GuildScheduledEvent,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  InteractionCollector,
  StageChannel,
  ThreadChannel,
  User,
  VoiceChannel,
} from "discord.js";
import {
  EventMonkeyEventTypeExternal,
  EventMonkeyEventTypeStage,
  EventMonkeyEventTypeVoice,
} from "./EventMonkeyConfiguration";
import { EventRecurrence } from "./Recurrence";

export type PartialEventMonkeyEvent = {
  author: User;
  name: string;
  description: string;
  image?: string;
  maxAttendees?: number;
  attendees: string[];
  scheduledStartTime: Date;
  scheduledEndTime?: Date;
  duration: number;
  privacyLevel: GuildScheduledEventPrivacyLevel;
  id: string;
  submissionCollector?: InteractionCollector<ButtonInteraction>;
  discussionChannelId: string;
  threadChannel?: ThreadChannel;
  scheduledEvent?: GuildScheduledEvent;
  recurrence?: EventRecurrence;
  entityType: GuildScheduledEventEntityType;
}

export type EventMonkeyEvent<T = VoiceEvent | StageEvent | ExternalEvent> = PartialEventMonkeyEvent & T;

export interface VoiceEvent {
  entityType: GuildScheduledEventEntityType.Voice;
  eventType: EventMonkeyEventTypeVoice;
  channel?: VoiceChannel;
}

export interface StageEvent {
  entityType: GuildScheduledEventEntityType.StageInstance;
  eventType: EventMonkeyEventTypeStage;
  channel?: StageChannel;
}

export interface ExternalEvent {
  entityType: GuildScheduledEventEntityType.External;
  eventType: EventMonkeyEventTypeExternal;
  entityMetadata: { location: string };
}