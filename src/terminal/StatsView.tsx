import { useMemo, useState } from 'react';
import { Category, CompletedQuest, Goal, GoalDailyProgress, HistoryRecord, UserStats } from '../types';
import { perHabitSummary } from '../analytics';
import {
  ContributionHeatmap,
  MonthCalendar,
  TrendBars,
  WeekdayBars,
  WeeklyHabitMatrix,
} from '../components/charts';
import {
  averageRatio,
  longestLoggedRun,
  recordsWithin,
  weekdayBreakdown,
} from './utils';

interface StatsViewProps {
  userStats: UserStats;
  categories: Category[];
  goals: Goal[];
  history: HistoryRecord[];
  questHistory: CompletedQuest[];
  goalDailyProgress: GoalDailyProgress[];
}

const WINDOWS = [
  { id: '7d', days: 7 },
  { id: '30d', days: 30 },
  { id: '90d', days: 90 },
  { id: '365d', days: 365 },
  { id: 'all', days: 0 },
  { id: 'custom', days: -1 },
] as const;

type WindowId = (typeof WINDOWS)[number]['id'];

const asPercent = (ratio: number) => `${Math.round(ratio * 100)}%`;

type Tone = 'cyan' | 'amber' | 'purple' | 'blue' | 'good' | 'bad';

const ratioTone = (ratio: number): Tone => (ratio >= 0.8 ? 'good' : ratio >= 0.4 ? 'amber' : 'bad');

const barTone = (ratio: number) =>
  ratio <= 0 ? 'is-empty' : ratio >= 0.8 ? '' : ratio >= 0.4 ? 'is-mid' : 'is-low';

function Line({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return (
    <p className="term-stat-line">
      <span className="term-stat-label">{label}</span>
      <span className={`term-stat-value${tone ? ` is-${tone}` : ''}`}>{value}</span>
    </p>
  );
}

export default function StatsView({
  userStats,
  categories,
  goals,
  history,
  questHistory,
  goalDailyProgress,
}: StatsViewProps) {
  const [windowId, setWindowId] = useState<WindowId>('7d');
  const [view, setView] = useState<'overview' | 'month' | 'week' | 'habits'>('overview');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const activeWindow = WINDOWS.find(entry => entry.id === windowId) ?? WINDOWS[0];

  const scoped = useMemo(
    () => activeWindow.days === 0
      ? history
      : activeWindow.days === -1
        ? history.filter(record => (!customStart || record.date >= customStart) && (!customEnd || record.date <= customEnd))
        : recordsWithin(history, activeWindow.days),
    [activeWindow.days, customEnd, customStart, history],
  );

  const topHabit = useMemo(
    () =>
      goals.reduce<Goal | null>(
        (best, goal) => ((goal.streak ?? 0) > (best?.streak ?? 0) ? goal : best),
        null,
      ),
    [goals],
  );

  const skillLevels = useMemo(
    () => categories.flatMap(category => category.skills).reduce((sum, skill) => sum + skill.level, 0),
    [categories],
  );

  const byWeekday = useMemo(() => weekdayBreakdown(scoped), [scoped]);
  const habitSummaries = useMemo(
    () => perHabitSummary(
      goals,
      goalDailyProgress,
      activeWindow.days === 7 || activeWindow.days === 30 || activeWindow.days === 90 || activeWindow.days === 365
        ? activeWindow.days
        : 'all',
    ),
    [activeWindow.days, goalDailyProgress, goals],
  );
  const bestDay = byWeekday.reduce((best, day) => (day.ratio > best.ratio ? day : best), byWeekday[0]);
  const worstDay = byWeekday
    .filter(day => day.samples > 0)
    .reduce((worst, day) => (day.ratio < worst.ratio ? day : worst), bestDay);

  return (
    <>
      <p className="term-prompt">
        <span className="term-prompt-user">{`${userStats.name || 'user'}[L${userStats.level}]@lifequest`}</span>
        <span className="term-prompt-symbol">$</span>
        <span className="term-prompt-cmd">stats</span>
      </p>
      <div className="term-subnav" role="tablist" aria-label="Stats views">
        {(['overview', 'month', 'week', 'habits'] as const).map(entry => (
          <button type="button" role="tab" aria-selected={view === entry} key={entry} className={`term-token${view === entry ? ' is-active' : ''}`} onClick={() => setView(entry)}>
            {`[${entry}]`}
          </button>
        ))}
      </div>

      <section className="term-section">
        <h2 className="term-section-title is-cyan">lifetime overview</h2>
        <p className="term-comment is-nested">{'// your overall tracking summary'}</p>
        <Line
          label={`level ${userStats.level} progress`}
          value={`${userStats.xp}/${userStats.maxXp} · ${Math.round((userStats.xp / userStats.maxXp) * 100)}% · ${userStats.maxXp - userStats.xp} left`}
          tone="cyan"
        />
        <Line label="days tracked" value={`${history.length} days`} tone="cyan" />
        <Line label="avg completion" value={asPercent(averageRatio(history))} tone={ratioTone(averageRatio(history))} />
        <Line label="total completions" value={`${questHistory.length}`} tone="purple" />
        <Line label="skill levels earned" value={`${skillLevels}`} tone="blue" />
      </section>

      {view === 'overview' && (
        <>
          <section className="term-section">
            <h2 className="term-section-title is-good">contributions</h2>
            <p className="term-comment is-nested">{'// your activity over the past year'}</p>
            <ContributionHeatmap history={history} window={365} />
          </section>
          <section className="term-section">
            <h2 className="term-section-title is-purple">six month trend</h2>
            <TrendBars history={history} />
          </section>
        </>
      )}

      {view === 'month' && (
        <section className="term-section">
          <h2 className="term-section-title is-cyan">monthly overview</h2>
          <MonthCalendar history={history} year={new Date().getFullYear()} month={new Date().getMonth()} />
        </section>
      )}

      {view === 'week' && (
        <section className="term-section">
          <h2 className="term-section-title is-blue">weekly overview</h2>
          <WeeklyHabitMatrix goals={goals} progress={goalDailyProgress} history={history} />
          <WeekdayBars history={scoped} window="all" />
        </section>
      )}

      {view === 'habits' && (
        <section className="term-section">
          <h2 className="term-section-title is-amber">habit highlights</h2>
          <p className="term-comment is-nested">{'// per-habit completion, current streak, and best streak'}</p>
          {habitSummaries.length === 0 && <p className="term-comment">{'// no habit data in this window'}</p>}
          {habitSummaries.map(habit => (
            <div className="term-stat-card" key={habit.goalId}>
              <Line label={habit.title} value={`${Math.round(habit.ratio * 100)}% · ${habit.completedDays}/${habit.scheduledDays}`} tone={ratioTone(habit.ratio)} />
              <p className="term-comment is-nested">{`// current ${habit.currentStreak}d · best ${habit.bestStreak}d`}</p>
            </div>
          ))}
        </section>
      )}

      <section className="term-section">
        <h2 className="term-section-title is-amber">streaks</h2>
        <p className="term-comment is-nested">{'// consecutive days hitting your daily goal'}</p>
        <Line label="current streak" value={`${userStats.streak} days`} tone="amber" />
        <Line label="best logged streak" value={`${longestLoggedRun(history)} days`} tone="amber" />
        <Line label="xp multiplier" value={`${userStats.xpMultiplier.toFixed(1)}x`} tone="purple" />
        {topHabit && (
          <Line label="top habit streak" value={`${topHabit.title} · ${topHabit.streak ?? 0} days`} tone="cyan" />
        )}
      </section>

      <section className="term-section">
        <h2 className="term-section-title is-purple">data window</h2>
        <p className="term-comment is-nested">{'// choose a range preset'}</p>
        <div className="term-window-row">
          {WINDOWS.map(entry => (
            <button
              key={entry.id}
              type="button"
              className={`term-token${windowId === entry.id ? ' is-active' : ''}`}
              onClick={() => setWindowId(entry.id)}
            >
              {`[${entry.id}]`}
            </button>
          ))}
        </div>
        {windowId === 'custom' && (
          <div className="term-window-row">
            <label>from<input className="term-input" type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} /></label>
            <label>to<input className="term-input" type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} /></label>
          </div>
        )}
      </section>

      <section className="term-section">
        <h2 className="term-section-title">{`completion rates [${windowId}]`}</h2>
        <p className="term-comment is-nested">{'// how often you complete scheduled habits'}</p>
        <Line label={`this ${windowId}`} value={asPercent(averageRatio(scoped))} tone={ratioTone(averageRatio(scoped))} />
        <Line label="all time" value={asPercent(averageRatio(history))} tone={ratioTone(averageRatio(history))} />
        <Line
          label="perfect days"
          value={`${scoped.filter(record => record.totalCount > 0 && record.completedCount >= record.totalCount).length}`}
          tone="cyan"
        />
      </section>

      <section className="term-section">
        <h2 className="term-section-title is-blue">{`day of week [${windowId}]`}</h2>
        <p className="term-comment is-nested">{'// completion rates broken down by day'}</p>
        {byWeekday.map(day => (
          <div className="term-bar-row" key={day.label}>
            <span className="term-bar-label">{day.label.toLowerCase()}</span>
            <span className="term-bar-track">
              <span
                className={`term-bar-fill ${barTone(day.ratio)}`.trim()}
                style={{ width: `${Math.round(day.ratio * 100)}%` }}
              />
            </span>
            <span className={`term-bar-value${day.ratio > 0 ? ` is-${ratioTone(day.ratio)}` : ''}`}>
              {asPercent(day.ratio)}
            </span>
          </div>
        ))}
        {bestDay && worstDay && (
          <p className="term-comment is-nested">
            {`// best day: ${bestDay.label.toLowerCase()} (${asPercent(bestDay.ratio)}) · worst day: ${worstDay.label.toLowerCase()} (${asPercent(worstDay.ratio)})`}
          </p>
        )}
      </section>
    </>
  );
}
