import eventMonkey, { EventMonkeyConfiguration } from "eventmonkey";

const announcement = {
  channel: "announcements",
  beforeStart: eventMonkey.time.toMilliseconds.minutes(30),
  onStart: true,
};

const configuration: EventMonkeyConfiguration = {
  commandName: "eventmonkey",
  eventTypes: [
    {
      name: "Meetup",
      discussionChannel: "meetups",
      announcement,
    },
    {
      name: "Happening",
      discussionChannel: "happenings",
      announcement,
    },
    {
      name: "🎤 Hangout",
      discussionChannel: "hangouts",
      voiceChannel: "Hangout",
      announcement,
    },
    {
      name: "🗣 Lecture",
      discussionChannel: "lectures",
      stageChannel: "Lecture",
      announcement,
    },
  ],
  editingTimeout: eventMonkey.time.toMilliseconds.minutes(30),
  closeThreadsAfter: eventMonkey.time.toMilliseconds.days(1),
  timeZone: {
    name: "PST",
    offset: -8,
  },
};

export default configuration;