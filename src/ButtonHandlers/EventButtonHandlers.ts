import { ButtonInteraction, ChannelType } from "discord.js";
import { attendeesToEmbed, getAttendeesFromMessage } from "../Content/Embed/attendees";
import { deseralizeEventEmbed, getEventDetailsEmbed } from "../Content/Embed/eventEmbed";
import Configuration from "../Configuration";
import logger from "../Logger";

const buttonHandlers: {
  [handlerName: string]: (interaction: ButtonInteraction) => Promise<void>;
} = {
  attending: async (interaction: ButtonInteraction) => {
    let attendees = getAttendeesFromMessage(interaction.message);
    if (
      !Configuration.current.discordClient ||
      (interaction.message.channel.type !== ChannelType.PublicThread &&
        interaction.message.channel.type !== ChannelType.PrivateThread)
    ) {
      return;
    }

    const monkeyEvent = await deseralizeEventEmbed(interaction.message.channel, Configuration.current.discordClient);
    if (!monkeyEvent) {
      logger.error("Couldn't get event from interaction channel.");
      await interaction.editReply("Sorry, something went wrong! Please contact an administrator.");
      return;
    }

    if (monkeyEvent.maxAttendees && attendees.length >= monkeyEvent.maxAttendees) {
      await interaction.editReply("Sorry, this event has the maximum number of attendees.");
      return;
    }

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

    if (interaction.message.channel.type === ChannelType.PublicThread) {
      interaction.message.channel.members.add(interaction.user);
    }
  },
  notAttending: async (interaction: ButtonInteraction) => {
    const eventEmbed = await getEventDetailsEmbed(interaction.message);
    let attendees = getAttendeesFromMessage(interaction.message);

    const eventAuthorId = eventEmbed.author?.name.match(/(?<=\().*(?=\)$)/i)?.[0] as string;
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
    if (interaction.message.channel.type === ChannelType.PublicThread) {
      interaction.message.channel.members.remove(interaction.user.id);
    }
  },
};

export default buttonHandlers;
