import { Goal } from '../types';
import { formatHabitStackPhrase, validStackAnchors } from '../habits/habitDomain';
import TerminalSelect from '../terminal/TerminalSelect';

interface RoutineStackControlsProps {
  goal: Goal;
  goals: Goal[];
  routineId: string | undefined;
  theme: 'clay' | 'terminal';
  onStackChange: (goal: Goal, anchorId: string | undefined) => void;
}

const stackHint = (routineId: string | undefined, anchors: Goal[]) => {
  if (!routineId) return 'assign a routine first';
  if (anchors.length === 0) return 'add another habit first';
  return null;
};

export function RoutineStackPhrase({
  goal,
  goals,
  theme,
}: {
  goal: Goal;
  goals: Goal[];
  theme: 'clay' | 'terminal';
}) {
  const phrase = formatHabitStackPhrase(goal, goals);
  if (!phrase) return null;
  return theme === 'terminal'
    ? <p className="term-comment is-nested">{`// ${phrase}`}</p>
    : <p className="text-[10px] font-medium text-slate-600">{phrase}</p>;
}

export default function RoutineStackControls({
  goal,
  goals,
  routineId,
  theme,
  onStackChange,
}: RoutineStackControlsProps) {
  const anchors = routineId ? validStackAnchors(goals, routineId, goal.id) : [];
  const hint = stackHint(routineId, anchors);

  if (hint) {
    return theme === 'terminal'
      ? <span className="term-comment term-stack-hint">{`// ${hint}`}</span>
      : <span className="shrink-0 text-[10px] font-bold text-slate-500">{hint}</span>;
  }

  const options = [
    { value: '', label: theme === 'terminal' ? 'no stack' : 'No stack' },
    ...anchors.map(anchor => ({ value: anchor.id, label: anchor.title })),
  ];

  if (theme === 'terminal') {
    return (
      <TerminalSelect
        className="term-inline-select"
        ariaLabel={`Stack after for ${goal.title}`}
        value={goal.stackAfterGoalId ?? ''}
        onChange={anchorId => onStackChange(goal, anchorId || undefined)}
        options={options}
      />
    );
  }

  return (
    <select
      aria-label={`Stack after for ${goal.title}`}
      className="min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-600 outline-none focus:border-blue-400"
      value={goal.stackAfterGoalId ?? ''}
      onChange={event => onStackChange(goal, event.target.value || undefined)}
    >
      {options.map(option => (
        <option key={option.value || 'none'} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}
