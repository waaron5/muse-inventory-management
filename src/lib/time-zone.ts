/** "Today" is the same day for everyone, wherever they are (ADR 0005). */
export const MUSE_TIME_ZONE = "America/Denver";

const calendarDate = new Intl.DateTimeFormat("en-CA", { timeZone: MUSE_TIME_ZONE });

/** Today's calendar date in Muse's time zone, as "2026-10-20". */
export function todayInMuse(now = new Date()) {
  return calendarDate.format(now);
}
