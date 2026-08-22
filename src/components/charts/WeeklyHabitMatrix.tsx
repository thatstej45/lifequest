import { useMemo } from 'react';
import {
  buildWeeklyHabitMatrix,
  habitCellLookup,
  type WeeklyHabitMatrixData,
} from '../../analytics';
import type { Goal, GoalDailyProgress, HistoryRecord } from '../../types';

type WeeklyHabitMatrixProps = {
  title?: string;
  className?: string;
  weekOffset?: number;
  referenceDate?: Date;
} & (
  | { matrix: WeeklyHabitMatrixData; goals?: never; progress?: never; history?: never }
  | {
      matrix?: never;
      goals: Goal[];
      progress: GoalDailyProgress[];
      history?: HistoryRecord[];
    }
);

const cellLabel = (state: string, habit: string, date: string) =>
  `${habit} on ${date}: ${state.replace('-', ' ')}`;

export function WeeklyHabitMatrix({
  title = 'Weekly habit matrix',
  className,
  weekOffset = 0,
  referenceDate,
  matrix: matrixProp,
  goals,
  progress,
  history,
}: WeeklyHabitMatrixProps) {
  const matrix = useMemo(
    () =>
      matrixProp ??
      (goals && progress
        ? buildWeeklyHabitMatrix(goals, progress, history ?? [], referenceDate, weekOffset)
        : null),
    [matrixProp, goals, progress, history, referenceDate, weekOffset],
  );

  const lookup = useMemo(
    () => (matrix ? habitCellLookup(matrix) : new Map()),
    [matrix],
  );

  if (!matrix || matrix.goals.length === 0) {
    return (
      <figure
        className={['analytics-weekly-matrix', className].filter(Boolean).join(' ')}
        aria-label={title}
      >
        <figcaption className="analytics-weekly-matrix-title">{title}</figcaption>
        <p className="analytics-empty" role="status">
          No habits to display.
        </p>
      </figure>
    );
  }

  return (
    <figure
      className={['analytics-weekly-matrix', className].filter(Boolean).join(' ')}
      aria-label={title}
    >
      <figcaption className="analytics-weekly-matrix-title">{title}</figcaption>
      <p className="analytics-weekly-matrix-range">
        {matrix.weekStart} – {matrix.weekEnd}
      </p>
      <div className="analytics-weekly-matrix-scroll">
        <table className="analytics-weekly-matrix-table">
          <thead>
            <tr>
              <th scope="col" className="analytics-weekly-matrix-habit-header">
                Habit
              </th>
              {matrix.dates.map((date, index) => (
                <th key={date} scope="col" className="analytics-weekly-matrix-day-header">
                  <span className="analytics-weekly-matrix-day-label">{matrix.dayLabels[index]}</span>
                  <span className="analytics-weekly-matrix-day-date">{date.slice(5)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.goals.map(goal => (
              <tr key={goal.id}>
                <th scope="row" className="analytics-weekly-matrix-habit">
                  {goal.title}
                </th>
                {matrix.dates.map(date => {
                  const cell = lookup.get(`${goal.id}:${date}`);
                  const state = cell?.state ?? 'unscheduled';
                  return (
                    <td key={`${goal.id}-${date}`} className="analytics-weekly-matrix-cell">
                      <span
                        className={`analytics-weekly-matrix-dot is-${state}`}
                        role="img"
                        aria-label={cellLabel(state, goal.title, date)}
                        title={cellLabel(state, goal.title, date)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export default WeeklyHabitMatrix;
