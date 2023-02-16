import { EmbedBuilder, GuildScheduledEventStatus, ThreadChannel } from "discord.js";
import { configuration } from "../EventMonkey";
import { getAttendeeTags } from "./Attendees";
import Time from "./Time";

const { toMilliseconds } = Time;

export async function sendEventClosingMessage(
  thread: ThreadChannel,
  status:
    | GuildScheduledEventStatus.Canceled
    | GuildScheduledEventStatus.Completed
) {
  const completed = status === GuildScheduledEventStatus.Completed;
  let nextTime = (configuration.closeThreadsAfter ?? toMilliseconds.days(1)) / toMilliseconds.days(1);
  let timeUnit = "day";
  if (nextTime <= 1) {
    nextTime = (configuration.closeThreadsAfter ?? toMilliseconds.days(1)) / toMilliseconds.hours(1);
    timeUnit = "hour";
  }
  if (nextTime <= 1) {
    nextTime = (configuration.closeThreadsAfter ?? toMilliseconds.days(1)) / toMilliseconds.minutes(1);
    timeUnit = "minute";
  }

  nextTime = Math.round(nextTime);
  if (nextTime > 1) timeUnit += "s";

  const closeMessage = await thread.send({
    content: (await getAttendeeTags(thread)) ?? "",
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

