import type { BreakInversions, Goal } from '../types';
import {
  BREAK_LAW_GUIDES,
  breakInversionProgress,
  defaultBreakInversions,
  formatBreakPlan,
  generateInversionQuests,
  isBreakModeHabit,
} from '../habits/breakMode';

interface BreakModePanelProps {
  goal: Goal;
  goals: Goal[];
  theme?: 'clay' | 'terminal';
  onChange: (goal: Goal) => void;
  onAddInversionQuests?: (created: Goal[]) => void;
  compact?: boolean;
}

export function BreakModePanel({
  goal,
  goals,
  theme = 'clay',
  onChange,
  onAddInversionQuests,
  compact = false,
}: BreakModePanelProps) {
  if (!isBreakModeHabit(goal)) return null;

  const inversions = goal.breakInversions ?? defaultBreakInversions(goal.title.replace(/^Break:\s*/i, ''));
  const { configured, total } = breakInversionProgress(inversions);
  const replacement = goal.replacementGoalId
    ? goals.find(item => item.id === goal.replacementGoalId)
    : undefined;

  const updateInversion = (key: keyof BreakInversions, value: string) => {
    onChange({
      ...goal,
      breakInversions: { ...inversions, [key]: value },
    });
  };

  const spawnQuests = () => {
    const created = generateInversionQuests({ ...goal, breakInversions: inversions });
    onAddInversionQuests?.(created);
  };

  if (theme === 'terminal') {
    return (
      <section className="term-section">
        <h2 className="term-section-title is-bad">break mode</h2>
        <p className="term-comment is-nested">{`// invert the 4 laws · ${configured}/${total} armed`}</p>
        {goal.habitKind === 'replace' && replacement && (
          <p className="term-comment">{`// replace with “${replacement.title}”`}</p>
        )}
        {BREAK_LAW_GUIDES.map(law => (
          <div className="term-field" key={law.key}>
            <label className="term-field-label" htmlFor={`break-${goal.id}-${law.key}`}>
              {law.key}
            </label>
            <input
              id={`break-${goal.id}-${law.key}`}
              className="term-input"
              value={inversions[law.key] ?? ''}
              onChange={event => updateInversion(law.key, event.target.value)}
              placeholder={law.prompt}
            />
            <span className="term-comment is-nested">{`// ${law.inversion}`}</span>
          </div>
        ))}
        {!compact && onAddInversionQuests && (
          <button type="button" className="term-token is-action" onClick={spawnQuests}>
            {`[spawn ${configured} inversion quests]`}
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/80 p-3">
      <div>
        <h4 className="text-xs font-black uppercase tracking-wider text-rose-800">Break mode</h4>
        <p className="text-[10px] text-rose-900/80">
          Invert the 4 laws · {configured}/{total} strategies set
        </p>
        {goal.habitKind === 'replace' && replacement && (
          <p className="text-[10px] font-medium text-rose-800">Replace with: {replacement.title}</p>
        )}
      </div>
      {BREAK_LAW_GUIDES.map(law => (
        <label key={law.key} className="block space-y-1">
          <span className="text-[10px] font-bold text-rose-900">{law.law}</span>
          <input
            className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs text-slate-800"
            value={inversions[law.key] ?? ''}
            onChange={event => updateInversion(law.key, event.target.value)}
            placeholder={law.prompt}
          />
        </label>
      ))}
      {!compact && onAddInversionQuests && configured > 0 && (
        <button
          type="button"
          className="w-full rounded-xl bg-rose-700 py-2 text-xs font-black text-white"
          onClick={spawnQuests}
        >
          Create {configured} inversion quest{configured === 1 ? '' : 's'}
        </button>
      )}
    </section>
  );
}

interface BreakModeListProps {
  goals: Goal[];
  theme?: 'clay' | 'terminal';
  onOpenGoal?: (goalId: string) => void;
}

export function BreakModeList({ goals, theme = 'clay', onOpenGoal }: BreakModeListProps) {
  const breakGoals = goals.filter(isBreakModeHabit);
  if (breakGoals.length === 0) return null;

  if (theme === 'terminal') {
    return (
      <section className="term-section">
        <h2 className="term-section-title is-bad">break habits</h2>
        {breakGoals.map(goal => {
          const progress = breakInversionProgress(goal.breakInversions);
          return (
            <div className="term-stat-card" key={goal.id}>
              <p className="term-stat-line">
                <span className="term-stat-label">{goal.title.toLowerCase()}</span>
                <span className="term-stat-value">{`${progress.configured}/${progress.total}`}</span>
              </p>
              {goal.breakInversions && (
                <p className="term-comment is-nested">{`// ${formatBreakPlan(goal).split('\n')[0] ?? 'configure inversions'}`}</p>
              )}
              {onOpenGoal && (
                <button type="button" className="term-token" onClick={() => onOpenGoal(goal.id)}>[edit]</button>
              )}
            </div>
          );
        })}
      </section>
    );
  }

  return (
    <section className="clay-card space-y-2 p-4">
      <h3 className="text-sm font-black text-slate-800">Break habits</h3>
      {breakGoals.map(goal => {
        const progress = breakInversionProgress(goal.breakInversions);
        return (
          <button
            type="button"
            key={goal.id}
            className="flex w-full items-center justify-between rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-left"
            onClick={() => onOpenGoal?.(goal.id)}
          >
            <span className="text-xs font-bold text-rose-900">{goal.title}</span>
            <span className="text-[10px] font-bold text-rose-700">{progress.configured}/{progress.total} laws</span>
          </button>
        );
      })}
    </section>
  );
}

export { isBreakModeHabit, enableBreakMode } from '../habits/breakMode';
