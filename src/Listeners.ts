import {
  ButtonInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  ComponentType,
  ForumChannel,
  InteractionCollector,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import buttonHandlers from "./ButtonHandlers/EventButtonHandlers";
import eventCreationButtonHandlers from "./ButtonHandlers/EventCreationButtonHandlers";
import Configuration from "./Configuration";
import { getEventDetailsMessage } from "./Content/Embed/eventEmbed";
import { EventMonkeyEvent } from "./EventMonkey";
import { resolveChannelString } from "./Utility/resolveChannelString";

export default {
  listenForButtons,
  listenForButtonsInChannel,
  listenForButtonsInThread,
  getEmbedSubmissionCollector,
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
    const buttonId = interaction.customId.match(/(?<=_button_).*$/i)?.[0];
    if (!buttonId) throw new Error("Unable to get button ID from customId");

    const handler = buttonHandlers[buttonId];
    if (!handler) throw new Error(`No handler for button ID ${buttonId}`);

    await interaction.deferReply({ ephemeral: true });
    await handler(interaction);
  });
}

function getEmbedSubmissionCollector(
  event: EventMonkeyEvent,
  interaction: ChatInputCommandInteraction
) {
  if (
    !interaction.channel ||
    (interaction.channel.type !== ChannelType.GuildText &&
      interaction.channel.type !== ChannelType.PublicThread)
  )
    return;
  if (event.submissionCollector) event.submissionCollector.stop();
  const configuration = Configuration.current;

  const submissionCollector =
    interaction.channel.createMessageComponentCollector<ComponentType.Button>({
      filter: (submissionInteraction) =>
        submissionInteraction.user.id === event.author.id &&
        submissionInteraction.customId.startsWith(
          `${interaction.id}_${event.id}_`
        ),
      time: configuration.editingTimeout,
    });

  submissionCollector.on(
    "collect",
    async (submissionInteraction: ButtonInteraction) => {
      const handlerName = submissionInteraction.customId.replace(
        `${interaction.id}_${event.id}_button_`,
        ""
      );
      const handler = eventCreationButtonHandlers[handlerName];
      if (handler) {
        if (!configuration.discordClient || !configuration.discordClient.user) {
          throw new Error("Client not set or not connected.");
        }

        await handler(
          event,
          submissionInteraction,
          interaction,
          configuration.discordClient
        );
      }
    }
  );

  submissionCollector.on("end", (collected, reason) => {
    if (reason === "time") {
      interaction.editReply({
        content:
          "Sorry, your event editing timed out! You can continue from where you left off when ready.",
        embeds: [],
        components: [],
      });
    }
  });

  return submissionCollector;
}
