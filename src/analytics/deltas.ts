import type { HistoryRecord } from '../types';
import {
  averageCompletionRatio,
  perfectDayCount,
  totalCompletedCount,
  trackedDayCount,
} from './ratios';
import type { PeriodComparison, PeriodDelta } from './types';

export const computeDelta = (current: number, previous: number): PeriodDelta => ({
  current,
  previous,
  delta: current - previous,
  deltaPercent: previous === 0 ? null : ((current - previous) / previous) * 100,
});

export const comparePeriods = (
  currentRecords: HistoryRecord[],
  previousRecords: HistoryRecord[],
): PeriodComparison => ({
  avgRatio: computeDelta(
    averageCompletionRatio(currentRecords),
    averageCompletionRatio(previousRecords),
  ),
  totalCompleted: computeDelta(
    totalCompletedCount(currentRecords),
    totalCompletedCount(previousRecords),
  ),
  perfectDays: computeDelta(
    perfectDayCount(currentRecords),
    perfectDayCount(previousRecords),
  ),
  trackedDays: computeDelta(
    trackedDayCount(currentRecords),
    trackedDayCount(previousRecords),
  ),
});
