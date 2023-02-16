import { ButtonInteraction, ChannelType, ForumChannel, InteractionCollector, Message, ModalSubmitInteraction, TextChannel, ThreadChannel } from "discord.js";
import { configuration, EventMonkeyEvent } from "./EventMonkey";
import buttonHandlers from "./ButtonHandlers/EventButtonHandlers";
import eventCreationButtonHandlers from "./ButtonHandlers/EventCreationButtonHandlers";
import { resolveChannelString } from "./Utility/resolveChannelString";

export async function listenForButtons() {
  if (!configuration.discordClient) return;

  for (const guild of configuration.discordClient.guilds.cache) {
    for (const eventType of configuration.eventTypes) {
      const channel = await resolveChannelString(eventType.channel, guild[1]);
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

export async function listenForButtonsInChannel(
  channel: ForumChannel | TextChannel
) {
  for (const thread of channel.threads.cache.values()) {
    if (!thread.archived) await listenForButtonsInThread(thread);
  }
}

export async function listenForButtonsInThread(thread: ThreadChannel) {
  const collector = thread.createMessageComponentCollector({
    filter: (submissionInteraction) =>
      (configuration.discordClient?.user &&
        submissionInteraction.customId.startsWith(
          configuration.discordClient.user.id
        )) == true,
  }) as InteractionCollector<ButtonInteraction>;

  collector.on("collect", (interaction: ButtonInteraction) => {
    const buttonId = interaction.customId.match(/(?<=_button_).*$/i)?.[0];
    if (!buttonId) throw new Error("Unable to get button ID from customId");

    const handler = buttonHandlers[buttonId];
    if (!handler) throw new Error(`No handler for button ID ${buttonId}`);

    handler(interaction);
  });
}

export function getEmbedSubmissionCollector(
  event: EventMonkeyEvent,
  message: Message
): InteractionCollector<ButtonInteraction> {
  if (!message.channel)
    throw new Error("This command needs to be triggered in a channel.");

  if (event.submissionCollector) return event.submissionCollector;

  const submissionCollector =
    message.channel.createMessageComponentCollector({
      filter: (submissionInteraction) =>
        submissionInteraction.user.id === event.author.id &&
        submissionInteraction.customId.startsWith(
          configuration.discordClient?.user?.id ?? ""
        ),
      time: configuration.editingTimeout,
    }) as InteractionCollector<ButtonInteraction>;

  submissionCollector.on(
    "collect",
    async (submissionInteraction: ButtonInteraction) => {
      const handlerName = submissionInteraction.customId.replace(
        `${configuration.discordClient?.user?.id}_${event.id}_button_`,
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
          message,
          configuration.discordClient
        );
      }
    }
  );

  submissionCollector.on("end", (collected, reason) => {
    if (reason === "time") {
      message.edit({
        content:
          "Sorry, your event editing timed out! You can continue from where you left off when ready.",
        embeds: [],
        components: [],
      });
    }
  });

  return submissionCollector;
}

