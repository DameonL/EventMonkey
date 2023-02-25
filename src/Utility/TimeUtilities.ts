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

function days(numberOfDays: number) {
  return hours(24) * numberOfDays;
}

function hours(numberOfHours: number) {
  return minutes(60) * numberOfHours;
}

function minutes(numberOfMinutes: number) {
  return seconds(60) * numberOfMinutes;
}

function seconds(numberOfSeconds: number) {
  return 1000 * numberOfSeconds;
}

function getTimeFromString(text: string): Date {
  const matches = text.match(
    /(?<time>\d\d?\/\d\d?\/\d\d(\d\d)?,? \d\d?:\d\d\s(AM|PM)( [a-z]{3})?)/i
  );
  if (!matches || !matches.groups)
    throw new Error("Unable to parse date from string.");

  const output = new Date(matches.groups.time);
  return output;
}

function getTimeString(date: Date): string {
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
