import { APIEmbedField, EmbedBuilder, Message, ThreadChannel } from "discord.js";
import { getEventDetailsMessage } from "./eventEmbed";

export function getAttendeesFromMessage(eventMessage: Message): string[] {
  const attendees: string[] = [];
  for (const field of eventMessage.embeds[1].fields) {
    attendees.push(...field.value.replace(/[<@>]/g, "").split("\n"));
  }

  return attendees;
}

export function attendeesToEmbed(attendees: string[]) {
  const builder = new EmbedBuilder().setTitle("Attendees");
  const attendeeArrays: string[][] = [[]];
  let charCount = 0;
  let currentArray = 0;
  for (const attendee of attendees) {
    charCount += attendee.length + 5; // Accounting for \n, and characters added by tag
    if (charCount >= 1024) {
      charCount = 0;
      currentArray++;
      attendeeArrays[currentArray] = [];
    }

    attendeeArrays[currentArray].push(attendee);
  }

  const embedFields: APIEmbedField[] = [];
  let currentStart = 0;
  for (let i = 0; i < attendeeArrays.length; i++) {
    const array = attendeeArrays[i];
    const end = currentStart + array.length;
    embedFields.push({
      name: `${currentStart + 1} - ${end}`,
      value: array.map((x) => `<@${x}>`).join("\n"),
      inline: true,
    });
    currentStart = end;
  }

  builder.addFields(embedFields);
  return builder;
}

export async function attendeeTags(thread: ThreadChannel) {
  const detailsMessage = await getEventDetailsMessage(thread);
  if (!detailsMessage) return "";

  const attendees = getAttendeesFromMessage(detailsMessage);
  const tags = attendees.map(x => `<@${x}>`).join(" ");
  return tags;
}