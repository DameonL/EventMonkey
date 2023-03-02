import discord from "discord.js";
import configuration from "./eventMonkeyConfig";
import eventMonkey from "eventmonkey";
import dotenv from "dotenv";
import express from "express";

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

startServer();

async function startServer() {
  const expressServer = express();
  expressServer.listen(8080);
  expressServer.get("/", (request, response, next) => {
    response.send("Eventmonkey is active.");
  })
  
  dotenv.config();
  await client.login(process.env.botToken);
  console.log("Login success");

  client.on(discord.Events.ClientReady, onClientReady);
  client.on(discord.Events.Raw, (args: any) => { console.log(JSON.stringify(args, undefined, 1)); });
}

async function onClientReady(client: discord.Client) {
  console.log("Client ready");
  configuration.discordClient = client;
  await eventMonkey.configure(configuration);
  await eventMonkey.registerCommands();
  console.log("Commands registered.");
}