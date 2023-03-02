import Configuration from "../Configuration";

export default {
  toMilliseconds: {
    days,
    hours,
    minutes,
    seconds,
  },
  getTimeFromString,
  getTimeString,
};

export function days(numberOfDays: number) {
  return hours(24) * numberOfDays;
}

export function hours(numberOfHours: number) {
  return minutes(60) * numberOfHours;
}

export function minutes(numberOfMinutes: number) {
  return seconds(60) * numberOfMinutes;
}

export function seconds(numberOfSeconds: number) {
  return 1000 * numberOfSeconds;
}

export function getTimeFromString(text: string): Date {
  const matches = text.match(
    /(?<time>\d\d?\/\d\d?\/\d\d(\d\d)?,?\s+\d\d?:\d\d\s+(AM|PM))/i
  );
  if (!matches || !matches.groups)
    throw new Error("Unable to parse date from string.");

  const output = new Date(matches.groups.time);
  output.setHours(
    output.getHours() + hours(Configuration.current.timeZone.offset)
  );
  return output;
}

export function getTimeString(date: Date): string {
  const offsetDate = new Date(date);
  offsetDate.setHours(
    offsetDate.getHours() - hours(Configuration.current.timeZone.offset)
  );

  return `${date
    .toLocaleString("en-us", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "")
    .replace(" ", " ")} ${
    Configuration.current.timeZone ? Configuration.current.timeZone.name : ""
  }`;
}
