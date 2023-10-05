import { GuildScheduledEventEntityType } from "discord.js";
import eventMonkey, { EventMonkeyConfiguration } from "eventmonkey";
import { EventAnnouncement, EventAnnouncementType } from "eventmonkey/EventMonkeyConfiguration";

// Defines the announcements associated with an event
const announcements: EventAnnouncement[] = [
  {
    type: EventAnnouncementType.starting,
    channel: "announcements",
    timeBefore: eventMonkey.time.toMilliseconds.minutes(30), // How long before the event starts to announce
  },
  {
    type: EventAnnouncementType.started, // Determines when the announcement is fired
    channel: "announcements", // The name or ID of the channel to announce in
    message: "An event is happening, you better get in here!", // Custom messages can be a string or a function that returns a string
    // Options to allow the bot to add mentions to the message
    mention: {
      attendees: true,
      here: true,
    },
  },
  {
    type: EventAnnouncementType.ending,
    channel: "announcements",
    timeBefore: eventMonkey.time.toMilliseconds.minutes(5),
  },
  {
    type: EventAnnouncementType.ended,
    channel: "announcements",
  },
];

function configuration(): EventMonkeyConfiguration {
  return {
    commandName: "eventmonkey", // The slash command to use for creating, editing, and removing events
    eventTypes: [
      {
        name: "Meetup", // The displayed name for this type of event
        description: "A hosted, in-person event", // A description for the type of event
        discussionChannel: "meetups", // Used as the base channel for threads created for this event type
        announcements,
        entityType: GuildScheduledEventEntityType.External, // See the Discord API for more information
        defaultImageUrl:
          "https://cdn.discordapp.com/attachments/895476102242394135/1084294974771843072/DALLE_2023-03-11_18.00.27_-_a_fantasy_calendar_digital_art.png",
      },
      {
        name: "Happening",
        description: "A freeform in-person event without formal hosting",
        discussionChannel: "happenings",
        announcements,
        entityType: GuildScheduledEventEntityType.External,
        defaultImageUrl:
          "https://cdn.discordapp.com/attachments/895476102242394135/1084294974771843072/DALLE_2023-03-11_18.00.27_-_a_fantasy_calendar_digital_art.png",
      },
      {
        name: "🎤 Hangout",
        description: "A relaxed conversation in a voice channel",
        discussionChannel: "hangouts",
        channel: "Hangout",
        announcements,
        entityType: GuildScheduledEventEntityType.Voice,
        defaultImageUrl:
          "https://cdn.discordapp.com/attachments/895476102242394135/1084294974771843072/DALLE_2023-03-11_18.00.27_-_a_fantasy_calendar_digital_art.png",
      },
      {
        name: "🗣 Lecture",
        description: "A voice event with moderation and limited speakers",
        discussionChannel: "lectures",
        channel: "Lecture",
        announcements,
        entityType: GuildScheduledEventEntityType.StageInstance,
        defaultImageUrl:
          "https://cdn.discordapp.com/attachments/895476102242394135/1084294974771843072/DALLE_2023-03-11_18.00.27_-_a_fantasy_calendar_digital_art.png",
      },
    ],
    editingTimeout: eventMonkey.time.toMilliseconds.minutes(30), // If a user does not finish editing an event in this timeframe, it will be saved and editing cancelled
    closeThreadsAfter: eventMonkey.time.toMilliseconds.days(1), // After an event has ended, how long should we wait to close and lock the thread?
    // Timezone definitions. These definitions account for Pacific Time with Daylight Savings Time
    timeZones: [
      {
        name: "PST",
        offset: -8,
        start: eventMonkey.time.getNthWeekday(new Date().getFullYear() - 1, 10, 0, 1),
        end: eventMonkey.time.getNthWeekday(new Date().getFullYear(), 2, 0, 2),
      },
      {
        name: "PDT",
        offset: -7,
        start: eventMonkey.time.getNthWeekday(new Date().getFullYear(), 2, 0, 2),
        end: eventMonkey.time.getNthWeekday(new Date().getFullYear(), 10, 0, 1),
      },
      {
        name: "PST",
        offset: -8,
        start: eventMonkey.time.getNthWeekday(new Date().getFullYear(), 10, 0, 1),
        end: eventMonkey.time.getNthWeekday(new Date().getFullYear() + 1, 2, 0, 2),
      },
    ],
  };
}

export default configuration;
