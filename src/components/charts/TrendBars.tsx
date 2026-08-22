import { useMemo } from 'react';
import { sixMonthTrend, type MonthTrendPoint } from '../../analytics';
import type { HistoryRecord } from '../../types';

type TrendBarsProps = {
  title?: string;
  className?: string;
  referenceDate?: Date;
} & (
  | { points: MonthTrendPoint[]; history?: never }
  | { points?: never; history: HistoryRecord[] }
);

export function TrendBars({
  title = 'Six-month trend',
  className,
  referenceDate,
  points: pointsProp,
  history,
}: TrendBarsProps) {
  const points = useMemo(
    () => pointsProp ?? (history ? sixMonthTrend(history, referenceDate) : []),
    [pointsProp, history, referenceDate],
  );

  const maxRatio = useMemo(
    () => Math.max(0.01, ...points.map(point => point.ratio)),
    [points],
  );

  const isEmpty = points.every(point => point.days === 0);

  return (
    <figure
      className={['analytics-trend-bars', className].filter(Boolean).join(' ')}
      aria-label={title}
    >
      <figcaption className="analytics-trend-bars-title">{title}</figcaption>
      {isEmpty ? (
        <p className="analytics-empty" role="status">
          No trend data yet.
        </p>
      ) : (
        <ul className="analytics-trend-bars-list" role="list">
          {points.map(point => {
            const height = Math.round((point.ratio / maxRatio) * 100);
            const percent = Math.round(point.ratio * 100);
            return (
              <li key={point.month} className="analytics-trend-bars-item">
                <div
                  className="analytics-trend-bars-bar"
                  role="meter"
                  aria-label={`${point.label}: ${percent}% average completion`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <span
                    className="analytics-trend-bars-fill"
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="analytics-trend-bars-label">{point.label}</span>
                <span className="analytics-trend-bars-value">{percent}%</span>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}

export default TrendBars;
