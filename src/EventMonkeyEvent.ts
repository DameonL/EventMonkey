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

export interface BaseEventMonkeyEvent {
  author: User;
  name: string;
  description: string;
  image?: string;
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

export interface EventMonkeyEventVoice extends BaseEventMonkeyEvent {
  entityType: GuildScheduledEventEntityType.Voice;
  eventType: EventMonkeyEventTypeVoice;
  channel: VoiceChannel;
}

export interface EventMonkeyEventStage extends BaseEventMonkeyEvent {
  entityType: GuildScheduledEventEntityType.StageInstance;
  eventType: EventMonkeyEventTypeStage;
  channel: StageChannel;
}

export interface EventMonkeyEventExternal extends BaseEventMonkeyEvent {
  entityType: GuildScheduledEventEntityType.External;
  eventType: EventMonkeyEventTypeExternal;
  entityMetadata: { location: string };
}

export type EventMonkeyEvent = EventMonkeyEventStage | EventMonkeyEventExternal | EventMonkeyEventVoice;
