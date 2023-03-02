import {
  EmbedBuilder,
  GuildScheduledEventStatus,
  ThreadChannel,
} from "discord.js";
import Configuration from "../Configuration";
import Time from "./Time";

export async function sendEventClosingMessage(
  thread: ThreadChannel,
  status:
    | GuildScheduledEventStatus.Canceled
    | GuildScheduledEventStatus.Completed
) {
  const completed = status === GuildScheduledEventStatus.Completed;
  let nextTime =
    (Configuration.current.closeThreadsAfter ?? Time.toMilliseconds.days(1)) /
    Time.toMilliseconds.days(1);
  let timeUnit = "day";
  if (nextTime <= 1) {
    nextTime =
      (Configuration.current.closeThreadsAfter ?? Time.toMilliseconds.days(1)) /
      Time.toMilliseconds.hours(1);
    timeUnit = "hour";
  }
  if (nextTime <= 1) {
    nextTime =
      (Configuration.current.closeThreadsAfter ?? Time.toMilliseconds.days(1)) /
      Time.toMilliseconds.minutes(1);
    timeUnit = "minute";
  }

  nextTime = Math.round(nextTime);
  if (nextTime > 1) timeUnit += "s";

  const closeMessage = await thread.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(`Event is ${completed ? "Over" : "Canceled"}`)
        .setDescription(
          `This event ${
            completed ? "is over" : "has been canceled"
          }. The thread will be locked and archived after ${nextTime} ${timeUnit} of inactivity.`
        ),
    ],
  });
  await closeMessage.pin();
}
