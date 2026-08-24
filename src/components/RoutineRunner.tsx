import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import { Goal, GoalDailyProgress, Routine } from '../types';
import { HabitAction, isHabitComplete, orderRoutineGoals } from '../habits/habitDomain';
import { HabitIcon } from './icons';

interface RoutineRunnerProps {
  routine: Routine;
  goals: Goal[];
  progress: GoalDailyProgress[];
  today: string;
  onHabitAction: (goalId: string, action: HabitAction) => void;
  onClose: () => void;
  theme?: 'clay' | 'terminal';
}

export default function RoutineRunner({
  routine,
  goals,
  progress,
  today,
  onHabitAction,
  onClose,
  theme = 'clay',
}: RoutineRunnerProps) {
  const chain = useMemo(() => orderRoutineGoals(goals, routine.id), [goals, routine.id]);
  const progressMap = useMemo(
    () => new Map(progress.filter(item => item.date === today).map(item => [item.goalId, item])),
    [progress, today],
  );
  const [index, setIndex] = useState(0);
  const current = chain[index];
  const now = new Date();

  if (!current) {
    return null;
  }

  const complete = isHabitComplete(current, progressMap.get(current.id), now);
  const doneCount = chain.filter(goal => isHabitComplete(goal, progressMap.get(goal.id), now)).length;

  const shellClass = theme === 'terminal'
    ? 'term-command-panel'
    : 'clay-card fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md p-4 shadow-2xl';

  return (
    <div className={theme === 'terminal' ? 'term-section' : 'fixed inset-0 z-50 flex items-end bg-black/40 p-4'}>
      <div className={shellClass}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className={theme === 'terminal' ? 'term-comment' : 'text-[10px] font-bold uppercase text-slate-400'}>
              {theme === 'terminal' ? `// run routine: ${routine.name}` : `Run routine · ${routine.name}`}
            </p>
            <p className={theme === 'terminal' ? 'term-group-name' : 'truncate text-sm font-black text-slate-800'}>
              {`${index + 1}/${chain.length} · ${doneCount} done`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close routine runner" className={theme === 'terminal' ? 'term-token' : 'text-slate-400'}>
            {theme === 'terminal' ? '[close]' : <X size={18} />}
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <span style={{ color: routine.color }}>
            <HabitIcon name={current.icon ?? 'Target'} size={18} />
          </span>
          <span className={theme === 'terminal' ? 'term-row-name' : 'text-sm font-bold text-slate-700'}>
            {current.title}
          </span>
          {complete && (
            <span className={theme === 'terminal' ? 'term-state-on' : 'text-[10px] font-black text-emerald-600'}>
              {theme === 'terminal' ? '[done]' : 'Done'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!complete && (
            <>
              <button
                type="button"
                className={theme === 'terminal' ? 'term-token is-action' : 'rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white'}
                onClick={() => onHabitAction(current.id, { type: 'toggle' })}
              >
                {theme === 'terminal' ? '[complete step]' : 'Complete step'}
              </button>
              <button
                type="button"
                className={theme === 'terminal' ? 'term-token' : 'rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700'}
                onClick={() => onHabitAction(current.id, { type: 'two-minute' })}
              >
                {theme === 'terminal' ? '[2-min]' : '2-min version'}
              </button>
            </>
          )}
          <button
            type="button"
            disabled={index === 0}
            className={theme === 'terminal' ? 'term-token' : 'rounded-lg p-2 text-slate-400 disabled:opacity-30'}
            onClick={() => setIndex(value => Math.max(0, value - 1))}
          >
            {theme === 'terminal' ? '[prev]' : <ChevronLeft size={16} />}
          </button>
          <button
            type="button"
            disabled={index >= chain.length - 1}
            className={theme === 'terminal' ? 'term-token' : 'rounded-lg p-2 text-slate-400 disabled:opacity-30'}
            onClick={() => setIndex(value => Math.min(chain.length - 1, value + 1))}
          >
            {theme === 'terminal' ? '[next]' : <ChevronRight size={16} />}
          </button>
          {index < chain.length - 1 && complete && (
            <button
              type="button"
              className={theme === 'terminal' ? 'term-token is-action' : 'ml-auto flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white'}
              onClick={() => setIndex(value => value + 1)}
            >
              {theme === 'terminal' ? '[next habit]' : <><Play size={12} /> Next habit</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
