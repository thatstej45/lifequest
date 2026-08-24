import type { HistoryRecord } from '../types';
import { averageCompletionRatio } from './ratios';
import { getWindowRange, isDateInRange, toISODate, addDays } from './dateUtils';
import type { AnalyticsWindow } from './types';

export type TrendDirection = 'up' | 'down' | 'flat';

export interface RollingRate {
  days: number;
  ratio: number;
  trackedDays: number;
}

export interface TrajectorySnapshot {
  windows: RollingRate[];
  trend: TrendDirection;
  trendDelta: number;
}

const directionFromDelta = (delta: number): TrendDirection => {
  if (delta > 0.03) return 'up';
  if (delta < -0.03) return 'down';
  return 'flat';
};

const ratioForDays = (
  records: HistoryRecord[],
  days: number,
  referenceDate = new Date(),
) => {
  const end = toISODate(referenceDate);
  const start = toISODate(addDays(referenceDate, -(days - 1)));
  const scoped = records.filter(record => record.date >= start && record.date <= end);
  return {
    days,
    ratio: averageCompletionRatio(scoped),
    trackedDays: scoped.filter(record => record.totalCount > 0).length,
  };
};

const ratioForWindow = (
  records: HistoryRecord[],
  window: AnalyticsWindow,
  referenceDate = new Date(),
) => {
  const range = getWindowRange(window, referenceDate);
  const scoped = records.filter(record => isDateInRange(record.date, range));
  return averageCompletionRatio(scoped);
};

/** Rolling completion rates for 7/14/30-day windows plus trend vs prior 7 days. */
export const trajectorySnapshot = (
  history: HistoryRecord[],
  referenceDate = new Date(),
): TrajectorySnapshot => {
  const windows: RollingRate[] = [7, 14, 30].map(days => ratioForDays(history, days, referenceDate));

  const recentRatio = ratioForWindow(history, 7, referenceDate);
  const prior7End = new Date(referenceDate);
  prior7End.setDate(prior7End.getDate() - 7);
  const priorRatio = ratioForWindow(history, 7, prior7End);
  const trendDelta = recentRatio - priorRatio;

  return {
    windows,
    trend: directionFromDelta(trendDelta),
    trendDelta,
  };
};

export const recoveryRate = (completed = 0, attempts = 0) =>
  attempts > 0 ? completed / attempts : 0;
