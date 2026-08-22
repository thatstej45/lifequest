import type { HistoryRecord } from '../types';
import { MONDAY_FIRST_LABELS, parseISODate } from './dateUtils';
import { averageCompletionRatio } from './ratios';
import type { WeekdayStat } from './types';

export const computeWeekdayBreakdown = (records: HistoryRecord[]): WeekdayStat[] =>
  MONDAY_FIRST_LABELS.map((label, index) => {
    const weekday = (index + 1) % 7;
    const matching = records.filter(
      record => parseISODate(record.date).getDay() === weekday,
    );
    return {
      label,
      weekday,
      ratio: averageCompletionRatio(matching),
      samples: matching.length,
    };
  });
