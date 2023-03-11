import { GuildScheduledEventEntityType, GuildScheduledEventStatus } from "discord.js";
import Configuration from "../Configuration";
import logger from "../Logger";
import Threads from "./Threads";

export default async function updateVoiceAndStageEvents() {
  const now = new Date().valueOf();
  for (const [guildId, guild] of Configuration.client.guilds.cache.entries()) {
    for (const [eventId, scheduledEvent] of await guild.scheduledEvents.fetch()) {
      if (
        scheduledEvent.status !== GuildScheduledEventStatus.Scheduled &&
        scheduledEvent.status !== GuildScheduledEventStatus.Active
      )
        continue;
      if (!scheduledEvent.scheduledStartAt || !scheduledEvent.scheduledEndAt) continue;

      const startTime = scheduledEvent.scheduledStartAt.valueOf();
      const endTime = scheduledEvent.scheduledEndAt.valueOf();

      if (
        scheduledEvent.entityType !== GuildScheduledEventEntityType.StageInstance &&
        scheduledEvent.entityType !== GuildScheduledEventEntityType.Voice
      )
        continue;

      if (now >= startTime && scheduledEvent.status === GuildScheduledEventStatus.Scheduled) {
        if (scheduledEvent.description && (await Threads.getThreadFromEventDescription(scheduledEvent.description))) {
          try {
            await scheduledEvent.setStatus(GuildScheduledEventStatus.Active);
          } catch (error) {
            logger.error(`Error trying to start event ${scheduledEvent.name}`, { error, scheduledEvent });
          }
        }
      } else if (now >= endTime && scheduledEvent.status === GuildScheduledEventStatus.Active) {
        try {
          await scheduledEvent.setStatus(GuildScheduledEventStatus.Completed);
        } catch (error) {
          logger.error(`Error trying to end event ${scheduledEvent.name}`, { error, scheduledEvent });
        }
      }
    }
  }
}
