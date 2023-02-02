import { ButtonInteraction } from "discord.js";

const buttonHandlers: {
  [handlerName: string]: (
    interaction: ButtonInteraction
  ) => void | Promise<void>;
} = {
  attending: (interaction: ButtonInteraction) => {
    const attendingEmbed = interaction.message.embeds[1];
    const attendingField = attendingEmbed.fields.find(
      (x) => x.name === "Attending"
    );
    if (!attendingField) throw new Error("Unable to find attending field.");

    const userString = `${interaction.user.username} (${interaction.user.id})`;

    let attendees = attendingField.value;
    if (attendees.includes(userString)) {
      interaction.reply({
        content: "It looks like you're already attending!",
        ephemeral: true,
      });
      return;
    }

    attendees = `${attendees}\n${userString}`;
    attendingField.value = attendees;
    interaction.reply({
      content: "Congratulations, you're going!",
      ephemeral: true,
    });
    interaction.message.edit({
      embeds: [interaction.message.embeds[0], attendingEmbed],
    });
  },
  notAttending: (interaction: ButtonInteraction) => {
    const eventEmbed = interaction.message.embeds[0];
    const attendingEmbed = interaction.message.embeds[1];
    const attendingField = attendingEmbed.fields.find(
      (x) => x.name === "Attending"
    );
    if (!attendingField) throw new Error("Unable to find attending field.");

    const eventAuthorId = eventEmbed.author?.name.match(
      /(?<=\().*(?=\)$)/i
    )?.[0] as string;
    if (eventAuthorId === interaction.user.id) {
      interaction.reply({
        content: `Hey, you can't leave your own event! If you want to cancel your event, use the "/event cancel" command.`,
        ephemeral: true,
      });
      return;
    }

    const userString = `${interaction.user.username} (${interaction.user.id})`;

    let attendees = attendingField.value;
    if (!attendees.includes(userString)) {
      interaction.reply({
        content: "Sorry, I don't see that you're attending!",
        ephemeral: true,
      });
      return;
    }

    const attendeeArray = attendees.split("\n");
    attendeeArray.splice(attendeeArray.indexOf(userString), 1);

    attendees = attendeeArray.join("\n");
    attendingField.value = attendees;

    interaction.reply({ content: "Sorry you can't make it!", ephemeral: true });
    interaction.message.edit({
      embeds: [interaction.message.embeds[0], attendingEmbed],
    });
  },
};

export default buttonHandlers;