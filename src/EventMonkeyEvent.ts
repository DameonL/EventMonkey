import {
  ButtonInteraction,
  GuildScheduledEvent,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  InteractionCollector,
  ThreadChannel,
  User,
  VoiceBasedChannel,
} from "discord.js";
import { EventRecurrence } from "./Recurrence";

export interface EventMonkeyEvent {
  author: User;
  name: string;
  description: string;
  image: string;
  entityMetadata: { location: string };
  channel?: VoiceBasedChannel;
  scheduledStartTime: Date;
  scheduledEndTime?: Date;
  duration: number;
  privacyLevel: GuildScheduledEventPrivacyLevel;
  id: string;
  submissionCollector?: InteractionCollector<ButtonInteraction>;
  forumChannelId: string;
  entityType: GuildScheduledEventEntityType;
  threadChannel?: ThreadChannel;
  scheduledEvent?: GuildScheduledEvent;
  recurrence?: EventRecurrence;
}