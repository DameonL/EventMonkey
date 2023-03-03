import Configuration from "../Configuration";

const toMilliseconds = {
  days: (numberOfDays: number) => toMilliseconds.hours(24) * numberOfDays,
  hours: (numberOfHours: number) => toMilliseconds.minutes(60) * numberOfHours,
  minutes: (numberOfMinutes: number) =>
    toMilliseconds.seconds(60) * numberOfMinutes,
  seconds: (numberOfSeconds: number) => 1000 * numberOfSeconds,
};

const fromMilliseconds = {
  days: (milliseconds: number) => fromMilliseconds.seconds(milliseconds) / 24,
  hours: (milliseconds: number) => fromMilliseconds.minutes(milliseconds) / 60,
  minutes: (milliseconds: number) =>
    fromMilliseconds.seconds(milliseconds) / 60,
  seconds: (milliseconds: number) => milliseconds / 1000,
};

export default {
  getTimeFromString,
  getTimeString,
  toMilliseconds,
  fromMilliseconds,
};

function getTimeFromString(text: string, useTimezone: boolean = true): Date {
  const matches = text.match(
    /(?<time>\d\d?\/\d\d?\/\d\d(\d\d)?,?\s+\d\d?:\d\d\s+(AM|PM))/i
  );
  if (!matches || !matches.groups)
    throw new Error("Unable to parse date from string.");

  const output = new Date(matches.groups.time);
  if (useTimezone) {
    output.setHours(
      output.getHours() - Configuration.current.timeZone.offset
    );
  }
  
  return output;
}

function getTimeString(date: Date, useTimezone: boolean = true): string {
  const offsetDate = new Date(date);
  if (useTimezone) {
    offsetDate.setHours(
      offsetDate.getHours() + Configuration.current.timeZone.offset
    );
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
    .replace(" ", " ")} ${
    Configuration.current.timeZone.name
  }`;
}
