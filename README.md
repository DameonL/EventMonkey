#### eventMonkey is a database-free package that provides any Discord bot with the ability to schedule events that use Discord's GuildScheduledEvent API as well as a discussion thread.

### Features:
- RSVP List
- Thread auto-management (archives and locks the thread after it becomes inactive)
- Recurring events - Events can be set up to recur hourly, daily, weekly, or monthly
- Notifications - Notifications can appear before events and when they start

### Getting Started:
To start eventMonkey, you call the `configure` function. If the configuration has a `discordClient` defined, eventMonkey will begin running regular maintenance tasks. At this point, you can call the `registerCommands` function. If you would prefer to handle registration yourself, you can retrieve a `SlashCommandBuilder` using `commands.create.builder()` and `commands.edit.builder()`.

```js
  // Barebones bot configuration
  import eventMonkey from "eventmonkey";
  import { Client } from "discord.js";

  const discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildScheduledEvents,
      GatewayIntentBits.MessageContent,
    ]
  });

  await discordClient.login(process.env.botToken);
  const configuration = {
    ...eventMonkey.defaultConfiguration(),
    discordClient,
    eventTypes: [
      {
        name: "Meetup",
        channel: "meetups",
        announcement: {
          onStart: true,
        },
      }
    ]
  };

  eventMonkey.configure(configuration);
  eventMonkey.registerCommands();
```

### Configuration:
Before any of the commands are built, you must call `configure()` with a valid EventMonkeyConfiguration. The `discordClient` on the configuration may be null at this point, but must be provided before any of the commands can be used. A basic default configuration object can be acquired by calling `defaultConfiguration()`. At a minimum, you must specify a `commandName`, `editingTimeout`, and at least one `EventType`.

The edit command is always commandName + "-edit".

`EventTypes` should correspond to a channel in every guild the bot is connected to. The `EventType.channel` can be either a channel name, or a specific channel ID.

The `editingTimeout` specifies the time in milliseconds before creating/editing an event will time out. This works best as a high number, 30 minutes or so gives a user plenty of time to edit an event.

A simple configuration would look like this:

```js
  {
    commandName: "eventMonkey",
    eventTypes: [
      {
        name: "Meetup",
        channel: "meetups",
        announcement: {
          channel: "general",
          beforeStart: minutesToMilliseconds(30),
          onStart: true,
        },
      },
      { name: "Happening", channel: "happenings" },
    ],
    editingTimeout: minutesToMilliseconds(30),
    closeThreadsAfter: daysToMilliseconds(1),
    roles: {
      allowed: ["event-creator"],
      denied: [],
    },
  };
```
