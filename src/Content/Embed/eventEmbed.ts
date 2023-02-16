import {
  APIEmbedField,
  ChannelType,
  Client,
  EmbedBuilder,
  GuildScheduledEvent,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  TextChannel,
  ThreadChannel,
  VoiceBasedChannel,
} from "discord.js";
import { EventMonkeyEvent } from "../../EventMonkey";
import {
  deserializeRecurrence,
  EventRecurrence,
  serializeRecurrence,
} from "../../Recurrence";
import Time from "../../Utility/TimeUtilities";

export function createEventEmbed(event: EventMonkeyEvent): EmbedBuilder {
  const previewEmbed = new EmbedBuilder().setTitle(
    `${Time.getTimeString(event.scheduledStartTime)} - ${event.name}`
  );
  if (event.image !== "") {
    previewEmbed.setThumbnail(event.image);
  }
  previewEmbed.setDescription(event.description);
  const fields: APIEmbedField[] = [];
  fields.push({
    name:
      event.entityType === GuildScheduledEventEntityType.External
        ? "Location"
        : "Channel",
    value: event.entityMetadata.location,
    inline: true,
  });
  fields.push({
    name: "Duration",
    value: `${event.duration} hour${event.duration > 1 ? "s" : ""}`,
    inline: true,
  });

  if (event.recurrence) {
    fields.push({
      name: "Frequency",
      value: serializeRecurrence(event.recurrence),
    });
  }
  if (event.scheduledEvent) {
    fields.push({ name: "Event Link", value: event.scheduledEvent.url });
  }

  fields.push({ name: "Event ID", value: event.id });
  previewEmbed.addFields(fields);
  previewEmbed.setAuthor({
    name: `${event.author.username} (${event.author.id})`,
    iconURL: event.author.avatarURL() ?? "",
  });

  if (event.image) {
    previewEmbed.setImage(event.image);
  }

  return previewEmbed;
}

export async function deseralizeEventEmbed(
  thread: ThreadChannel,
  client: Client
): Promise<EventMonkeyEvent> {
  const embed = await getPreviewEmbed(thread);

  const id = embed.fields.find((x) => x.name === "Event ID")?.value;
  if (!id) throw new Error("Unable to get ID from embed.");

  const userMatches = embed.author?.name.match(
    /(?<username>\w*) \((?<userId>.*)\)$/i
  );

  if (!userMatches || !userMatches.groups)
    throw new Error("Unable to parse embed.");

  const userId = userMatches.groups.userId;
  const author = client.users.cache.get(userId);
  if (!author) throw new Error("Unable to resolve user ID from embed.");

  const scheduledStartTime = Time.getTimeFromString(thread.name);
  const name = getEventNameFromString(thread.name);

  const image = embed.image?.url ?? "";
  const duration = Number(
    embed.fields
      .find((x) => x.name === "Duration")
      ?.value.replace(" hours", "")
      .replace(" hour", "") ?? 1
  );
  const location = embed.fields.find((x) => x.name === "Location")?.value;
  const channelLink = embed.fields.find((x) => x.name === "Channel")?.value;
  const channelId = channelLink
    ? channelLink?.match(/(?<=https:\/\/discord.com\/channels\/\d+\/)\d+/i)?.[0]
    : undefined;
  const channel = channelId
    ? (client.channels.cache.get(channelId) as TextChannel | VoiceBasedChannel)
    : undefined;
  const entityType =
    channel == undefined
      ? GuildScheduledEventEntityType.External
      : channel.type === ChannelType.GuildStageVoice
      ? GuildScheduledEventEntityType.StageInstance
      : GuildScheduledEventEntityType.Voice;

  const eventLink = embed.fields.find((x) => x.name === "Event Link");
  const eventId = eventLink?.value.match(
    /(?<=https:\/\/discord.com\/events\/.*\/).*/i
  )?.[0];
  if (!eventId) throw new Error("Unable to deserialize event ID.");

  let scheduledEvent: GuildScheduledEvent | undefined = undefined;
  for (const [guildId, guild] of client.guilds.cache.entries()) {
    try {
      scheduledEvent = await guild.scheduledEvents.fetch(eventId);
    } catch {
      continue;
    }
  }
  let recurrence: EventRecurrence | undefined = undefined;
  const frequencyField = embed.fields.find((x) => x.name === "Frequency");
  recurrence = frequencyField
    ? deserializeRecurrence(frequencyField.value)
    : undefined;

  const output = {
    name,
    scheduledStartTime,
    author,
    description: embed.description ?? "",
    image,
    privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    duration: duration,
    forumChannelId: thread.parentId ?? "",
    entityMetadata: { location: location ?? channel?.name ?? "" },
    entityType,
    threadChannel: thread,
    scheduledEvent,
    id,
    recurrence,
  };

  return output;
}

async function getPreviewEmbed(thread: ThreadChannel) {
  const pinnedMessages = await thread.messages.fetchPinned();
  const embed = pinnedMessages.at(pinnedMessages.values.length - 1)?.embeds[0];
  if (!embed) throw new Error("Unable to find event embed for thread.");
  return embed;
}

export function getEventNameFromString(text: string): string {
  const matches = text.match(/(AM|PM) - (?<name>.*)(?= hosted by)/i);
  if (!matches || !matches.groups)
    throw new Error("Unable to parse event name from string.");

  return matches.groups.name;
}
