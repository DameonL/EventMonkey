import { ThreadChannel } from "discord.js";

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
