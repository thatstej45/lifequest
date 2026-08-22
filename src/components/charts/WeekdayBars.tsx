import { useMemo } from 'react';
import {
  computeWeekdayBreakdown,
  filterHistoryByWindow,
  type AnalyticsWindow,
  type WeekdayStat,
} from '../../analytics';
import type { HistoryRecord } from '../../types';

type WeekdayBarsProps = {
  title?: string;
  className?: string;
  window?: AnalyticsWindow;
  referenceDate?: Date;
} & (
  | { data: WeekdayStat[]; history?: never }
  | { data?: never; history: HistoryRecord[] }
);

export function WeekdayBars({
  title = 'Completion by weekday',
  className,
  window = 30,
  referenceDate,
  data: dataProp,
  history,
}: WeekdayBarsProps) {
  const data = useMemo(
    () =>
      dataProp ??
      (history
        ? computeWeekdayBreakdown(filterHistoryByWindow(history, window, referenceDate))
        : []),
    [dataProp, history, window, referenceDate],
  );

  const isEmpty = data.every(day => day.samples === 0);

  return (
    <figure
      className={['analytics-weekday-bars', className].filter(Boolean).join(' ')}
      aria-label={title}
    >
      <figcaption className="analytics-weekday-bars-title">{title}</figcaption>
      {isEmpty ? (
        <p className="analytics-empty" role="status">
          No weekday data yet.
        </p>
      ) : (
        <ul className="analytics-weekday-bars-list" role="list">
          {data.map(day => {
            const percent = Math.round(day.ratio * 100);
            return (
              <li key={day.label} className="analytics-weekday-bars-item">
                <span className="analytics-weekday-bars-label">{day.label}</span>
                <div
                  className="analytics-weekday-bars-track"
                  role="meter"
                  aria-label={`${day.label}: ${percent}% average completion`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <span
                    className="analytics-weekday-bars-fill"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="analytics-weekday-bars-value">{percent}%</span>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}

export default WeekdayBars;
