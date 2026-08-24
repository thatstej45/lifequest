import { FormEvent, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Edit2, Play, Plus, Trash2, X } from 'lucide-react';
import { Goal, Routine } from '../types';
import {
  formatHabitStackPhrase,
  goalWithRoutineAssignment,
  goalWithStackAnchor,
  orderRoutineGoals,
} from '../habits/habitDomain';
import RoutineStackControls, { RoutineStackPhrase } from './RoutineStackControls';
import { HabitIcon, IconPicker } from './icons';

interface ClayRoutinesViewProps {
  routines: Routine[];
  goals: Goal[];
  onRunRoutine?: (routineId: string) => void;
  onSaveRoutine: (routine: Routine) => void;
  onDeleteRoutine: (id: string) => void;
  onMoveRoutine: (id: string, direction: -1 | 1) => void;
  onSaveGoal: (goal: Goal) => void;
}

const newRoutine = (sortOrder: number): Routine => ({
  id: '',
  name: '',
  description: '',
  icon: 'Sun',
  color: '#3b82f6',
  sortOrder,
});

export default function ClayRoutinesView({
  routines,
  goals,
  onRunRoutine,
  onSaveRoutine,
  onDeleteRoutine,
  onMoveRoutine,
  onSaveGoal,
}: ClayRoutinesViewProps) {
  const [draft, setDraft] = useState<Routine | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const sorted = useMemo(() => [...routines].sort((a, b) => a.sortOrder - b.sortOrder), [routines]);
  const routineIds = useMemo(() => new Set(routines.map(routine => routine.id)), [routines]);
  const unassigned = goals.filter(goal => !goal.routineId || !routineIds.has(goal.routineId));

  const saveDraft = (event: FormEvent) => {
    event.preventDefault();
    if (!draft?.name.trim()) return;
    onSaveRoutine({
      ...draft,
      id: draft.id || `routine-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: draft.name.trim(),
      description: draft.description?.trim(),
    });
    setDraft(null);
  };

  const assignRoutine = (goal: Goal, routineId: string) => {
    onSaveGoal(goalWithRoutineAssignment(goal, routineId || undefined, goals));
  };

  const assignStack = (goal: Goal, anchorId: string | undefined) => {
    const next = goalWithStackAnchor(goal, anchorId, goals);
    if (next) onSaveGoal(next);
  };

  const assignment = (goal: Goal, routineId: string | undefined) => (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      <RoutineStackControls
        goal={goal}
        goals={goals}
        routineId={routineId}
        theme="clay"
        onStackChange={assignStack}
      />
      <select
        aria-label={`Routine for ${goal.title}`}
        className="min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-600 outline-none focus:border-blue-400"
        value={goal.routineId && routineIds.has(goal.routineId) ? goal.routineId : ''}
        onChange={event => assignRoutine(goal, event.target.value)}
      >
        <option value="">No routine</option>
        {sorted.map(routine => <option key={routine.id} value={routine.id}>{routine.name}</option>)}
      </select>
    </div>
  );

  const habitRow = (goal: Goal, routineId: string | undefined, color = '#64748b') => (
    <div key={goal.id} className="border-t border-slate-100 py-2 first:border-t-0">
      <div className="flex items-center gap-2">
        <span className="shrink-0" style={{ color }}>
          <HabitIcon name={goal.icon ?? 'Target'} size={15} />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">{goal.title}</span>
        {assignment(goal, routineId)}
      </div>
      <RoutineStackPhrase goal={goal} goals={goals} theme="clay" />
    </div>
  );

  const stackSummary = (routineId: string) => {
    const chain = orderRoutineGoals(goals, routineId);
    const phrases = chain
      .map(goal => formatHabitStackPhrase(goal, goals))
      .filter((phrase): phrase is string => Boolean(phrase));
    if (!phrases.length) return null;
    return (
      <div className="mb-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Habit stack</p>
        <ul className="mt-1 space-y-0.5">
          {phrases.map(phrase => (
            <li key={phrase} className="text-[11px] font-medium text-slate-700">{phrase}</li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black italic tracking-tighter">ROUTINES</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Group habits into parts of your day, then stack them in order
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft(newRoutine(sorted.length))}
          className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white shadow-md shadow-blue-500/20"
        >
          <Plus size={15} /> Add
        </button>
      </div>

      {draft && (
        <form onSubmit={saveDraft} className="clay-card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-700">{draft.id ? 'Edit routine' : 'New routine'}</h3>
            <button type="button" onClick={() => setDraft(null)} className="text-slate-500"><X size={18} /></button>
          </div>
          <input
            autoFocus
            value={draft.name}
            onChange={event => setDraft({ ...draft, name: event.target.value })}
            placeholder="Routine name"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-blue-400"
          />
          <input
            value={draft.description ?? ''}
            onChange={event => setDraft({ ...draft, description: event.target.value })}
            placeholder="When or why you do this routine"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          <IconPicker value={draft.icon} onChange={icon => setDraft({ ...draft, icon })} color={draft.color} label="Routine icon" />
          <div className="flex items-center gap-3">
            <label className="text-[10px] font-black uppercase text-slate-600">Color</label>
            <input type="color" value={draft.color} onChange={event => setDraft({ ...draft, color: event.target.value })} />
            <button type="submit" disabled={!draft.name.trim()} className="ml-auto rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40">
              Save routine
            </button>
          </div>
        </form>
      )}

      {sorted.map((routine, index) => {
        const members = orderRoutineGoals(goals, routine.id);
        return (
          <section key={routine.id} className="clay-card overflow-hidden p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: routine.color }}>
                <HabitIcon name={routine.icon} size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black text-slate-800">{routine.name}</h3>
                <p className="truncate text-[10px] font-medium text-slate-500">{routine.description || `${members.length} habits`}</p>
              </div>
              <div className="flex items-center gap-1">
                {onRunRoutine && members.length > 0 && (
                  <button type="button" onClick={() => onRunRoutine(routine.id)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[9px] font-black text-white">
                    <Play size={11} /> Run
                  </button>
                )}
                <button type="button" disabled={index === 0} onClick={() => onMoveRoutine(routine.id, -1)} className="p-1.5 text-slate-500 disabled:opacity-25"><ArrowUp size={14} /></button>
                <button type="button" disabled={index === sorted.length - 1} onClick={() => onMoveRoutine(routine.id, 1)} className="p-1.5 text-slate-500 disabled:opacity-25"><ArrowDown size={14} /></button>
                <button type="button" onClick={() => setDraft({ ...routine })} className="clay-edit-btn p-2"><Edit2 size={13} /></button>
                {deletingId === routine.id ? (
                  <button type="button" onClick={() => { onDeleteRoutine(routine.id); setDeletingId(null); }} className="rounded-lg bg-red-600 px-2 py-1.5 text-[9px] font-black text-white">DELETE</button>
                ) : (
                  <button type="button" onClick={() => setDeletingId(routine.id)} className="clay-delete-btn p-2"><Trash2 size={13} /></button>
                )}
              </div>
            </div>
            <div className="mt-3">
              {members.length ? (
                <>
                  {stackSummary(routine.id)}
                  {members.map(goal => habitRow(goal, routine.id, routine.color))}
                </>
              ) : (
                <p className="border-t border-slate-100 pt-3 text-xs font-medium text-slate-500">
                  Assign habits from the list below, then choose which habit each one follows.
                </p>
              )}
            </div>
          </section>
        );
      })}

      <section className="clay-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-700">Unassigned habits</h3>
          <span className="text-[10px] font-black text-slate-500">{unassigned.length}</span>
        </div>
        <p className="mb-2 text-[10px] font-medium text-slate-500">
          Pick a routine first. Stacking unlocks once two or more habits share that routine.
        </p>
        {unassigned.length ? unassigned.map(goal => habitRow(goal, undefined, '#64748b')) : (
          <p className="text-xs font-medium text-slate-500">Every habit belongs to a routine.</p>
        )}
      </section>
    </div>
  );
}
