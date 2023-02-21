import { ButtonInteraction } from "discord.js";
import {
  attendeesToEmbed,
  getAttendeesFromMessage,
} from "../Content/Embed/attendees";
import { getEventDetailsEmbed } from "../Content/Embed/eventEmbed";

const buttonHandlers: {
  [handlerName: string]: (interaction: ButtonInteraction) => Promise<void>;
} = {
  attending: async (interaction: ButtonInteraction) => {
    let attendees = getAttendeesFromMessage(interaction.message);
    if (attendees.includes(interaction.user.id)) {
      interaction.editReply({
        content: "It looks like you're already attending!",
      });
      return;
    }

    attendees.push(interaction.user.id);

    const newAttendingEmbed = attendeesToEmbed(attendees);
    await interaction.message.edit({
      embeds: [interaction.message.embeds[0], newAttendingEmbed],
    });

    await interaction.editReply({
      content: "Congratulations, you're going!",
    });
  },
  notAttending: async (interaction: ButtonInteraction) => {
    const eventEmbed = await getEventDetailsEmbed(interaction.message);
    let attendees = getAttendeesFromMessage(interaction.message);

    const eventAuthorId = eventEmbed.author?.name.match(
      /(?<=\().*(?=\)$)/i
    )?.[0] as string;
    if (eventAuthorId === interaction.user.id) {
      await interaction.editReply({
        content: `Hey, you can't leave your own event! If you want to cancel your event, use the edit event command, and hit the red "Cancel" button.`,
      });
      return;
    }

    if (!attendees.includes(interaction.user.id)) {
      await interaction.editReply({
        content: "Sorry, I don't see that you're attending!",
      });
      return;
    }

    while (attendees.includes(interaction.user.id) && attendees.length > 1) {
      attendees.splice(attendees.indexOf(interaction.user.id), 1);
    }

    await interaction.message.edit({
      embeds: [interaction.message.embeds[0], attendeesToEmbed(attendees)],
    });
    await interaction.editReply({ content: "Sorry you can't make it!" });
  },
};

export default buttonHandlers;
