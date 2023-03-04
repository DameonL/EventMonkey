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
  });

  dotenv.config();
  client.on(discord.Events.ClientReady, onClientReady);
  if (process.env.DEBUG) {
    client.on(discord.Events.Raw, (args: any) => {
      console.log(JSON.stringify(args, undefined, 1));
    });
  }
  await client.login(process.env.botToken);
  console.log("Login success");
}

async function onClientReady(client: discord.Client) {
  console.log("Client ready");
  configuration.discordClient = client;
  var uptime = 0;
  setInterval(() => {
    uptime += 1;
    client.user?.setActivity(`Uptime: ${unitString(uptime)}`);
  }, 60000);
  await eventMonkey.configure(configuration);
  await eventMonkey.registerCommands();
  console.log("Commands registered.");

}

function unitString(minutes: number) {
  const units = [
    { name: "minute", minutes: 1 },
    { name: "hour", minutes: 60 },
    { name: "day", minutes: 60 * 24 },
    { name: "week", minutes: 60 * 24 * 7 },
    { name: "month", minutes: 60 * 24 * 7 * 4 },
    { name: "year", minutes: 525600 },
  ];

  let currentMinutes = minutes;
  let unitString;
  for (let i = units.length - 1; i >= 0; i--) {
    const unit = units[i];
    if (unit.minutes > currentMinutes) continue;

    const unitAmount = Math.floor(currentMinutes / unit.minutes);
    unitString = `${unitString ?? ""}${unitString ? ", " : ""}${unitAmount} ${unit.name}${unitAmount > 1 ? "s" : ""}`;
    currentMinutes -= unitAmount * unit.minutes;

    if (currentMinutes <= 0) break;
  }

  return unitString ?? "";
}
