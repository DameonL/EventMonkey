import {
  CategoryChannel,
  ChannelType,
  Collection,
  Guild,
  GuildScheduledEvent,
  GuildScheduledEventEntityType,
  GuildScheduledEventStatus,
  StageChannel,
  VoiceChannel,
} from "discord.js";
import { EventMonkeyEventTypeStage, EventMonkeyEventTypeVoice } from "../EventMonkeyConfiguration";
import { BaseEventMonkeyEvent } from "../EventMonkeyEvent";

export async function getValidVoiceOrStageChannel(
  event: BaseEventMonkeyEvent,
  eventType: EventMonkeyEventTypeStage | EventMonkeyEventTypeVoice,
  guild: Guild
): Promise<VoiceChannel | StageChannel | undefined> {
  if (!event.scheduledStartTime || !event.scheduledEndTime)
    throw new Error("Event must have a scheduled start and end time.");

  const guildChannels = await guild.channels.fetch();
  const guildEvents = await guild.scheduledEvents.fetch();

  const categoryChannel = !Array.isArray(eventType.channel)
    ? (guildChannels.find(
        (x) => (x?.name === eventType.channel || x?.id === eventType.channel) && x.type === ChannelType.GuildCategory
      ) as CategoryChannel)
    : undefined;

  const channels = categoryChannel
    ? categoryChannel.children.cache.map((value, key) => key)
    : !Array.isArray(eventType.channel)
    ? [eventType.channel]
    : eventType.channel;

  for (const channelId of channels) {
    const channel = guildChannels.find(
      (x) =>
        x != undefined &&
        (x.name === channelId || x.id === channelId) &&
        (x.type === ChannelType.GuildVoice || x.type == ChannelType.GuildStageVoice)
    ) as StageChannel | VoiceChannel | undefined;

    if (!channel) continue;

    if (
      (eventType.entityType === GuildScheduledEventEntityType.StageInstance &&
        channel.type !== ChannelType.GuildStageVoice) ||
      (eventType.entityType === GuildScheduledEventEntityType.Voice && channel.type !== ChannelType.GuildVoice)
    ) {
      continue;
    }

    if (eventsOverlap(channel.id, event, guildEvents)) continue;

    return channel;
  }
}

function eventsOverlap(
  channelId: string,
  event: BaseEventMonkeyEvent,
  guildEvents: Collection<string, GuildScheduledEvent<GuildScheduledEventStatus>>
) {
  if (!event.scheduledStartTime || !event.scheduledEndTime)
    throw new Error("Event must have a scheduled start and end time.");

  const channelEvents = guildEvents.filter((x) => x.channel?.id === channelId);

  for (const [guildEventId, guildEvent] of channelEvents) {
    if (!guildEvent.scheduledStartAt || !guildEvent.scheduledEndAt) continue;

    if (
      event.scheduledStartTime.valueOf() < guildEvent.scheduledEndAt.valueOf() &&
      event.scheduledEndTime.valueOf() >= guildEvent.scheduledStartAt.valueOf()
    ) {
      return true;
    }
  }

  return false;
}
