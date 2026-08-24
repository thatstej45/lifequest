import { useMemo, useState } from 'react';
import type { Goal, GoalDailyProgress, HistoryRecord, QuarterlyReviewDecision, UserStats } from '../types';
import {
  buildQuarterlyReview,
  completeQuarterlyReview,
  suggestedQuarterlyDecision,
  type QuarterlyReviewSnapshot,
} from '../habits/quarterlyReview';

interface QuarterlyReviewPanelProps {
  userStats: UserStats;
  goals: Goal[];
  progress: GoalDailyProgress[];
  history: HistoryRecord[];
  theme?: 'clay' | 'terminal';
  onSaveReview: (settings: Partial<UserStats>) => void;
}

const DECISIONS: QuarterlyReviewDecision[] = ['keep', 'change', 'drop'];

export function QuarterlyReviewPanel({
  userStats,
  goals,
  progress,
  history,
  theme = 'clay',
  onSaveReview,
}: QuarterlyReviewPanelProps) {
  const snapshot = useMemo(
    () => buildQuarterlyReview(userStats, goals, progress, history),
    [userStats, goals, progress, history],
  );
  const [decisions, setDecisions] = useState<Record<string, QuarterlyReviewDecision>>(
    userStats.quarterlyReviewDecisions ?? {},
  );
  const [expanded, setExpanded] = useState(snapshot.due);

  const setDecision = (goalId: string, decision: QuarterlyReviewDecision) => {
    setDecisions(prev => ({ ...prev, [goalId]: decision }));
  };

  const applySuggestions = () => {
    const next: Record<string, QuarterlyReviewDecision> = { ...decisions };
    [...snapshot.habits, ...snapshot.breakHabits].forEach(item => {
      if (!next[item.goalId]) {
        next[item.goalId] = suggestedQuarterlyDecision(item);
      }
    });
    setDecisions(next);
  };

  const finishReview = () => {
    const updated = completeQuarterlyReview(userStats, decisions);
    onSaveReview({
      lastQuarterlyReviewAt: updated.lastQuarterlyReviewAt,
      quarterlyReviewDecisions: updated.quarterlyReviewDecisions,
    });
    setExpanded(false);
  };

  if (theme === 'terminal') {
    return (
      <QuarterlyReviewTerminal
        snapshot={snapshot}
        decisions={decisions}
        expanded={expanded}
        onToggle={() => setExpanded(value => !value)}
        onDecision={setDecision}
        onSuggest={applySuggestions}
        onFinish={finishReview}
      />
    );
  }

  return (
    <QuarterlyReviewClay
      snapshot={snapshot}
      decisions={decisions}
      expanded={expanded}
      onToggle={() => setExpanded(value => !value)}
      onDecision={setDecision}
      onSuggest={applySuggestions}
      onFinish={finishReview}
    />
  );
}

function TrajectorySummary({ snapshot, theme }: { snapshot: QuarterlyReviewSnapshot; theme: 'clay' | 'terminal' }) {
  const { trajectory } = snapshot;
  if (theme === 'terminal') {
    return (
      <p className="term-comment is-nested">
        {`// 7d ${Math.round((trajectory.windows[0]?.ratio ?? 0) * 100)}% · 30d ${Math.round((trajectory.windows[2]?.ratio ?? 0) * 100)}% · trend ${trajectory.trend}`}
      </p>
    );
  }
  return (
    <p className="text-[10px] text-slate-600">
      Trajectory: 7d {Math.round((trajectory.windows[0]?.ratio ?? 0) * 100)}% · 30d{' '}
      {Math.round((trajectory.windows[2]?.ratio ?? 0) * 100)}% ·{' '}
      {trajectory.trend === 'up' ? 'improving' : trajectory.trend === 'down' ? 'slipping' : 'steady'}
    </p>
  );
}

function IdentityVotes({ snapshot, theme }: { snapshot: QuarterlyReviewSnapshot; theme: 'clay' | 'terminal' }) {
  if (snapshot.identityVotes.length === 0) return null;
  if (theme === 'terminal') {
    return (
      <>
        <p className="term-comment">{'// identity votes (90d completions)'}</p>
        {snapshot.identityVotes.map(vote => (
          <p className="term-stat-line" key={vote.index}>
            <span className="term-stat-label">{vote.statement.toLowerCase()}</span>
            <span className="term-stat-value">{`${vote.completions} votes`}</span>
          </p>
        ))}
      </>
    );
  }
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase text-slate-500">Identity votes (90d)</p>
      {snapshot.identityVotes.map(vote => (
        <p key={vote.index} className="text-xs text-slate-700">
          <span className="font-bold">{vote.statement}</span> · {vote.completions} completions
        </p>
      ))}
    </div>
  );
}

function HabitReviewRows({
  items,
  decisions,
  theme,
  onDecision,
}: {
  items: QuarterlyReviewSnapshot['habits'];
  decisions: Record<string, QuarterlyReviewDecision>;
  theme: 'clay' | 'terminal';
  onDecision: (goalId: string, decision: QuarterlyReviewDecision) => void;
}) {
  if (items.length === 0) {
    return theme === 'terminal'
      ? <p className="term-comment">{'// no habits to review'}</p>
      : <p className="text-xs text-slate-500">No habits to review yet.</p>;
  }

  return items.map(item => {
    const ratio = Math.round(item.completionRatio90d * 100);
    if (theme === 'terminal') {
      return (
        <div className="term-bar-row" key={item.goalId}>
          <span className="term-bar-label">{item.title.toLowerCase()}</span>
          <span className="term-comment is-nested">{`// ${ratio}% · ${item.scorecardRating ?? 'unrated'}`}</span>
          <span className="term-window-row">
            {DECISIONS.map(decision => (
              <button
                type="button"
                key={decision}
                className={`term-token${decisions[item.goalId] === decision ? ' is-active' : ''}`}
                onClick={() => onDecision(item.goalId, decision)}
              >
                {`[${decision}]`}
              </button>
            ))}
          </span>
        </div>
      );
    }

    return (
      <div key={item.goalId} className="rounded-xl border border-slate-100 bg-white/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-800">{item.title}</p>
          <p className="text-[10px] text-slate-500">{ratio}% · {item.scorecardRating ?? 'unrated'}</p>
        </div>
        <div className="mt-2 flex gap-1">
          {DECISIONS.map(decision => (
            <button
              type="button"
              key={decision}
              className={`rounded-lg px-2 py-1 text-[10px] font-black capitalize ${
                decisions[item.goalId] === decision
                  ? decision === 'keep'
                    ? 'bg-emerald-600 text-white'
                    : decision === 'change'
                      ? 'bg-amber-600 text-white'
                      : 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => onDecision(item.goalId, decision)}
            >
              {decision}
            </button>
          ))}
        </div>
      </div>
    );
  });
}

function QuarterlyReviewTerminal({
  snapshot,
  decisions,
  expanded,
  onToggle,
  onDecision,
  onSuggest,
  onFinish,
}: {
  snapshot: QuarterlyReviewSnapshot;
  decisions: Record<string, QuarterlyReviewDecision>;
  expanded: boolean;
  onToggle: () => void;
  onDecision: (goalId: string, decision: QuarterlyReviewDecision) => void;
  onSuggest: () => void;
  onFinish: () => void;
}) {
  return (
    <section className="term-section">
      <h2 className="term-section-title is-cyan">quarterly review</h2>
      <p className="term-comment is-nested">
        {snapshot.due
          ? `// due · ${snapshot.daysSinceLastReview}d since last review`
          : `// next ${snapshot.nextReviewLabel}`}
      </p>
      <button type="button" className="term-token is-action" onClick={onToggle}>
        {expanded ? '[collapse review]' : '[open review]'}
      </button>
      {expanded && (
        <>
          <TrajectorySummary snapshot={snapshot} theme="terminal" />
          <IdentityVotes snapshot={snapshot} theme="terminal" />
          <p className="term-comment">{'// keep · change · drop each habit'}</p>
          <HabitReviewRows items={snapshot.habits} decisions={decisions} theme="terminal" onDecision={onDecision} />
          {snapshot.breakHabits.length > 0 && (
            <>
              <p className="term-comment">{'// break / replace habits'}</p>
              <HabitReviewRows items={snapshot.breakHabits} decisions={decisions} theme="terminal" onDecision={onDecision} />
            </>
          )}
          <div className="term-command-actions">
            <button type="button" className="term-token" onClick={onSuggest}>[suggest all]</button>
            <button type="button" className="term-token is-action" onClick={onFinish}>[finish review]</button>
          </div>
        </>
      )}
    </section>
  );
}

function QuarterlyReviewClay({
  snapshot,
  decisions,
  expanded,
  onToggle,
  onDecision,
  onSuggest,
  onFinish,
}: {
  snapshot: QuarterlyReviewSnapshot;
  decisions: Record<string, QuarterlyReviewDecision>;
  expanded: boolean;
  onToggle: () => void;
  onDecision: (goalId: string, decision: QuarterlyReviewDecision) => void;
  onSuggest: () => void;
  onFinish: () => void;
}) {
  return (
    <section className="clay-card space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-800">Quarterly review</h3>
          <p className="text-[10px] text-slate-600">
            {snapshot.due
              ? `Due now · ${snapshot.daysSinceLastReview} days since last review`
              : `Next review ${snapshot.nextReviewLabel}`}
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-cyan-600 px-3 py-1 text-[10px] font-black text-white"
          onClick={onToggle}
        >
          {expanded ? 'Collapse' : 'Review'}
        </button>
      </div>
      {expanded && (
        <>
          <TrajectorySummary snapshot={snapshot} theme="clay" />
          <IdentityVotes snapshot={snapshot} theme="clay" />
          <p className="text-[10px] font-bold uppercase text-slate-500">Keep · change · drop</p>
          <div className="space-y-2">
            <HabitReviewRows items={snapshot.habits} decisions={decisions} theme="clay" onDecision={onDecision} />
            {snapshot.breakHabits.length > 0 && (
              <>
                <p className="text-[10px] font-bold uppercase text-rose-700">Break / replace habits</p>
                <HabitReviewRows items={snapshot.breakHabits} decisions={decisions} theme="clay" onDecision={onDecision} />
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="flex-1 rounded-xl bg-slate-200 py-2 text-xs font-bold text-slate-700" onClick={onSuggest}>
              Suggest all
            </button>
            <button type="button" className="flex-1 rounded-xl bg-cyan-600 py-2 text-xs font-black text-white" onClick={onFinish}>
              Finish review
            </button>
          </div>
        </>
      )}
    </section>
  );
}
