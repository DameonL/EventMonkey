import { GuildScheduledEventEntityType } from "discord.js";
import eventMonkey, { EventMonkeyConfiguration } from "eventmonkey";
import { EventAnnouncement } from "eventmonkey/EventMonkeyConfiguration";

const announcements: EventAnnouncement[] = [{
  channel: "announcements",
  beforeStart: eventMonkey.time.toMilliseconds.minutes(30),
}, {
  channel: "announcements",
  beforeStart: 0,
  message: "An event is happening, you better get in here!",
  mention: {
    attendees: true,
    here: true
  },
}];

function configuration(): EventMonkeyConfiguration {
  return {
    commandName: "eventmonkey",
    eventTypes: [
      {
        name: "Meetup",
        description: "A hosted, in-person event",
        discussionChannel: "meetups",
        announcements,
        entityType: GuildScheduledEventEntityType.External,
        defaultImageUrl:
          "https://cdn.discordapp.com/attachments/895476102242394135/1084294974771843072/DALLE_2023-03-11_18.00.27_-_a_fantasy_calendar_digital_art.png",
      },
      {
        name: "Happening",
        description: "A freeform in-person without formal hosting",
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
    editingTimeout: eventMonkey.time.toMilliseconds.minutes(30),
    closeThreadsAfter: eventMonkey.time.toMilliseconds.days(1),
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
