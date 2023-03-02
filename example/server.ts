import discord from "discord.js";
import configuration from "./eventMonkeyConfig";
import eventMonkey from "eventmonkey";

startServer();

const client = new discord.Client({
  intents: [
    discord.GatewayIntentBits.Guilds,
    discord.GatewayIntentBits.GuildMessages,
    discord.GatewayIntentBits.GuildPresences,
    discord.GatewayIntentBits.GuildVoiceStates,
    discord.GatewayIntentBits.GuildMembers,
    discord.GatewayIntentBits.GuildMessageReactions,
    discord.GatewayIntentBits.GuildScheduledEvents,
    discord.GatewayIntentBits.MessageContent,
  ],
});

async function startServer() {
  await client.login(process.env.botToken);

  client.on(discord.Events.ClientReady, onClientReady);
}

async function onClientReady(client: discord.Client) {
  configuration.discordClient = client;
  await eventMonkey.configure(configuration);
  await eventMonkey.registerCommands();
}