import type { HistoryRecord } from '../types';
import { eachDateInRange, getWindowRange } from './dateUtils';
import { completionRatio, ratioToLevel } from './ratios';
import type { AnalyticsWindow, HeatmapCell } from './types';

export const buildHeatmapCells = (
  records: HistoryRecord[],
  window: AnalyticsWindow,
  referenceDate = new Date(),
): HeatmapCell[] => {
  const byDate = new Map(records.map(record => [record.date, record]));
  const range = getWindowRange(window, referenceDate);

  return eachDateInRange(range).map(date => {
    const record = byDate.get(date);
    const ratio = completionRatio(record);
    return {
      date,
      ratio,
      level: record && record.totalCount > 0 ? ratioToLevel(ratio) : 0,
    };
  });
};
