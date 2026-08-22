import { FormEvent, Fragment, ReactNode, useEffect, useMemo, useState } from 'react';
import { Category, Goal, GoalDailyProgress, HistoryRecord, Routine, Skill, TrackingMode, UserStats } from '../types';
import { QUEST_DIFFICULTIES, questBaseReward } from '../progression';
import {
  dateKey,
  dailyGoalSummary,
  effectiveProgressValue,
  habitProgressPercent,
  HabitAction,
  isGoalScheduled,
  isHabitComplete,
  trackingMode,
} from '../habits/habitDomain';
import { HabitIcon, IconPicker } from '../components/icons';
import {
  RoutineGroup,
  WEEK_LABELS,
  buildRoutineGroups,
  completedTimeToday,
  formatLongDate,
  goalCadence,
  ratioFor,
  startOfWeek,
  toISODate,
} from './utils';
import TerminalCommandPanel from './TerminalCommandPanel';

type QuestFilter = 'today' | 'all' | 'daily' | 'weekly' | 'once' | 'done';

interface QuestsViewProps {
  userStats: UserStats;
  categories: Category[];
  goals: Goal[];
  history: HistoryRecord[];
  routines: Routine[];
  goalDailyProgress: GoalDailyProgress[];
  onToggleGoal: (id: string) => void;
  onHabitAction: (id: string, action: HabitAction) => void;
  onSaveGoal: (goal: Goal) => void;
  onDeleteGoal: (id: string) => void;
}

type SkillOption = Skill & { category: Category };
type DisplayRoutineGroup = RoutineGroup & { icon?: string };

const FILTERS: QuestFilter[] = ['today', 'all', 'daily', 'weekly', 'once', 'done'];

const newDraft = (skillId = ''): Goal => ({
  id: '',
  skillId,
  title: '',
  completed: false,
  xpReward: 30,
  difficulty: 'easy',
  repeatType: 'none',
  repeatDays: [],
  isRepeatable: false,
  reminderTimes: [],
  reminderFrequency: 'once',
  trackingMode: 'checkbox',
  targetValue: 1,
  unit: 'times',
  icon: 'Target',
  note: '',
});

function WeekStrip({
  history,
  weekOffset,
  onShiftWeek,
}: {
  history: HistoryRecord[];
  weekOffset: number;
  onShiftWeek: (delta: number) => void;
}) {
  const today = toISODate(new Date());
  const weekStart = startOfWeek(new Date(), weekOffset);
  const byDate = new Map(history.map(record => [record.date, record]));

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const iso = toISODate(date);
    const record = byDate.get(iso);
    const ratio = ratioFor(record);
    return {
      iso,
      label: WEEK_LABELS[index],
      dayNumber: date.getDate(),
      isToday: iso === today,
      isFuture: iso > today,
      filled: ratio >= 1 ? 3 : ratio > 0.5 ? 2 : ratio > 0 ? 1 : 0,
      complete: ratio >= 1,
    };
  });

  return (
    <div className="term-week">
      <button type="button" className="term-week-arrow" onClick={() => onShiftWeek(-1)} aria-label="Previous week">
        {'<'}
      </button>
      <div className="term-week-days">
        {days.map(day => (
          <div className="term-day" key={day.iso}>
            <span className="term-day-label">{day.label}</span>
            <span className={`term-day-num${day.isToday ? ' is-today' : ''}${day.isFuture ? ' is-future' : ''}`}>
              {day.isToday ? `*${day.dayNumber}` : day.dayNumber}
            </span>
            <span className="term-day-blocks">
              {[0, 1, 2].map(slot => (
                <i
                  key={slot}
                  className={
                    day.isFuture
                      ? 'term-block is-future'
                      : slot < day.filled
                        ? `term-block is-filled${day.complete ? ' is-complete' : ''}`
                        : 'term-block'
                  }
                />
              ))}
            </span>
          </div>
        ))}
      </div>
      <button type="button" className="term-week-arrow" onClick={() => onShiftWeek(1)} aria-label="Next week">
        {'>'}
      </button>
    </div>
  );
}

function QuestRow({
  goal,
  color,
  today,
  skillPath,
  grouped,
  progress,
  now,
  onAction,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  color?: string;
  today: string;
  skillPath?: string;
  grouped?: boolean;
  progress?: GoalDailyProgress;
  now: Date;
  onAction: (action: HabitAction) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const time = completedTimeToday(goal, today);
  const streak = goal.streak ?? 0;
  const cadence = goalCadence(goal);
  const difficulty = goal.difficulty ?? 'easy';
  const comment = skillPath ? `${skillPath} · ${difficulty} · ${cadence}` : `${difficulty} · ${cadence}`;
  const mode = trackingMode(goal);
  const complete = isHabitComplete(goal, progress, now);
  const percent = habitProgressPercent(goal, progress, now);
  const currentValue = mode === 'timer'
    ? Math.floor((progress ? effectiveProgressValue(progress, now) : 0) / 60)
    : progress?.value ?? (complete ? goal.targetValue ?? 1 : 0);
  const target = goal.targetValue ?? 1;
  const reminders = (goal.reminderTimes?.length ?? 0) > 0
    ? `remind ${goal.reminderFrequency}: ${goal.reminderTimes?.join(', ')}`
    : '';
  const details = [comment, goal.note, reminders].filter(Boolean).join(' · ');

  return (
    <div className={`term-quest-row is-dense${grouped ? ' is-grouped' : ''}`}>
      <button
        type="button"
        className={`term-check${complete ? ' is-done' : ''}`}
        onClick={() => onAction({ type: 'toggle' })}
        aria-pressed={complete}
        aria-label={`${complete ? 'Uncomplete' : 'Complete'} ${goal.title}`}
        disabled={mode !== 'checkbox'}
      >
        {mode === 'health' ? '[↯]' : complete ? '[✓]' : '[ ]'}
      </button>
      <span
        className={`term-row-name term-quest-name${complete ? ' is-done' : ''}`}
        style={color ? { color } : undefined}
      >
        <HabitIcon name={goal.icon ?? 'Target'} size={13} aria-hidden /> {goal.title}
      </span>

      {mode === 'counter' && (
        <span className="term-habit-controls">
          <button type="button" className="term-token" onClick={() => onAction({ type: 'decrement' })} aria-label={`Decrease ${goal.title}`}>[-]</button>
          <span className="term-habit-value">{`${currentValue}/${target} ${goal.unit ?? 'times'}`}</span>
          <button type="button" className="term-token is-action" onClick={() => onAction({ type: 'increment' })} aria-label={`Increase ${goal.title}`}>[+]</button>
        </span>
      )}
      {mode === 'numeric' && (
        <span className="term-habit-controls">
          <input
            className="term-input term-habit-number"
            type="number"
            min="0"
            defaultValue={currentValue}
            aria-label={`Value for ${goal.title}`}
            onBlur={event => onAction({ type: 'set', value: Number(event.target.value) })}
          />
          <span className="term-habit-value">{`/ ${target} ${goal.unit ?? ''}`}</span>
        </span>
      )}
      {mode === 'timer' && (
        <span className="term-habit-controls">
          <span className="term-habit-value">{`${currentValue}/${target} min`}</span>
          <button
            type="button"
            className="term-token is-action"
            onClick={() => onAction({ type: progress?.timerStartedAt ? 'timer-pause' : 'timer-start' })}
          >
            {progress?.timerStartedAt ? '[pause]' : '[start]'}
          </button>
          <button type="button" className="term-token" onClick={() => onAction({ type: 'reset' })}>[reset]</button>
        </span>
      )}
      {mode !== 'checkbox' && mode !== 'health' && (
        <span className="term-mini-progress" aria-label={`${percent}% complete`}><i style={{ width: `${percent}%` }} /></span>
      )}

      <span className="term-row-inline" title={details}>
        {`// ${mode === 'health' ? `${comment} · native sync unavailable on web` : details}`}
      </span>

      <span className="term-habit-meta">
        {streak > 0 && <span className="term-streak">{`\u25B2${streak}`}</span>}
        {time && <span className="term-time">{time}</span>}
        {reminders && <span className="term-time" title={reminders}>{`\u23F0${goal.reminderTimes?.length}`}</span>}
        <span className="term-xp">{`+${goal.xpReward}xp`}</span>
      </span>
      <span className="term-row-actions">
        <button type="button" className="term-token" onClick={onEdit}>[edit]</button>
        <button type="button" className="term-token is-danger" onClick={onDelete}>[del]</button>
      </span>
    </div>
  );
}

function RoutineBlock({
  group,
  today,
  skills,
  progressMap,
  now,
  onHabitAction,
  onEdit,
  onDelete,
  renderPanel,
}: {
  group: DisplayRoutineGroup;
  today: string;
  skills: SkillOption[];
  progressMap: Map<string, GoalDailyProgress>;
  now: Date;
  onHabitAction: (goalId: string, action: HabitAction) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  renderPanel: (goalId: string) => ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="term-group">
      <button type="button" className="term-group-head" onClick={() => setOpen(value => !value)}>
        <span className="term-group-name" style={{ color: group.color }}>
          <HabitIcon name={group.icon ?? 'ListChecks'} size={14} aria-hidden /> {group.name}
          <span className="term-row-inline">{`// ${group.comment}`}</span>
        </span>
        <span className="term-group-count">
          {`[${group.completed}/${group.total}] ${open ? '▾' : '▸'}`}
        </span>
      </button>
      {open &&
        group.goals.map(goal => {
          const skill = skills.find(item => item.id === goal.skillId);
          return (
            <Fragment key={goal.id}>
              <QuestRow
                goal={goal}
                color={group.color}
                today={today}
                skillPath={skill ? skill.name : undefined}
                grouped
                progress={progressMap.get(goal.id)}
                now={now}
                onAction={action => onHabitAction(goal.id, action)}
                onEdit={() => onEdit(goal)}
                onDelete={() => onDelete(goal)}
              />
              {renderPanel(goal.id)}
            </Fragment>
          );
        })}
    </section>
  );
}

function HabitDraftPanel({
  draft,
  skills,
  routines,
  onChange,
  onSubmit,
  onCancel,
}: {
  draft: Goal;
  skills: SkillOption[];
  routines: Routine[];
  onChange: (draft: Goal) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <TerminalCommandPanel command={draft.id ? 'habit --edit' : 'habit --new'} onCancel={onCancel}>
      <form className="term-form" onSubmit={onSubmit}>
        <label>name<input autoFocus className="term-input" value={draft.title} onChange={event => onChange({ ...draft, title: event.target.value })} /></label>
        <label>note<input className="term-input" value={draft.note ?? ''} onChange={event => onChange({ ...draft, note: event.target.value })} placeholder="why or how to do it" /></label>
        <IconPicker value={draft.icon ?? 'Target'} onChange={icon => onChange({ ...draft, icon })} label="Habit icon" />
        <label>skill
          <select className="term-input" value={draft.skillId} onChange={event => onChange({ ...draft, skillId: event.target.value })}>
            <option value="">select skill</option>
            {skills.map(skill => <option key={skill.id} value={skill.id} disabled={!skill.isUnlocked}>{skill.category.name} / {skill.name}{skill.isUnlocked ? '' : ' [locked]'}</option>)}
          </select>
        </label>
        <label>routine
          <select className="term-input" value={draft.routineId ?? ''} onChange={event => onChange({ ...draft, routineId: event.target.value || undefined })}>
            <option value="">automatic category group</option>
            {[...routines].sort((a, b) => a.sortOrder - b.sortOrder).map(routine => <option key={routine.id} value={routine.id}>{routine.name}</option>)}
          </select>
        </label>
        <fieldset className="term-fieldset">
          <legend>tracking</legend>
          <div className="term-filter-row">
            {(['checkbox', 'counter', 'numeric', 'timer', 'health'] as TrackingMode[]).map(mode => (
              <button type="button" key={mode} className={`term-token${trackingMode(draft) === mode ? ' is-active' : ''}`} onClick={() => onChange({
                ...draft,
                trackingMode: mode,
                targetValue: mode === 'checkbox' || mode === 'health' ? 1 : draft.targetValue ?? 1,
                unit: mode === 'timer' ? 'minutes' : draft.unit ?? 'times',
              })}>{`[${mode}]`}</button>
            ))}
          </div>
          {trackingMode(draft) !== 'checkbox' && trackingMode(draft) !== 'health' && (
            <>
              <label>target<input className="term-input" type="number" min="1" value={draft.targetValue ?? 1} onChange={event => onChange({ ...draft, targetValue: Math.max(1, Number(event.target.value)) })} /></label>
              <label>unit<input className="term-input" value={trackingMode(draft) === 'timer' ? 'minutes' : draft.unit ?? ''} disabled={trackingMode(draft) === 'timer'} onChange={event => onChange({ ...draft, unit: event.target.value })} /></label>
            </>
          )}
          {trackingMode(draft) === 'health' && <p className="term-comment">{'// display-only placeholder; excluded from XP and daily goal scoring'}</p>}
        </fieldset>
        <fieldset className="term-fieldset">
          <legend>difficulty</legend>
          <div className="term-filter-row">
            {QUEST_DIFFICULTIES.map(difficulty => (
              <button
                type="button"
                key={difficulty}
                className={`term-token${(draft.difficulty ?? 'easy') === difficulty ? ' is-active' : ''}`}
                onClick={() => onChange({ ...draft, difficulty })}
              >
                {`[${difficulty}]`}
              </button>
            ))}
          </div>
          <p className="term-comment">
            {`// reward: +${questBaseReward(draft.difficulty ?? 'easy', draft)}xp before streak and specialization bonuses`}
          </p>
        </fieldset>
        <fieldset className="term-fieldset">
          <legend>schedule</legend>
          <div className="term-filter-row">
            {(['none', 'daily', 'weekly'] as const).map(type => (
              <button type="button" key={type} className={`term-token${draft.repeatType === type ? ' is-active' : ''}`} onClick={() => onChange({ ...draft, repeatType: type })}>{`[${type === 'none' ? 'one-time' : type}]`}</button>
            ))}
          </div>
          {draft.repeatType === 'weekly' && (
            <div className="term-filter-row">
              {WEEK_LABELS.map((day, index) => {
                const dayNumber = (index + 1) % 7;
                const selected = draft.repeatDays?.includes(dayNumber);
                return <button type="button" key={day} className={`term-token${selected ? ' is-active' : ''}`} onClick={() => onChange({ ...draft, repeatDays: selected ? draft.repeatDays?.filter(value => value !== dayNumber) : [...(draft.repeatDays ?? []), dayNumber] })}>{`[${day.toLowerCase()}]`}</button>;
              })}
            </div>
          )}
        </fieldset>
        <fieldset className="term-fieldset">
          <legend>reminders</legend>
          <div className="term-filter-row">
            {(['once', 'multiple'] as const).map(frequency => <button type="button" key={frequency} className={`term-token${draft.reminderFrequency === frequency ? ' is-active' : ''}`} onClick={() => onChange({ ...draft, reminderFrequency: frequency })}>{`[${frequency}]`}</button>)}
          </div>
          <input
            className="term-input"
            type="time"
            aria-label="Add reminder time"
            onChange={event => {
              if (!event.target.value) return;
              onChange({ ...draft, reminderTimes: [...new Set([...(draft.reminderTimes ?? []), event.target.value])].sort() });
              event.target.value = '';
            }}
          />
          <div className="term-filter-row">
            {draft.reminderTimes?.map(time => <button type="button" className="term-token is-danger" key={time} onClick={() => onChange({ ...draft, reminderTimes: draft.reminderTimes?.filter(value => value !== time) })}>{`[${time} ×]`}</button>)}
          </div>
        </fieldset>
        <div className="term-command-actions">
          <button type="button" className="term-token" onClick={onCancel}>[cancel]</button>
          <button type="submit" className="term-token is-action" disabled={!draft.title.trim() || !draft.skillId}>[save habit]</button>
        </div>
      </form>
    </TerminalCommandPanel>
  );
}

export default function QuestsView({
  userStats,
  categories,
  goals,
  history,
  routines,
  goalDailyProgress,
  onToggleGoal,
  onHabitAction,
  onSaveGoal,
  onDeleteGoal,
}: QuestsViewProps) {
  const [filter, setFilter] = useState<QuestFilter>('today');
  const [weekOffset, setWeekOffset] = useState(0);
  const [draft, setDraft] = useState<Goal | null>(null);
  const [deleteGoal, setDeleteGoal] = useState<Goal | null>(null);
  const [commandOutput, setCommandOutput] = useState('');
  const [, setTimerTick] = useState(0);

  useEffect(() => {
    if (!goalDailyProgress.some(item => item.timerStartedAt && !item.completed)) return;
    const timer = window.setInterval(() => setTimerTick(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [goalDailyProgress]);

  const now = new Date();
  const today = toISODate(now);
  const weekday = now.getDay();
  const progressMap = useMemo(
    () => new Map(goalDailyProgress.filter(item => item.date === today).map(item => [item.goalId, item])),
    [goalDailyProgress, today],
  );

  const skills = useMemo<SkillOption[]>(
    () => categories.flatMap(category => category.skills.map(skill => ({ ...skill, category }))),
    [categories],
  );

  const groups = useMemo(
    () => {
      const scheduled = goals.filter(goal => isGoalScheduled(goal, now));
      const routineIds = new Set(routines.map(routine => routine.id));
      const custom = [...routines]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(routine => {
          const routineGoals = scheduled
            .filter(goal => goal.routineId === routine.id)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          return {
            id: routine.id,
            name: routine.name,
            color: routine.color,
            icon: routine.icon,
            comment: routine.description || 'a custom routine',
            goals: routineGoals,
            completed: routineGoals.filter(goal => isHabitComplete(goal, progressMap.get(goal.id), now)).length,
            total: routineGoals.length,
          };
        })
        .filter(group => group.total > 0);
      const fallbackGoals = scheduled.filter(goal => !goal.routineId || !routineIds.has(goal.routineId));
      return [...custom, ...buildRoutineGroups(categories, fallbackGoals, weekday, today)];
    },
    [categories, goals, progressMap, routines, today, weekday],
  );

  const dailySummary = dailyGoalSummary(goals, goalDailyProgress, userStats.dailyGoalTarget ?? 60, now);

  const visible = goals.filter(goal => {
    if (filter === 'done') return goal.completed;
    if (goal.completed) return filter === 'all';
    if (filter === 'daily') return goal.repeatType === 'daily' || (!goal.repeatType && goal.isRepeatable);
    if (filter === 'weekly') return goal.repeatType === 'weekly';
    if (filter === 'once') return !goal.repeatType || goal.repeatType === 'none';
    return true;
  });

  const beginEdit = (goal: Goal) => {
    setDraft({
      ...goal,
      repeatDays: [...(goal.repeatDays ?? [])],
      reminderTimes: [...(goal.reminderTimes ?? [])],
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft?.title.trim() || !draft.skillId) return;
    const action = draft.id ? 'updated' : 'created';
    const title = draft.title.trim();
    const normalized = {
      ...draft,
      id: draft.id || `quest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: draft.title.trim(),
      repeatDays: draft.repeatType === 'weekly' ? draft.repeatDays : undefined,
      isRepeatable: draft.repeatType !== 'none',
      reminderTimes: (draft.reminderTimes ?? []).filter(Boolean),
    };
    onSaveGoal({
      ...normalized,
      xpReward: normalized.trackingMode === 'health' ? 0 : questBaseReward(normalized.difficulty ?? 'easy', normalized),
    });
    setCommandOutput(`${action} habit "${title}"`);
    setDraft(null);
  };

  const habitPanel = draft && (
    <HabitDraftPanel
      draft={draft}
      skills={skills}
      routines={routines}
      onChange={setDraft}
      onSubmit={submit}
      onCancel={() => setDraft(null)}
    />
  );

  const deletePanel = deleteGoal && (
    <TerminalCommandPanel command="habit --delete" onCancel={() => setDeleteGoal(null)}>
      <p className="term-comment">{`// permanently delete "${deleteGoal.title}"?`}</p>
      <div className="term-command-actions">
        <button type="button" className="term-token" onClick={() => setDeleteGoal(null)}>[cancel]</button>
        <button type="button" className="term-token is-danger" onClick={() => {
          onDeleteGoal(deleteGoal.id);
          setCommandOutput(`deleted habit "${deleteGoal.title}"`);
          setDeleteGoal(null);
        }}>[confirm delete]</button>
      </div>
    </TerminalCommandPanel>
  );

  /** Panels render right under the row they belong to so they are never off-screen. */
  const renderPanel = (goalId: string): ReactNode => (
    <>
      {draft?.id === goalId && habitPanel}
      {deleteGoal?.id === goalId && deletePanel}
    </>
  );

  const promptCmd = filter === 'today' ? 'habits --daily' : `habits --${filter}`;
  const meta =
    filter === 'today'
      ? `// ${dailySummary.completed}/${dailySummary.total} logged · ${dailySummary.percent}% of ${userStats.dailyGoalTarget ?? 60}% daily goal. ${
          dailySummary.met
            ? 'daily goal complete.'
            : dailySummary.total === 0
              ? 'nothing scheduled.'
              : 'the rest is still open.'
        }`
      : `// ${goals.filter(goal => !goal.completed).length} active · ${goals.filter(goal => goal.completed).length} completed`;

  return (
    <>
      <p className="term-prompt">
        <span className="term-prompt-user">{`${userStats.name || 'user'}[L${userStats.level}]@lifequest`}</span>
        <span className="term-prompt-symbol">$</span>
        <span className="term-prompt-cmd">{promptCmd}</span>
      </p>
      <p className="term-comment">{meta}</p>

      <div className="term-toolbar">
        <div className="term-filter-row">
          {FILTERS.map(option => (
            <button
              type="button"
              key={option}
              className={`term-token${filter === option ? ' is-active' : ''}`}
              onClick={() => setFilter(option)}
            >
              {`[${option}]`}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="term-token is-action"
          onClick={() => setDraft(newDraft(skills.find(skill => skill.isUnlocked)?.id))}
        >
          [+ habit]
        </button>
      </div>

      {draft && !draft.id && habitPanel}

      {filter === 'today' && (
        <>
          <p className="term-date">{formatLongDate(now)}</p>
          <p className="term-meta">
            <span className="term-meta-flame">{`\u25B2 ${userStats.streak} days`}</span>
            <span className="term-meta-sep">*</span>
            <span className="term-meta-shield">{`\u25C6 ${userStats.streakShields ?? 0}/3 shields · ${userStats.shieldProgress ?? 0}/5`}</span>
            <span className="term-meta-sep">*</span>
            <span className="term-meta-xp">
              {`${userStats.xp}/${userStats.maxXp} xp · ${Math.round((userStats.xp / userStats.maxXp) * 100)}% · ${userStats.maxXp - userStats.xp} left`}
            </span>
          </p>
          <WeekStrip
            history={history}
            weekOffset={weekOffset}
            onShiftWeek={delta => setWeekOffset(value => value + delta)}
          />
        </>
      )}

      {filter === 'today' ? (
        groups.length === 0 ? (
          <p className="term-comment">{'// nothing scheduled. [+ habit] to add one.'}</p>
        ) : (
          groups.map(group => (
            <RoutineBlock
              key={group.id}
              group={group}
              today={today}
              skills={skills}
              progressMap={progressMap}
              now={now}
              onHabitAction={onHabitAction}
              onEdit={beginEdit}
              onDelete={setDeleteGoal}
              renderPanel={renderPanel}
            />
          ))
        )
      ) : (
        <section className="term-section">
          {visible.length === 0 && <p className="term-comment">{'// no quests match this filter'}</p>}
          {visible.map(goal => {
            const skill = skills.find(item => item.id === goal.skillId);
            return (
              <Fragment key={goal.id}>
                <QuestRow
                  goal={goal}
                  color={skill?.category.color}
                  today={today}
                  skillPath={`${skill?.category.name ?? 'unknown'} > ${skill?.name ?? goal.skillId}`}
                  progress={progressMap.get(goal.id)}
                  now={now}
                  onAction={action => onHabitAction(goal.id, action)}
                  onEdit={() => beginEdit(goal)}
                  onDelete={() => setDeleteGoal(goal)}
                />
                {renderPanel(goal.id)}
              </Fragment>
            );
          })}
        </section>
      )}

      {commandOutput && <p className="term-command-output"><b>&gt;</b> {commandOutput}</p>}
    </>
  );
}
