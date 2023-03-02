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
    nextRecurrence.setHours(
      nextRecurrence.getHours() + recurrence.hours * nextTimeHeld
    );
  }

  if (recurrence.days) {
    nextRecurrence.setDate(
      nextRecurrence.getDate() + recurrence.days * nextTimeHeld
    );
  }

  if (recurrence.weeks) {
    nextRecurrence.setDate(
      nextRecurrence.getDate() + recurrence.weeks * 7 * nextTimeHeld
    );
  }

  if (recurrence.months) {
    nextRecurrence.setMonth(
      nextRecurrence.getMonth() + recurrence.months * nextTimeHeld
    );
  }

  return nextRecurrence;
}

export function getNextValidRecurrence(
  recurrence: EventRecurrence,
  eventDuration: number
) {
  const now = Date.now();
  let nextStartDate = getNextRecurrence(recurrence);
  recurrence.timesHeld++;

  while (nextStartDate.valueOf() < now) {
    const delta = now - nextStartDate.valueOf();
    if (delta > 0 && delta < Time.toMilliseconds.minutes(5)) {
      nextStartDate.setMinutes(nextStartDate.getMinutes() + 5);
      break;
    }

    nextStartDate = getNextRecurrence(recurrence);
    recurrence.timesHeld++;
  }

  const scheduledEndTime = new Date(getNextRecurrence(recurrence));
  scheduledEndTime.setHours(scheduledEndTime.getHours() + eventDuration);

  return { scheduledStartTime: nextStartDate, scheduledEndTime };
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

export function serializeRecurrence(recurrence: EventRecurrence) {
  const recurrenceAmount =
    recurrence.hours ??
    recurrence.days ??
    recurrence.weeks ??
    recurrence.months;
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
  }\nFirst held ${Time.getTimeString(recurrence.firstStartTime)}, and held ${
    recurrence.timesHeld
  } time${recurrence.timesHeld === 1 ? "" : "s"} since then!`;
}

export function deserializeRecurrence(recurrenceText: string): EventRecurrence {
  const failureMessage = "Unable to deserialize EventRecurrence";
  const deserialized: any = {};
  deserialized.firstStartTime = Time.getTimeFromString(recurrenceText);

  const frequencyMatch = recurrenceText.match(
    /^Occurs every (?<frequency>\d+) (?<unit>(hour|day|week|month)s?)$/im
  );
  if (!frequencyMatch || !frequencyMatch.groups)
    throw new Error(failureMessage);

  let unit = frequencyMatch.groups.unit;
  if (!unit.endsWith("s")) unit += "s";
  const frequency = Number(frequencyMatch.groups.frequency);
  if (isNaN(frequency)) throw new Error(failureMessage);

  deserialized[unit] = frequency;

  const timesHeldMatch = recurrenceText.match(
    /, and held (?<timesHeld>\d+) times? since then!$/i
  );
  if (!timesHeldMatch || !timesHeldMatch.groups)
    throw new Error(failureMessage);
  const timesHeld = Number(timesHeldMatch.groups.timesHeld);
  if (isNaN(timesHeld)) throw new Error(failureMessage);

  deserialized.timesHeld = timesHeld;

  return deserialized;
}
