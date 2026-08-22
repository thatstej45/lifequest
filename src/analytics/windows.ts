import type { HistoryRecord } from '../types';
import { getPreviousWindowRange, getWindowRange, isDateInRange } from './dateUtils';
import type { AnalyticsWindow, WindowPreset } from './types';

export const ANALYTICS_WINDOWS: WindowPreset[] = [
  { id: '7d', days: 7, label: '7 days' },
  { id: '30d', days: 30, label: '30 days' },
  { id: '90d', days: 90, label: '90 days' },
  { id: '365d', days: 365, label: '365 days' },
  { id: 'all', days: 'all', label: 'All time' },
];

export const filterHistoryByWindow = (
  records: HistoryRecord[],
  window: AnalyticsWindow,
  referenceDate = new Date(),
) => {
  const range = getWindowRange(window, referenceDate);
  return records
    .filter(record => isDateInRange(record.date, range))
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const splitCurrentAndPrevious = (
  records: HistoryRecord[],
  window: AnalyticsWindow,
  referenceDate = new Date(),
) => {
  const currentRange = getWindowRange(window, referenceDate);
  const previousRange = getPreviousWindowRange(window, referenceDate);

  const current = records.filter(record => isDateInRange(record.date, currentRange));
  const previous = previousRange
    ? records.filter(record => isDateInRange(record.date, previousRange))
    : [];

  return { current, previous, currentRange, previousRange };
};
