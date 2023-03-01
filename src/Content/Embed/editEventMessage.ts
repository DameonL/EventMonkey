import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  MessageCreateOptions,
} from "discord.js";
import { EventMonkeyEvent } from "../../EventMonkey";
import TimeUtilities from "../../Utility/TimeUtilities";
import { eventEmbed } from "./eventEmbed";

export default async function editEventMessage(
  event: EventMonkeyEvent,
  content: string,
  guild: Guild,
  id: string
): Promise<MessageCreateOptions> {
  const submissionEmbed = new EmbedBuilder().setTitle(
    `${event.name} - ${TimeUtilities.getTimeString(event.scheduledStartTime)}`
  );
  const prefix = `${id}__button`;
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
    embeds: [submissionEmbed, await eventEmbed(event, guild)],
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
    content,
  };
}
