import {
  APIEmbedField,
  ChannelType,
  Client,
  EmbedBuilder,
  Guild,
  GuildScheduledEvent,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  Message,
  StageChannel,
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
import { resolveChannelString } from "../../Utility/resolveChannelString";
import Time from "../../Utility/Time";
import { getAttendeesFromMessage } from "./attendees";

export async function eventEmbed(
  event: EventMonkeyEvent,
  guild: Guild
): Promise<EmbedBuilder> {
  const previewEmbed = new EmbedBuilder();
  previewEmbed.setTitle("Event Details");
  if (event.image !== "") {
    previewEmbed.setThumbnail(event.image);
  }

  previewEmbed.setDescription(event.description);

  if (event.scheduledEvent) {
    previewEmbed.setURL(event.scheduledEvent.url);
  }

  previewEmbed.setAuthor({
    name: `${event.author.username} (${event.author.id})`,
    iconURL: event.author.avatarURL() ?? "",
  });

  if (event.image) {
    previewEmbed.setImage(event.image);
  }

  const location =
    event.entityType === GuildScheduledEventEntityType.External
      ? event.entityMetadata.location
      : (await resolveChannelString(event.entityMetadata.location, guild)).toString();

  const fields: APIEmbedField[] = [
    {
      name: "Location",
      value: location,
      inline: true,
    },
    {
      name: "Duration",
      value: `${event.duration} hour${event.duration > 1 ? "s" : ""}`,
      inline: true,
    },
  ];

  if (event.recurrence) {
    fields.push({
      name: "Frequency",
      value: serializeRecurrence(event.recurrence),
    });
  }
  fields.push({ name: "Event ID", value: event.id });

  previewEmbed.addFields(fields);
  return previewEmbed;
}

export async function deseralizeEventEmbed(
  thread: ThreadChannel,
  client: Client
): Promise<EventMonkeyEvent> {
  const detailsMessage = await getEventDetailsMessage(thread);
  if (!detailsMessage) throw new Error(`Thread is not an event thread.`);

  const embed = await getEventDetailsEmbed(detailsMessage);

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
  const locationChannel = location?.match(/(?<=<#)\d+(?=>)/)?.[0];
  const channel = locationChannel
    ? (client.channels.cache.get(locationChannel) as
        | TextChannel
        | VoiceBasedChannel
        | StageChannel)
    : undefined;
  const entityType =
    channel == undefined
      ? GuildScheduledEventEntityType.External
      : channel.type === ChannelType.GuildStageVoice
      ? GuildScheduledEventEntityType.StageInstance
      : GuildScheduledEventEntityType.Voice;

  const eventId = embed.url?.match(
    /(?<=https:\/\/discord.com\/events\/.*\/).*/i
  )?.[0];

  let scheduledEvent: GuildScheduledEvent | undefined = undefined;
  if (eventId) {
    for (const [guildId, guild] of client.guilds.cache.entries()) {
      try {
        scheduledEvent = await guild.scheduledEvents.fetch(eventId);
      } catch {
        continue;
      }
    }
  }

  let recurrence: EventRecurrence | undefined = undefined;
  const frequencyField = embed.fields.find((x) => x.name === "Frequency");
  recurrence = frequencyField
    ? deserializeRecurrence(frequencyField.value)
    : undefined;

  const attendees = getAttendeesFromMessage(detailsMessage);

  const output: any = {
    name,
    scheduledStartTime,
    author,
    description: embed.description ?? "",
    image,
    privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    duration: duration,
    discussionChannelId: thread.parentId ?? "",
    entityMetadata: { location: channel ? channel.id : location },
    entityType,
    threadChannel: thread,
    scheduledEvent,
    id,
    recurrence,
    attendees,
  };

  return output;
}

export async function getEventDetailsEmbed(message: Message) {
  const embed = message.embeds?.find((x) => x.title === "Event Details");

  if (!embed) {
    throw new Error(
      `Unable to find event embed on message.\n${JSON.stringify(message)}`
    );
  }
  return embed;
}

export async function getEventDetailsMessage(thread: ThreadChannel) {
  const pinnedMessages = await thread.messages.fetchPinned();
  return pinnedMessages.find((value, key) =>
    value.embeds.find((embed) => embed.title === "Event Details")
  );
}

export function getEventNameFromString(text: string): string {
  const matches = text.match(/(AM|PM)(\s+\w+)?\s+-\s+(?<name>.*)(?= hosted by)/i);
  if (!matches || !matches.groups)
    throw new Error("Unable to parse event name from string.");

  return matches.groups.name;
}
