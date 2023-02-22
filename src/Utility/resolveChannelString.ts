import { Channel, Guild } from "discord.js";

export async function resolveChannelString(
  text: string,
  guild: Guild
): Promise<Channel & { name: string }> {
  if (text.match(/^\d+$/)) {
    const channel = await guild.channels.fetch(text);
    if (channel) return channel;
  }

  const channel = await guild.channels.cache.find((x) => x.name === text);
  if (channel) return channel;

  throw new Error(`Unable to resolve channel from string "${text}"`);
}
