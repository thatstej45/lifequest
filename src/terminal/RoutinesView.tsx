import { FormEvent, useMemo, useState } from 'react';
import { Goal, Routine, UserStats } from '../types';
import { HabitIcon, IconPicker } from '../components/icons';
import TerminalCommandPanel from './TerminalCommandPanel';
import TerminalSelect from './TerminalSelect';
import { goalCadence } from './utils';

interface RoutinesViewProps {
  userStats: UserStats;
  routines: Routine[];
  goals: Goal[];
  onSaveRoutine: (routine: Routine) => void;
  onDeleteRoutine: (id: string) => void;
  onMoveRoutine: (id: string, direction: -1 | 1) => void;
  onSaveGoal: (goal: Goal) => void;
}

const blankRoutine = (sortOrder: number): Routine => ({
  id: '',
  name: '',
  description: '',
  icon: 'Sun',
  color: '#22c55e',
  sortOrder,
});

export default function RoutinesView({
  userStats,
  routines,
  goals,
  onSaveRoutine,
  onDeleteRoutine,
  onMoveRoutine,
  onSaveGoal,
}: RoutinesViewProps) {
  const [draft, setDraft] = useState<Routine | null>(null);
  const [deleting, setDeleting] = useState<Routine | null>(null);
  const [commandOutput, setCommandOutput] = useState('');

  const sorted = useMemo(() => [...routines].sort((a, b) => a.sortOrder - b.sortOrder), [routines]);
  const routineIds = useMemo(() => new Set(routines.map(routine => routine.id)), [routines]);
  const unassigned = goals.filter(goal => !goal.routineId || !routineIds.has(goal.routineId));
  const assignedCount = goals.length - unassigned.length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft?.name.trim()) return;
    const name = draft.name.trim();
    onSaveRoutine({
      ...draft,
      id: draft.id || `routine-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      description: draft.description?.trim(),
    });
    setCommandOutput(`${draft.id ? 'updated' : 'created'} routine "${name}"`);
    setDraft(null);
  };

  const assign = (goal: Goal, routineId: string) => {
    onSaveGoal({ ...goal, routineId: routineId || undefined });
    setCommandOutput(
      routineId
        ? `moved "${goal.title}" to ${routines.find(routine => routine.id === routineId)?.name ?? 'routine'}`
        : `removed "${goal.title}" from its routine`,
    );
  };

  const habitRow = (goal: Goal, color?: string) => (
    <div className="term-quest-row is-dense" key={goal.id}>
      <span className={goal.completed ? 'term-state-on' : 'term-state-off'}>{goal.completed ? '[✓]' : '[ ]'}</span>
      <span className="term-row-name" style={color ? { color } : undefined}>
        <HabitIcon name={goal.icon ?? 'Target'} size={13} aria-hidden /> {goal.title}
      </span>
      <span className="term-row-inline">{`// ${goal.difficulty ?? 'easy'} · ${goalCadence(goal)}`}</span>
      <TerminalSelect
        className="term-inline-select"
        ariaLabel={`Routine for ${goal.title}`}
        value={goal.routineId && routineIds.has(goal.routineId) ? goal.routineId : ''}
        onChange={routineId => assign(goal, routineId)}
        options={[
          { value: '', label: 'no routine' },
          ...sorted.map(routine => ({ value: routine.id, label: routine.name })),
        ]}
      />
    </div>
  );

  const routinePanel = (routine: Routine) => (
    <TerminalCommandPanel command={routine.id ? 'routine --edit' : 'routine --new'} onCancel={() => setDraft(null)}>
      <form className="term-form" onSubmit={submit}>
        <label>name<input autoFocus className="term-input" value={routine.name} onChange={event => setDraft({ ...routine, name: event.target.value })} /></label>
        <label>description<input className="term-input" value={routine.description ?? ''} onChange={event => setDraft({ ...routine, description: event.target.value })} placeholder="when this part of the day happens" /></label>
        <IconPicker value={routine.icon} onChange={icon => setDraft({ ...routine, icon })} color={routine.color} label="Routine icon" />
        <label>color<input className="term-input term-color-input" type="color" value={routine.color} onChange={event => setDraft({ ...routine, color: event.target.value })} /></label>
        <div className="term-command-actions">
          <button type="button" className="term-token" onClick={() => setDraft(null)}>[cancel]</button>
          <button type="submit" className="term-token is-action" disabled={!routine.name.trim()}>[save routine]</button>
        </div>
      </form>
    </TerminalCommandPanel>
  );

  return (
    <>
      <p className="term-prompt">
        <span className="term-prompt-user">{`${userStats.name || 'user'}[L${userStats.level}]@lifequest`}</span>
        <span className="term-prompt-symbol">$</span>
        <span className="term-prompt-cmd">routines --list</span>
      </p>
      <p className="term-comment">
        {`// ${sorted.length} routines · ${assignedCount} habits grouped · ${unassigned.length} unassigned`}
      </p>

      <div className="term-toolbar">
        <p className="term-comment">{'// group habits into repeatable parts of your day'}</p>
        <button type="button" className="term-token is-action" onClick={() => setDraft(blankRoutine(sorted.length))}>
          [+ routine]
        </button>
      </div>

      {draft && !draft.id && routinePanel(draft)}

      {sorted.map((routine, index) => {
        const members = goals
          .filter(goal => goal.routineId === routine.id)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        return (
          <section className="term-group" key={routine.id}>
            <div className="term-group-head">
              <span className="term-group-name" style={{ color: routine.color }}>
                <HabitIcon name={routine.icon} size={14} color={routine.color} aria-hidden /> {routine.name}
                <span className="term-row-inline">{`// ${routine.description || 'a custom routine'}`}</span>
              </span>
              <span className="term-row-actions">
                <span className="term-group-count">{`[${members.length} habits]`}</span>
                <button type="button" className="term-token" disabled={index === 0} onClick={() => onMoveRoutine(routine.id, -1)}>[↑]</button>
                <button type="button" className="term-token" disabled={index === sorted.length - 1} onClick={() => onMoveRoutine(routine.id, 1)}>[↓]</button>
                <button type="button" className="term-token" onClick={() => setDraft({ ...routine })}>[edit]</button>
                <button type="button" className="term-token is-danger" onClick={() => setDeleting(routine)}>[del]</button>
              </span>
            </div>

            {draft?.id === routine.id && routinePanel(draft)}
            {deleting?.id === routine.id && (
              <TerminalCommandPanel command="routine --delete" onCancel={() => setDeleting(null)}>
                <p className="term-comment">{`// delete "${routine.name}"? its ${members.length} habits move back to their category groups.`}</p>
                <div className="term-command-actions">
                  <button type="button" className="term-token" onClick={() => setDeleting(null)}>[cancel]</button>
                  <button
                    type="button"
                    className="term-token is-danger"
                    onClick={() => {
                      onDeleteRoutine(routine.id);
                      setCommandOutput(`deleted routine "${routine.name}"`);
                      setDeleting(null);
                    }}
                  >
                    [confirm delete]
                  </button>
                </div>
              </TerminalCommandPanel>
            )}

            {members.length === 0
              ? <p className="term-comment is-nested">{'// empty. assign habits from the list below.'}</p>
              : members.map(goal => habitRow(goal, routine.color))}
          </section>
        );
      })}

      <section className="term-group">
        <div className="term-group-head">
          <span className="term-group-name is-muted">unassigned habits</span>
          <span className="term-group-count">{`[${unassigned.length} habits]`}</span>
        </div>
        {unassigned.length === 0
          ? <p className="term-comment is-nested">{'// every habit belongs to a routine'}</p>
          : unassigned.map(goal => habitRow(goal))}
      </section>

      {commandOutput && <p className="term-command-output"><b>&gt;</b> {commandOutput}</p>}
    </>
  );
}
