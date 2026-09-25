/**
 * A LifeQuest day runs 03:00 → 03:00 local time. Anything logged after
 * midnight still belongs to the day the user thinks they are finishing, and
 * repeatable quests only reset once the 03:00 cutoff passes.
 */
export const DAY_START_HOUR = 3;

/** Shifts a timestamp onto the calendar day it belongs to under the cutoff. */
export const habitDayDate = (date: Date = new Date()) => {
  const shifted = new Date(date.getTime());
  shifted.setHours(shifted.getHours() - DAY_START_HOUR);
  return shifted;
};

/** Local YYYY-MM-DD of the habit day a timestamp belongs to. */
export const habitDayKey = (date: Date = new Date()) => {
  const day = habitDayDate(date);
  const local = new Date(day.getTime() - day.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

/** Milliseconds until the next 03:00 cutoff. */
export const msUntilNextDayStart = (date: Date = new Date()) => {
  const next = new Date(date.getTime());
  next.setHours(DAY_START_HOUR, 0, 0, 0);
  if (next.getTime() <= date.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - date.getTime();
};
