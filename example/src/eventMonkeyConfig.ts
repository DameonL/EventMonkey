import { GuildScheduledEventEntityType } from "discord.js";
import eventMonkey, { EventMonkeyConfiguration } from "eventmonkey";
import { EventAnnouncement, EventAnnouncementType } from "eventmonkey/EventMonkeyConfiguration";

/* Defines the announcements associated with an event */
const announcements: EventAnnouncement[] = [
  {
    type: EventAnnouncementType.starting,
    channel: "announcements",
    timeBefore: eventMonkey.time.toMilliseconds.minutes(30), // How long before the event starts to announce
  },
  {
    /*  Determines when the announcement is fired. Starting/ending events fire at some time before the event starts/ends.
     *  Started/ended events fire the instant the event starts/ends. */
    type: EventAnnouncementType.started,
    /* The name or ID of the channel to announce in */
    channel: "announcements",
    /* Custom messages can be a string or a function that returns a string. */
    message: "An event is happening, you better get in here!",
    /* Options to allow the bot to add mentions to the message */
    mention: {
      /* Will mention each attendee by name. */
      // attendees: true,
      /* @here. @everyone is also available as an option. */
      // here: true,
    },
  },
  {
    type: EventAnnouncementType.ending,
    channel: "announcements",
    /* Announce 5 minutes before the event ends. */
    timeBefore: eventMonkey.time.toMilliseconds.minutes(5),
  },
  {
    type: EventAnnouncementType.ended,
    channel: "announcements",
  },
];

function configuration(): EventMonkeyConfiguration {
  return {
    /* The slash command to use for event management. */
    commandName: "eventmonkey",
    /* Defines the roles associated with event creation. If no roles are defined, any user may create events. */
    roles: { allowed: ["Event Maker"], denied: ["No Event Access"] },
    /* Defines the "types" of events. */
    eventTypes: [
      {
        /* The displayed name for this type of event. Shown when a user is creating an event. */
        name: "Meetup",
        /* The description to display for this type of event. Should be short. Shown in a dropdown when a user is creating an event. */
        description: "A hosted, in-person event",
        /* Used as the base channel for threads created for this event type */
        discussionChannel: "meetups",
        announcements,
        /* View the Discord API docs for information on these types. */
        entityType: GuildScheduledEventEntityType.External,
        /* If the user doesn't provide an image when creating an event, this image will be used. */
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
        /*  This can be a channel name, or a channel ID, or an array of names/IDs. If you provide an array, eventMonkey will try to find an open time slot
         *  in any of the channels. */
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
    /*  If a user does not finish editing an event in this timeframe, it will be saved and editing cancelled. */
    editingTimeout: eventMonkey.time.toMilliseconds.minutes(30),
    /* After an event has ended, how long should we wait to close and lock the thread? */
    closeThreadsAfter: eventMonkey.time.toMilliseconds.days(1),
    /* Timezone definitions. These definitions account for Pacific Time with Daylight Savings Time. */
    timeZones: [
      {
        /* The name of the timezone is for display purposes only. */
        name: "PST",
        /* The offset from the server where the bot is hosted, in hours. */
        offset: -8,
        /* The dates during which this timezone will apply, used for areas with changing offsets like Daylight Savings Time. */
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
