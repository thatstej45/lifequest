import type { HistoryRecord } from '../types';
import { parseISODate, toISODate } from './dateUtils';
import { completionRatio } from './ratios';
import type { CalendarCell, CalendarCellState } from './types';

const historyByDate = (records: HistoryRecord[]) =>
  new Map(records.map(record => [record.date, record]));

export const resolveHistoryCellState = (
  record: HistoryRecord | undefined,
  date: string,
  today: string,
): CalendarCellState => {
  if (date > today) return 'future';
  if (!record || record.totalCount <= 0) return 'empty';
  if (record.paused) return 'paused';
  if (record.shieldUsed && !record.goalMet) return 'shielded';
  if (record.goalMet || record.completedCount >= record.totalCount) return 'completed';
  return 'missed';
};

export const buildMonthCalendar = (
  records: HistoryRecord[],
  year: number,
  month: number,
  referenceDate = new Date(),
): CalendarCell[] => {
  const byDate = historyByDate(records);
  const today = toISODate(referenceDate);
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const cells: CalendarCell[] = [];

  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push({
      date: '',
      day: 0,
      state: 'empty',
      ratio: 0,
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = byDate.get(date);
    cells.push({
      date,
      day,
      state: resolveHistoryCellState(record, date, today),
      ratio: completionRatio(record),
      inMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      date: '',
      day: 0,
      state: 'empty',
      ratio: 0,
      inMonth: false,
    });
  }

  return cells;
};

export const calendarWeeks = (cells: CalendarCell[]) => {
  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
};

export const monthCalendarTitle = (year: number, month: number) =>
  parseISODate(`${year}-${String(month + 1).padStart(2, '0')}-01`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
