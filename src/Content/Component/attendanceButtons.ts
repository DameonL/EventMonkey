import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { EventMonkeyEvent } from "../../EventMonkeyEvent";

export function attendanceButtons(
  event: EventMonkeyEvent,
  id: string
): ActionRowBuilder<ButtonBuilder> {
  const buttonRow = new ActionRowBuilder<ButtonBuilder>();
  buttonRow.addComponents([
    new ButtonBuilder()
      .setLabel("Attending")
      .setStyle(ButtonStyle.Success)
      .setCustomId(`${id}_${event.id}_button_attending`),
    new ButtonBuilder()
      .setLabel("Not Attending")
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`${id}_${event.id}_button_notAttending`),
  ]);
  return buttonRow;
}
