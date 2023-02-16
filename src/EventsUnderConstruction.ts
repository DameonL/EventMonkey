import { EventMonkeyEvent } from "./EventMonkey";
import { hours } from "./TimeConversion";

const eventsUnderConstruction: UserEventMap = {};

interface UserEventMap {
  [userId: string]: [Date, EventMonkeyEvent];
}

export function getEvent(userId: string) {
  if (userId in eventsUnderConstruction) return eventsUnderConstruction[userId][1];

  return undefined;
}

export function saveEvent(event: EventMonkeyEvent) {
  eventsUnderConstruction[event.author.id] = [new Date(), event];
}

export function deleteEvent(userId: string) {
  delete eventsUnderConstruction[userId];
}

export function maintainEvents() {
  try {
    const clearList: string[] = [];
    const now = new Date().valueOf();

    for (const userId in eventsUnderConstruction) {
      const eventTimestamp = eventsUnderConstruction[userId][0];
      if (Math.abs(now - eventTimestamp.valueOf()) >= hours(2)) {
        clearList.push(userId);
      }
    }

    for (const userId of clearList) {
      delete eventsUnderConstruction[userId];
    }
  } catch (error) {
    console.error(error);
  }
}

