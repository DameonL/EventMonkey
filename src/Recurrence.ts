import Time from "./Utility/Time";

export interface EventRecurrence {
  firstStartTime: Date;
  timesHeld: number;
  hours?: number;
  days?: number;
  weeks?: number;
  months?: number;
}

export function getNextRecurrence(recurrence: EventRecurrence): Date {
  const nextTimeHeld = recurrence.timesHeld + 1;
  const nextRecurrence = new Date(recurrence.firstStartTime);
  if (recurrence.hours) {
    nextRecurrence.setHours(nextRecurrence.getHours() + recurrence.hours * nextTimeHeld);
  }

  if (recurrence.days) {
    nextRecurrence.setDate(nextRecurrence.getDate() + recurrence.days * nextTimeHeld);
  }

  if (recurrence.weeks) {
    nextRecurrence.setDate(nextRecurrence.getDate() + recurrence.weeks * 7 * nextTimeHeld);
  }

  if (recurrence.months) {
    nextRecurrence.setMonth(nextRecurrence.getMonth() + recurrence.months * nextTimeHeld);
  }

  return nextRecurrence;
}

export function getNextValidRecurrence(recurrence: EventRecurrence, eventDuration: number) {
  const now = new Date();
  let nextStartDate = getNextRecurrence(recurrence);
  let scheduledEndTime = getNextEndDate(nextStartDate, eventDuration);
  recurrence.timesHeld++;

  while (nextStartDate.valueOf() < now.valueOf()) {
    const delta = now.valueOf() - nextStartDate.valueOf();
    if (delta > 0 && delta < Time.toMilliseconds.minutes(5)) {
      nextStartDate.setMinutes(nextStartDate.getMinutes() + 5);
      break;
    }

    nextStartDate = getNextRecurrence(recurrence);
    scheduledEndTime = getNextEndDate(nextStartDate, eventDuration);

    recurrence.timesHeld++;
  }

  return { scheduledStartTime: nextStartDate, scheduledEndTime };
}

function getNextEndDate(scheduledStartTime: Date, eventDuration: number) {
  const nextEnd = new Date(scheduledStartTime);
  nextEnd.setHours(scheduledStartTime.getHours() + eventDuration);
  return nextEnd;
}

export function getRecurrenceUnit(recurrence: EventRecurrence) {
  return recurrence.hours
    ? "hour"
    : recurrence.days
    ? "day"
    : recurrence.weeks
    ? "week"
    : recurrence.months
    ? "month"
    : undefined;
}

export async function serializeRecurrence(recurrence: EventRecurrence, guildId: string): Promise<string> {
  const recurrenceAmount = recurrence.hours ?? recurrence.days ?? recurrence.weeks ?? recurrence.months;
  const recurrenceDescription = recurrence.hours
    ? "hour"
    : recurrence.days
    ? "day"
    : recurrence.weeks
    ? "week"
    : recurrence.months
    ? "month"
    : undefined;

  if (!recurrenceAmount || !recurrenceDescription) {
    throw new Error("Recurrence has no settings.");
  }

  return `Occurs every ${recurrenceAmount} ${recurrenceDescription}${
    recurrenceAmount > 1 ? "s" : ""
  }\nFirst held ${await Time.getTimeString(recurrence.firstStartTime, guildId)}, and held ${recurrence.timesHeld} time${
    recurrence.timesHeld === 1 ? "" : "s"
  } since then!`;
}

export async function deserializeRecurrence(recurrenceText: string, guildId: string): Promise<EventRecurrence> {
  const failureMessage = "Unable to deserialize EventRecurrence";
  const deserialized: any = {};
  deserialized.firstStartTime = await Time.getTimeFromString(recurrenceText, guildId);

  const frequencyMatch = recurrenceText.match(/^Occurs every (?<frequency>\d+) (?<unit>(hour|day|week|month)s?)$/im);
  if (!frequencyMatch || !frequencyMatch.groups) throw new Error(failureMessage);

  let unit = frequencyMatch.groups.unit;
  if (!unit.endsWith("s")) unit += "s";
  const frequency = Number(frequencyMatch.groups.frequency);
  if (isNaN(frequency)) throw new Error(failureMessage);

  deserialized[unit] = frequency;

  const timesHeldMatch = recurrenceText.match(/, and held (?<timesHeld>\d+) times? since then!$/i);
  if (!timesHeldMatch || !timesHeldMatch.groups) throw new Error(failureMessage);
  const timesHeld = Number(timesHeldMatch.groups.timesHeld);
  if (isNaN(timesHeld)) throw new Error(failureMessage);

  deserialized.timesHeld = timesHeld;

  return deserialized;
}
