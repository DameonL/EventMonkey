import { EmbedBuilder } from "discord.js";
import { EventMonkeyEvent } from "../../EventMonkeyEvent";

export function attendees(event: EventMonkeyEvent): EmbedBuilder {
  const attendeesEmbed = new EmbedBuilder().setTitle("Attendees");
  attendeesEmbed.addFields([
    {
      name: "Attending",
      value: event.author.toString(),
    },
  ]);
  
  return attendeesEmbed;
}
