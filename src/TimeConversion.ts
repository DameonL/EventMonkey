export function hours(numberOfHours: number) {
  return minutes(60) * numberOfHours;
}

export function minutes(numberOfMinutes: number) {
  return seconds(60) * numberOfMinutes;
}

export function seconds(numberOfSeconds: number) {
  return 100 * numberOfSeconds;
}
