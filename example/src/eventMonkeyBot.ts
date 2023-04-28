import discord from "discord.js";
import dotenv from "dotenv";
import eventMonkey from "eventmonkey";
import configuration from "./eventMonkeyConfig";

const client = new discord.Client({
  // A high timeout is important for handling large images.
  rest: { timeout: 60000 },
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
  dotenv.config();
  client.on(discord.Events.ClientReady, onClientReady);
  if (process.env.DEBUG) {
    client.on(discord.Events.Raw, (args: any) => {
      console.log(JSON.stringify(args, undefined, 1));
    });
  }
  await client.login(process.env.botToken);
}

async function onClientReady(client: discord.Client) {
  const config = configuration();
  config.discordClient = client;
  var uptime = 0;
  client.user?.setActivity(`Performing maintenance...`);
  await eventMonkey.configure(config);
  await eventMonkey.registerCommands();
  client.user?.setActivity(`Ready!`);
  setInterval(() => {
    uptime += 1;
    try {
      client.user?.setActivity(`Uptime: ${unitString(uptime)}`);
    } catch (error) {
      console.error("Error setting activity:");
      console.error(error);
    }
  }, 60000);
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
