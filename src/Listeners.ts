import {
  ButtonInteraction,
  ChannelType, ForumChannel,
  InteractionCollector,
  TextChannel,
  ThreadChannel
} from "discord.js";
import buttonHandlers from "./ButtonHandlers/EventButtonHandlers";
import Configuration from "./Configuration";
import { getEventDetailsMessage } from "./Content/Embed/eventEmbed";
import logger from "./Logger";
import { resolveChannelString } from "./Utility/resolveChannelString";

export default {
  listenForButtons,
  listenForButtonsInChannel,
  listenForButtonsInThread,
};

async function listenForButtons() {
  const configuration = Configuration.current;

  if (!configuration.discordClient) return;

  for (const guild of configuration.discordClient.guilds.cache) {
    for (const eventType of configuration.eventTypes) {
      const channel = await resolveChannelString(
        eventType.discussionChannel,
        guild[1]
      );
      if (
        channel &&
        (channel.type === ChannelType.GuildForum ||
          channel.type === ChannelType.GuildText)
      ) {
        listenForButtonsInChannel(channel);
      }
    }
  }
}

async function listenForButtonsInChannel(channel: ForumChannel | TextChannel) {
  for (const thread of channel.threads.cache.values()) {
    if (!thread.archived) await listenForButtonsInThread(thread);
  }
}

async function listenForButtonsInThread(thread: ThreadChannel) {
  const eventMessage = await getEventDetailsMessage(thread);
  if (!eventMessage) return;

  const collector = thread.createMessageComponentCollector({
    filter: (submissionInteraction) =>
      submissionInteraction.customId.startsWith(eventMessage.id),
  }) as InteractionCollector<ButtonInteraction>;

  collector.on("collect", async (interaction: ButtonInteraction) => {
    try {
      const buttonId = interaction.customId.match(/(?<=_button_).*$/i)?.[0];
      if (!buttonId) throw new Error("Unable to get button ID from customId");
  
      const handler = buttonHandlers[buttonId];
      if (!handler) throw new Error(`No handler for button ID ${buttonId}`);
  
      await interaction.deferReply({ ephemeral: true });
      await handler(interaction);
    } catch (error) {
      logger.error(`Error handling thread button ${interaction.customId}`, error);
    }
});
}