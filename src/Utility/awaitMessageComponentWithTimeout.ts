import {
  ChatInputCommandInteraction,
  InteractionType,
  MappedInteractionTypes,
  Message,
  MessageComponentType,
} from "discord.js";
import logger from "../Logger";
import Time from "./Time";

async function awaitMessageComponentWithTimeout<T extends MessageComponentType>(
  interaction: ChatInputCommandInteraction,
  message: Message
): Promise<MappedInteractionTypes[T] | undefined> {
  try {
    const eventTypeResponse = await message.awaitMessageComponent<T>({
      filter: (x) => x.customId.startsWith(interaction.id),
      time: Time.toMilliseconds.minutes(5),
    });
    await eventTypeResponse.deferUpdate();
    interaction.editReply({ content: "Working...", components: [] });
    if (eventTypeResponse.type === InteractionType.MessageComponent) return eventTypeResponse;
  } catch (error: any) {
    if (error.message === "Collector received no interactions before ending with reason: time") {
      await interaction.editReply({ content: "Timed out! Come back when you're ready!", components: [] });
      return;
    }
    logger.error("", error);
    throw error;
  }
}

export default awaitMessageComponentWithTimeout;
