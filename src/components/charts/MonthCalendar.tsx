import { useMemo } from 'react';
import {
  buildMonthCalendar,
  calendarWeeks,
  monthCalendarTitle,
  MONDAY_FIRST_LABELS,
  type CalendarCell,
} from '../../analytics';
import type { HistoryRecord } from '../../types';

type MonthCalendarProps = {
  title?: string;
  className?: string;
  year: number;
  month: number;
  referenceDate?: Date;
} & (
  | { cells: CalendarCell[]; history?: never }
  | { cells?: never; history: HistoryRecord[] }
);

const cellAriaLabel = (cell: CalendarCell) => {
  if (!cell.inMonth || !cell.date) return 'Outside month';
  const ratio = `${Math.round(cell.ratio * 100)}%`;
  return `${cell.date}, ${cell.state}, ${ratio} completion`;
};

export function MonthCalendar({
  title,
  className,
  year,
  month,
  referenceDate = new Date(),
  cells: cellsProp,
  history,
}: MonthCalendarProps) {
  const cells = useMemo(
    () => cellsProp ?? (history ? buildMonthCalendar(history, year, month, referenceDate) : []),
    [cellsProp, history, year, month, referenceDate],
  );
  const weeks = useMemo(() => calendarWeeks(cells), [cells]);
  const heading = title ?? monthCalendarTitle(year, month);
  const isEmpty = cells.every(cell => !cell.inMonth || cell.state === 'empty' || cell.state === 'future');

  return (
    <figure
      className={['analytics-month-calendar', className].filter(Boolean).join(' ')}
      aria-label={heading}
    >
      <figcaption className="analytics-month-calendar-title">{heading}</figcaption>
      <div className="analytics-month-calendar-head" role="row">
        {MONDAY_FIRST_LABELS.map(label => (
          <span key={label} className="analytics-month-calendar-weekday" role="columnheader">
            {label}
          </span>
        ))}
      </div>
      {isEmpty ? (
        <p className="analytics-empty" role="status">
          No calendar data for this month.
        </p>
      ) : (
        <div className="analytics-month-calendar-grid" role="grid" aria-readonly="true">
          {weeks.map((week, weekIndex) => (
            <div key={`week-${weekIndex}`} className="analytics-month-calendar-row" role="row">
              {week.map((cell, dayIndex) => (
                <span
                  key={`${weekIndex}-${dayIndex}`}
                  className={[
                    'analytics-month-calendar-cell',
                    cell.inMonth ? `is-${cell.state}` : 'is-outside',
                  ].join(' ')}
                  role="gridcell"
                  aria-label={cellAriaLabel(cell)}
                  title={cell.inMonth && cell.date ? cellAriaLabel(cell) : undefined}
                >
                  {cell.inMonth ? cell.day : ''}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </figure>
  );
}

export default MonthCalendar;
