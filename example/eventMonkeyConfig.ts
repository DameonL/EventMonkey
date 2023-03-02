import eventMonkey, { EventMonkeyConfiguration } from "eventmonkey";

const announcement = {
  channel: "announcements",
  beforeStart: eventMonkey.time.minutes(30),
  onStart: true,
};

const configuration: EventMonkeyConfiguration = {
  commandName: "seavent",
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
      name: "Hangout",
      discussionChannel: "hangouts",
      voiceChannel: "Hangout",
      announcement,
    },
    {
      name: "Lecture",
      discussionChannel: "lectures",
      stageChannel: "Lecture",
      announcement,
    },
  ],
  editingTimeout: eventMonkey.time.minutes(30),
  closeThreadsAfter: eventMonkey.time.days(1),
  timeZone: {
    name: "PST",
    offset: -8,
  },
};

export default configuration;