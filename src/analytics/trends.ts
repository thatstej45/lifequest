import type { HistoryRecord } from '../types';
import { monthLabel, toISODate } from './dateUtils';
import { averageCompletionRatio } from './ratios';
import type { MonthTrendPoint } from './types';

/** One bar per calendar month for the six months ending at `referenceDate`. */
export const sixMonthTrend = (
  records: HistoryRecord[],
  referenceDate = new Date(),
): MonthTrendPoint[] => {
  const points: MonthTrendPoint[] = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const anchor = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - offset, 1);
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const prefix = `${monthKey}-`;

    const monthRecords = records.filter(record => record.date.startsWith(prefix));
    points.push({
      month: monthKey,
      label: monthLabel(year, month),
      ratio: averageCompletionRatio(monthRecords),
      days: monthRecords.filter(record => record.totalCount > 0).length,
    });
  }

  return points;
};

export const trendFromDailyRatios = (
  records: HistoryRecord[],
  referenceDate = new Date(),
) => sixMonthTrend(records, referenceDate).map(point => ({
  ...point,
  endDate: toISODate(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())),
}));
