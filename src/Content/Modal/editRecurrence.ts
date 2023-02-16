import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { EventMonkeyEvent } from "../../EventMonkey";
import { EventRecurrence, getRecurrenceUnit } from "../../Recurrence";
import { getTimeFromString, getTimeString } from "../../Serialization";

export function editRecurrence(event: EventMonkeyEvent) {
  if (!event.recurrence)
    throw new Error("Unable to show modal for nonexistent recurrence.");

  const modal = new ModalBuilder();
  modal.setTitle("Recurring Event");
  modal.setCustomId(event.id);

  let unit = getRecurrenceUnit(event.recurrence);
  if (!unit) throw new Error("Unable to get unit from EventRecurrence.");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId(`${event.id}_frequency`)
        .setLabel("Time before next recurrence")
        .setStyle(TextInputStyle.Short)
        .setValue("1")
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId(`${event.id}_unit`)
        .setLabel("Hours, days, weeks, or months")
        .setStyle(TextInputStyle.Short)
        .setValue(unit)
    )
  );

  return modal;
}