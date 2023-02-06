import {
  ActionRowBuilder,
  ChannelType,
  Client,
  GuildScheduledEvent,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  ModalActionRowComponentBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputComponent,
  TextInputStyle,
  ThreadChannel,
  VoiceBasedChannel,
} from "discord.js";
import { EventMonkeyEvent } from "./EventMonkeyEvent";

export interface ModalSerializationConfig {
  labels?: {
    [fieldName: string]: string;
  };
  styles?: {
    [fieldName: string]: TextInputStyle;
  };
  formatters?: {
    [fieldName: string]: (fieldValue: any) => string;
  };
}

export function serializeToModal(
  prefix: string,
  target: any,
  config?: ModalSerializationConfig
): ActionRowBuilder<TextInputBuilder>[] {
  const output: ActionRowBuilder<TextInputBuilder>[] = [];

  for (const fieldName in target) {
    let label = config?.labels?.[fieldName] ?? fieldName;
    let style = config?.styles?.[fieldName] ?? TextInputStyle.Short;
    let value = target[fieldName];
    if (config?.formatters?.[fieldName])
      value = config.formatters[fieldName](target[fieldName]);

    value = value.toString();

    output.push(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setLabel(label)
          .setCustomId(`${prefix}${fieldName}`)
          .setStyle(style)
          .setValue(value)
      )
    );
  }

  return output;
}

export interface ModalDeserializationConfig {
  validators?: {
    [fieldName: string]:
      | ((fieldValue: string) => string | undefined)
      | undefined;
  };
  customDeserializers?: {
    [fieldName: string]: ((fieldValue: string) => any) | undefined;
  };
}

export function deserializeModalFields<T>(
  fieldPrefix: string,
  fields: IterableIterator<[string, TextInputComponent]>,
  deserializeTarget?: any,
  config?: ModalDeserializationConfig
) {
  const output: any = deserializeTarget ?? {};

  for (let [fullFieldName, fieldComponent] of fields) {
    fullFieldName = fullFieldName.replace(fieldPrefix, "");
    const splitFieldName = fullFieldName.split(".");
    let currentObject = output;
    for (let i = 0; i < splitFieldName.length; i++) {
      const fieldName = splitFieldName[i];
      if (i < splitFieldName.length - 1) {
        if (!currentObject[fieldName]) {
          const newObject = {};
          currentObject[fieldName] = newObject;
          currentObject = newObject;
        } else {
          currentObject = currentObject[fieldName];
        }
      } else {
        if (config?.validators?.[fullFieldName]) {
          const validationResponse = config.validators[fieldName]?.(
            fieldComponent.value
          );
          if (validationResponse) {
            throw new Error(validationResponse);
          }
        }

        if (config?.customDeserializers?.[fullFieldName]) {
          currentObject[fieldName] = config.customDeserializers?.[
            fullFieldName
          ]?.(fieldComponent.value);
        } else {
          currentObject[fieldName] = fieldComponent.value.trim();
        }
      }
    }
  }

  return output as T;
}

export function getEventNameAndStart(eventTitle: string) {
  const titleMatches = eventTitle.match(
    /(?<time>\d\d?\/\d\d?\/\d\d\d\d, \d\d?:\d\d (AM|PM)) - (?<name>.*)(?= hosted by)/i
  );
  if (!titleMatches || !titleMatches.groups)
    throw new Error("Unable to parse thread name.");

  const scheduledStartTime = new Date(titleMatches.groups.time);
  const name = titleMatches.groups.name;
  return { name, scheduledStartTime };
}

export async function deseralizePreviewEmbed(
  thread: ThreadChannel,
  client: Client
): Promise<EventMonkeyEvent> {
  const pinnedMessages = await thread.messages.fetchPinned();
  const embed = pinnedMessages.at(0)?.embeds[0];
  if (!embed) throw new Error("Unable to find event embed for thread.");

  const userMatches = embed.author?.name.match(
    /(?<username>\w*) \((?<userId>.*)\)$/i
  );

  if (!userMatches || !userMatches.groups)
    throw new Error("Unable to parse embed.");

  const userId = userMatches.groups.userId;
  const author = client.users.cache.get(userId);
  if (!author) throw new Error("Unable to resolve user ID from embed.");

  const { scheduledStartTime, name } = getEventNameAndStart(thread.name);

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

  let scheduledEvent: GuildScheduledEvent | undefined = undefined;
  for (const [guildId, guild] of client.guilds.cache.entries()) {
    const foundEvent = guild.scheduledEvents.cache.find((x) =>
      x.description?.includes(`Discussion: ${thread.url}`)
    );
    if (foundEvent) {
      scheduledEvent = foundEvent;
      break;
    }
  }

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
    id: thread.id,
  };

  return output;
}
