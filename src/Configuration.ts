import {
  EventMonkeyConfiguration,
} from "./EventMonkeyConfiguration";

let configuration: EventMonkeyConfiguration = defaultConfiguration();
function defaultConfiguration(): EventMonkeyConfiguration {
  return {
    commandName: "eventmonkey",
    eventTypes: [
      {
        name: "Meetup",
        discussionChannel: "meetups",
        announcement: {
          onStart: true,
        },
      },
    ],
    editingTimeout: 108000, // Default of 30 minutes
  };
}

export default {
  defaultConfiguration,
  get current() { return configuration },
  set current(value: EventMonkeyConfiguration) {
    configuration = value;
  }
};
