import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
} from "discord.js";
import { EventMonkeyEvent } from "../../EventMonkey";
import { createEventEmbed } from "./eventEmbed";

export default function submission(
  event: EventMonkeyEvent,
  content: string,
  clientId: string
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
  ephemeral: boolean;
  fetchReply: boolean;
  content: string;
} {
  const submissionEmbed = new EmbedBuilder().setTitle("Creating an event...");
  const prefix = `${clientId}_${event.id}_button`;
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setLabel("Edit")
      .setCustomId(`${prefix}_edit`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel("Make Recurring")
      .setCustomId(`${prefix}_makeRecurring`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel(event.image === "" ? "Add An Image" : "Change Image")
      .setCustomId(`${prefix}_addImage`)
      .setStyle(ButtonStyle.Secondary),
  ]);

  return {
    embeds: [submissionEmbed, createEventEmbed(event)],
    components: [
      buttonRow,
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Save For Later")
          .setCustomId(`${prefix}_save`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setLabel("Finish")
          .setCustomId(`${prefix}_finish`)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setLabel("Cancel")
          .setCustomId(`${prefix}_cancel`)
          .setStyle(ButtonStyle.Danger)
      ),
    ],
    ephemeral: true,
    fetchReply: true,
    content,
  };
}
