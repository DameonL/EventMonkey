import { Channel, ChannelType, Guild } from "discord.js";

export async function resolveChannelString(
  text: string,
  guild: Guild
): Promise<Channel> {
  if (text.match(/^\d+$/)) {
    const channel = await guild.channels.fetch(text);
    if (channel) return channel;
  }

  const channel = await guild.channels.cache.find(
    (x) =>
      (x.type === ChannelType.GuildText || x.type === ChannelType.GuildForum) &&
      x.name === text
  );
  if (channel) return channel;

  throw new Error(`Unable to resolve channel from string "${text}"`);
}
