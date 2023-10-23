#### eventMonkey is a database-free package that provides any Discord bot with the ability to schedule events that use Discord's GuildScheduledEvent API as well as a discussion thread.

### Features:

- Fancy Pants Event Editing - Events are created and edited using Discord's embeds and modals for a simple, intuitive user experience.
- RSVP List - Users mark their attendance or cancel their RSVP with the click of a button.
- Thread auto-management - Archives and locks event threads after they become inactive.
- Recurring events - Events can be set up to recur hourly, daily, weekly, or monthly.
- Notifications - Announcements can be configured to mention each attendee by name, roles, and more. Configure announcements to appear before events start and end.

### Getting Started:

To start eventMonkey, you call the `configure` function. If the configuration has a `discordClient` defined, eventMonkey will begin running regular maintenance tasks. At this point, you can call the `registerCommands` function. If you would prefer to handle registration yourself, you can retrieve a `SlashCommandBuilder` using `command.builder()`, and handle execution with the `command.execute` function.

[*View the example folder for a barebones implementation of a standalone bot.*](https://github.com/DameonL/eventMonkey/blob/main/example/src/eventMonkeyBot.ts)

### Configuration:

Before the command is built with `command.builder()`, you must call `configure()` with a valid EventMonkeyConfiguration. The `discordClient` on the configuration may be null at this point, but must be provided before any of the commands can be used. A basic default configuration object can be acquired by calling `defaultConfiguration()`. At a minimum, you must specify a `commandName`, `editingTimeout`, a `timeZone` definition, and at least one `EventType`.

[*The configuration file in the example folder contains a full list of settings, along with descriptions and examples of their usage.*](https://github.com/DameonL/eventMonkey/blob/main/example/src/eventMonkeyConfig.ts)