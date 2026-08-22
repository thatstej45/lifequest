import type { HistoryRecord } from '../types';
import type { DailyRatio } from './types';

export const completionRatio = (record?: HistoryRecord) => {
  if (!record || record.totalCount <= 0) return 0;
  return Math.min(1, record.completedCount / record.totalCount);
};

export const averageCompletionRatio = (records: HistoryRecord[]) => {
  const usable = records.filter(record => record.totalCount > 0);
  if (usable.length === 0) return 0;
  const sum = usable.reduce((acc, record) => acc + completionRatio(record), 0);
  return sum / usable.length;
};

export const dailyCompletionRatios = (records: HistoryRecord[]): DailyRatio[] =>
  [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(record => ({
      date: record.date,
      ratio: completionRatio(record),
      completedCount: record.completedCount,
      totalCount: record.totalCount,
    }));

export const totalCompletedCount = (records: HistoryRecord[]) =>
  records.reduce((sum, record) => sum + record.completedCount, 0);

export const perfectDayCount = (records: HistoryRecord[]) =>
  records.filter(
    record => record.totalCount > 0 && record.completedCount >= record.totalCount,
  ).length;

export const trackedDayCount = (records: HistoryRecord[]) =>
  records.filter(record => record.totalCount > 0).length;

export const ratioToLevel = (ratio: number, buckets = 5) => {
  if (ratio <= 0) return 0;
  const clamped = Math.min(1, Math.max(0, ratio));
  return Math.min(buckets - 1, Math.ceil(clamped * (buckets - 1)));
};
