import Configuration from "../Configuration";
import { EventMonkeyTimeZone } from "../EventMonkeyConfiguration";

const toMilliseconds = {
  days: (numberOfDays: number) => toMilliseconds.hours(24) * numberOfDays,
  hours: (numberOfHours: number) => toMilliseconds.minutes(60) * numberOfHours,
  minutes: (numberOfMinutes: number) => toMilliseconds.seconds(60) * numberOfMinutes,
  seconds: (numberOfSeconds: number) => 1000 * numberOfSeconds,
};

const fromMilliseconds = {
  days: (milliseconds: number) => fromMilliseconds.seconds(milliseconds) / 24,
  hours: (milliseconds: number) => fromMilliseconds.minutes(milliseconds) / 60,
  minutes: (milliseconds: number) => fromMilliseconds.seconds(milliseconds) / 60,
  seconds: (milliseconds: number) => milliseconds / 1000,
};

const timeDurations = [
  { name: "year", milliseconds: toMilliseconds.days(365) },
  { name: "week", milliseconds: toMilliseconds.days(7) },
  { name: "day", milliseconds: toMilliseconds.days(1) },
  { name: "hour", milliseconds: toMilliseconds.hours(1) },
  { name: "minute", milliseconds: toMilliseconds.minutes(1) },
];

const Time = {
  getEffectiveTimeZone,
  getNthWeekday,
  getTimeFromString,
  getTimeString,
  toMilliseconds,
  fromMilliseconds,
  getDurationDescription,
};

export default Time;

function getNthWeekday(year: number, month: number, weekday: number, nth: number): Date {
  const date = new Date(year, month, 0, 0, 0, 0);
  const startWeekday = date.getDay();
  let offset = weekday - startWeekday;
  if (offset < 0) {
    offset = Math.abs(offset) + 1;
  }

  offset += startWeekday;
  date.setDate(date.getDate() + offset);
  for (let i = 1; i < nth; i++) {
    date.setDate(date.getDate() + 7);
  }

  return date;
}

function getEffectiveTimeZone(): EventMonkeyTimeZone {
  let today = new Date();
  today = new Date(today.getFullYear(), today.getMonth(), today.getDay());

  for (const timeZone of Configuration.current.timeZones) {
    if (
      (!timeZone.start || today.valueOf() >= timeZone.start.valueOf()) &&
      (!timeZone.end || today.valueOf() < timeZone.end.valueOf())
    ) {
      return timeZone;
    }
  }

  throw new Error(`Unable to get timezone for date ${today.toLocaleDateString()}`);
}

function getTimeFromString(text: string, useTimezone: boolean = true): Date {
  const matches = text.match(/(?<time>\d\d?\/\d\d?\/\d\d(\d\d)?,?\s+\d\d?:\d\d\s+(AM|PM))/i);
  if (!matches || !matches.groups) throw new Error("Unable to parse date from string.");

  const output = new Date(matches.groups.time);
  if (useTimezone) {
    output.setHours(output.getHours() - getEffectiveTimeZone().offset);
  }

  return output;
}

function getTimeString(date: Date, useTimezone: boolean = true): string {
  const offsetDate = new Date(date);
  if (useTimezone) {
    offsetDate.setHours(offsetDate.getHours() + getEffectiveTimeZone().offset);
  }

  return `${offsetDate
    .toLocaleString("en-us", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "")
    .replace(" ", " ")} ${getEffectiveTimeZone().name}`;
}

function getDurationDescription(milliseconds: number) {
  let totalDuration = milliseconds;
  let timeString = "";
  for (let i = 0; i < timeDurations.length; i++) {
    const duration = timeDurations[i];

    if (totalDuration < duration.milliseconds) {
      continue;
    }

    const total = Math.floor(totalDuration / duration.milliseconds);
    totalDuration -= total * duration.milliseconds;
    if (total > 0) {
      timeString += `${timeString !== "" ? (i === timeDurations.length - 1 ? ", and " : ", ") : ""}${total} ${
        duration.name
      }${total > 1 ? "s" : ""}`;
    }
  }

  return timeString;
}
