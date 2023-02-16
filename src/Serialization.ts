import { ThreadChannel } from "discord.js";
import { configuration } from "./EventMonkey";

export function getEventNameFromString(text: string): string {
  const matches = text.match(/(AM|PM) - (?<name>.*)(?= hosted by)/i);
  if (!matches || !matches.groups)
    throw new Error("Unable to parse event name from string.");

  return matches.groups.name;
}

export function getTimeFromString(text: string): Date {
  const matches = text.match(
    /(?<time>\d\d?\/\d\d?\/\d\d(\d\d)?,? \d\d?:\d\d\s(AM|PM)( [a-z]{3})?)/i
  );
  if (!matches || !matches.groups)
    throw new Error("Unable to parse date from string.");

  const output = new Date(matches.groups.time);
  return output;
}

export function getTimeString(date: Date): string {
  return date
    .toLocaleString("en-us", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: configuration.timeZone
        ? configuration.timeZone
        : Intl.DateTimeFormat().resolvedOptions().timeZone,
      timeZoneName: "short",
    })
    .replace(",", "")
    .replace(" ", " ");
}

export async function getAttendeeIds(thread: ThreadChannel) {
  const attendees =
    (await getAttendeeTags(thread))?.replace(/[^0-9\s]/gi, "").split("\n") ??
    "";
  return attendees;
}

export async function getAttendeeTags(thread: ThreadChannel) {
  const embedMessage = (await thread.messages.fetchPinned()).find((x) =>
    x.embeds.find((x) => x.title === "Attendees")
  );
  if (!embedMessage) return null;
  const threadEmbed = embedMessage.embeds.at(1);

  const attendeeField = threadEmbed?.fields.find((x) => x.name === "Attending");
  if (!attendeeField) throw new Error("Unable to find attending field.");

  const attendees = attendeeField.value.replace(/\n/gi, " ");
  return attendees;
}
