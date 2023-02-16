import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Guild,
  GuildScheduledEventEntityType,
  ThreadChannel,
} from "discord.js";
import { createEventEmbed } from "./Content/Embed/eventEmbed";
import { EventMonkeyEvent } from "./EventMonkeyEvent";
import { listenForButtonsInThread } from "./Listeners";
import { resolveChannelString } from "./Utilities";

export async function createGuildScheduledEvent(
  event: EventMonkeyEvent,
  guild: Guild,
  thread: ThreadChannel
) {
  const eventToSubmit = { ...event } as any;
  const scheduledEndTime = new Date(eventToSubmit.scheduledStartTime);
  scheduledEndTime.setHours(
    scheduledEndTime.getHours() + eventToSubmit.duration
  );
  eventToSubmit.scheduledEndTime = scheduledEndTime;
  eventToSubmit.description = `${
    eventToSubmit.description
  }\nDiscussion: ${thread.toString()}\nHosted by: ${eventToSubmit.author.toString()}`;
  eventToSubmit.name = `${eventToSubmit.name} hosted by ${eventToSubmit.author.username}`;
  if (eventToSubmit.entityType !== GuildScheduledEventEntityType.External) {
    eventToSubmit.channelId = eventToSubmit.entityMetadata.location;
    delete eventToSubmit.entityMetadata;
  }

  const scheduledEvent = await (event.scheduledEvent
    ? guild.scheduledEvents.edit(event.scheduledEvent.id, eventToSubmit)
    : guild.scheduledEvents.create(eventToSubmit));

  return scheduledEvent;
}

export async function createForumChannelEvent(
  event: EventMonkeyEvent,
  guild: Guild,
  client: Client
) {
  const scheduledEndTime = new Date(event.scheduledStartTime);
  scheduledEndTime.setHours(scheduledEndTime.getHours() + event.duration);
  const targetChannel = await resolveChannelString(event.forumChannelId, guild);

  if (
    targetChannel.type !== ChannelType.GuildForum &&
    targetChannel.type !== ChannelType.GuildText
  )
    throw new Error(
      `Channel with ID ${event.forumChannelId} is of type ${targetChannel.type}, but expected a forum channel!`
    );

  if (!targetChannel)
    throw new Error(
      `Unable to resolve ID ${event.forumChannelId} to a channel.`
    );

  const threadName = `${event.scheduledStartTime
    .toLocaleString()
    .replace(/(?<=\d?\d:\d\d):\d\d/, " ")} - ${event.name} hosted by ${
    event.author.username
  }`;
  const threadMessage = {
    embeds: [createEventEmbed(event), createAttendeesEmbed(event)],
    components: [createAttendanceButtons(event, client.user?.id ?? "")],
  };

  const threadChannel = event.threadChannel
    ? event.threadChannel
    : await targetChannel.threads.create({
        name: threadName,
        message: threadMessage,
      });

  if (event.threadChannel) {
    await event.threadChannel.setName(threadName);
    (await event.threadChannel.messages.fetchPinned())
      .at(0)
      ?.edit(threadMessage);
  } else {
    threadChannel.messages.cache.at(0)?.pin();
  }

  await listenForButtonsInThread(threadChannel);

  return threadChannel;
}

export function createAttendeesEmbed(event: EventMonkeyEvent): EmbedBuilder {
  const attendeesEmbed = new EmbedBuilder().setTitle("Attendees");
  attendeesEmbed.addFields([
    {
      name: "Attending",
      value: event.author.toString(),
    },
  ]);
  return attendeesEmbed;
}

export function createAttendanceButtons(
  event: EventMonkeyEvent,
  clientId: string
): ActionRowBuilder<ButtonBuilder> {
  const buttonRow = new ActionRowBuilder<ButtonBuilder>();
  buttonRow.addComponents([
    new ButtonBuilder()
      .setLabel("Attending")
      .setStyle(ButtonStyle.Success)
      .setCustomId(`${clientId}_${event.id}_button_attending`),
    new ButtonBuilder()
      .setLabel("Not Attending")
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`${clientId}_${event.id}_button_notAttending`),
  ]);
  return buttonRow;
}
