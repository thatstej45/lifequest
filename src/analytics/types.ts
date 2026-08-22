import type { Goal, GoalDailyProgress, HistoryRecord } from '../types';

/** Rolling window sizes in days, or all recorded history. */
export type AnalyticsWindow = 7 | 30 | 90 | 365 | 'all';

export interface WindowPreset {
  id: string;
  days: AnalyticsWindow;
  label: string;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface DailyRatio {
  date: string;
  ratio: number;
  completedCount: number;
  totalCount: number;
}

export interface PeriodDelta {
  current: number;
  previous: number;
  delta: number;
  /** Percent change vs previous; null when previous is zero. */
  deltaPercent: number | null;
}

export interface PeriodComparison {
  avgRatio: PeriodDelta;
  totalCompleted: PeriodDelta;
  perfectDays: PeriodDelta;
  trackedDays: PeriodDelta;
}

export interface WeekdayStat {
  label: string;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  ratio: number;
  samples: number;
}

export interface MonthTrendPoint {
  month: string;
  label: string;
  ratio: number;
  days: number;
}

export interface HabitSummary {
  goalId: string;
  title: string;
  scheduledDays: number;
  completedDays: number;
  ratio: number;
  currentStreak: number;
  bestStreak: number;
}

export type CalendarCellState =
  | 'completed'
  | 'missed'
  | 'shielded'
  | 'paused'
  | 'empty'
  | 'future';

export interface CalendarCell {
  date: string;
  day: number;
  state: CalendarCellState;
  ratio: number;
  inMonth: boolean;
}

export interface HeatmapCell {
  date: string;
  ratio: number;
  /** 0–4 intensity bucket for styling. */
  level: number;
}

export type HabitCellState =
  | 'completed'
  | 'missed'
  | 'scheduled'
  | 'unscheduled'
  | 'paused';

export interface HabitWeekCell {
  goalId: string;
  date: string;
  state: HabitCellState;
}

export interface WeeklyHabitMatrixData {
  weekStart: string;
  weekEnd: string;
  dayLabels: string[];
  dates: string[];
  goals: Pick<Goal, 'id' | 'title'>[];
  cells: HabitWeekCell[];
}

export interface AnalyticsHistoryInput {
  history: HistoryRecord[];
  window?: AnalyticsWindow;
  referenceDate?: Date;
}

export interface AnalyticsHabitInput {
  goals: Goal[];
  progress: GoalDailyProgress[];
  history?: HistoryRecord[];
  window?: AnalyticsWindow;
  referenceDate?: Date;
}
