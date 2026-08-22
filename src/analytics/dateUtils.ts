import type { AnalyticsWindow, DateRange } from './types';

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const MONDAY_FIRST_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Local calendar date as YYYY-MM-DD. */
export const toISODate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseISODate = (iso: string) => new Date(`${iso}T00:00:00`);

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const daysBetween = (start: string, end: string) => {
  const ms = parseISODate(end).getTime() - parseISODate(start).getTime();
  return Math.round(ms / 86_400_000);
};

/** Monday-based week start, optionally shifted by whole weeks. */
export const startOfWeek = (reference: Date, weekOffset = 0) => {
  const date = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const dayIndex = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayIndex + weekOffset * 7);
  return date;
};

export const windowDayCount = (window: AnalyticsWindow) =>
  window === 'all' ? null : window;

export const getWindowRange = (
  window: AnalyticsWindow,
  referenceDate = new Date(),
): DateRange => {
  const end = toISODate(referenceDate);
  if (window === 'all') return { start: '0000-01-01', end };

  const startDate = addDays(referenceDate, -(window - 1));
  return { start: toISODate(startDate), end };
};

export const getPreviousWindowRange = (
  window: AnalyticsWindow,
  referenceDate = new Date(),
): DateRange | null => {
  if (window === 'all') return null;

  const current = getWindowRange(window, referenceDate);
  const previousEnd = addDays(parseISODate(current.start), -1);
  const previousStart = addDays(previousEnd, -(window - 1));
  return { start: toISODate(previousStart), end: toISODate(previousEnd) };
};

export const isDateInRange = (date: string, range: DateRange) =>
  date >= range.start && date <= range.end;

export const eachDateInRange = (range: DateRange) => {
  const dates: string[] = [];
  let cursor = parseISODate(range.start);
  const end = parseISODate(range.end);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(toISODate(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
};

export const monthLabel = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
