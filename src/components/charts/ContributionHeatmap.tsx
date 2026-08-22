import { useMemo } from 'react';
import {
  buildHeatmapCells,
  type AnalyticsWindow,
  type HeatmapCell,
} from '../../analytics';
import type { HistoryRecord } from '../../types';

type ContributionHeatmapProps = {
  title?: string;
  className?: string;
  maxColumns?: number;
} & (
  | { cells: HeatmapCell[]; history?: never; window?: never; referenceDate?: never }
  | {
      cells?: never;
      history: HistoryRecord[];
      window?: AnalyticsWindow;
      referenceDate?: Date;
    }
);

const stateLabel = (cell: HeatmapCell) => {
  if (cell.level <= 0) return 'No activity';
  return `${Math.round(cell.ratio * 100)}% completion`;
};

export function ContributionHeatmap({
  title = 'Activity heatmap',
  className,
  maxColumns = 26,
  cells: cellsProp,
  history,
  window = 90,
  referenceDate,
}: ContributionHeatmapProps) {
  const cells = useMemo(
    () => cellsProp ?? (history ? buildHeatmapCells(history, window, referenceDate) : []),
    [cellsProp, history, window, referenceDate],
  );

  const weeks = useMemo(() => {
    const columns: HeatmapCell[][] = [];
    cells.forEach((cell, index) => {
      const weekIndex = Math.floor(index / 7);
      if (!columns[weekIndex]) columns[weekIndex] = [];
      columns[weekIndex].push(cell);
    });
    return columns.slice(-maxColumns);
  }, [cells, maxColumns]);

  const isEmpty = cells.length === 0;

  return (
    <figure
      className={['analytics-heatmap', className].filter(Boolean).join(' ')}
      aria-label={title}
    >
      <figcaption className="analytics-heatmap-title">{title}</figcaption>
      {isEmpty ? (
        <p className="analytics-empty" role="status">
          No activity data yet.
        </p>
      ) : (
        <div className="analytics-heatmap-grid" role="grid" aria-readonly="true">
          {weeks.map((week, weekIndex) => (
            <div
              key={`week-${weekIndex}`}
              className="analytics-heatmap-column"
              role="row"
            >
              {week.map(cell => (
                <span
                  key={cell.date}
                  className={`analytics-heatmap-cell is-level-${cell.level}`}
                  role="gridcell"
                  title={`${cell.date}: ${stateLabel(cell)}`}
                  aria-label={`${cell.date}, ${stateLabel(cell)}`}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </figure>
  );
}

export default ContributionHeatmap;
