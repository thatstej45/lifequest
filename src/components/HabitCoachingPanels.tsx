import type { Goal, ScorecardRating, UserStats } from '../types';
import { SCORECARD_RATINGS, convertMinusHabits, scorecardSummary } from '../habits/scorecard';
import type { GoldilocksSuggestion } from '../habits/goldilocks';

interface ScorecardPanelProps {
  goals: Goal[];
  identityStatements?: string[];
  theme?: 'clay' | 'terminal';
  onRate: (goalId: string, rating: ScorecardRating | undefined) => void;
  onConvertMinus: (created: Goal[]) => void;
  onReviewed?: () => void;
}

export function ScorecardPanel({
  goals,
  identityStatements = [],
  theme = 'clay',
  onRate,
  onConvertMinus,
  onReviewed,
}: ScorecardPanelProps) {
  const summary = scorecardSummary(goals);
  const minusCount = goals.filter(goal => goal.scorecardRating === '-').length;

  if (theme === 'terminal') {
    return (
      <section className="term-section">
        <h2 className="term-section-title is-amber">habits scorecard</h2>
        <p className="term-comment is-nested">{`// +${summary.plus} · −${summary.minus} · =${summary.neutral} · unrated ${summary.unrated}`}</p>
        {goals.map(goal => (
          <div className="term-bar-row" key={goal.id}>
            <span className="term-bar-label">{goal.title.toLowerCase()}</span>
            <span className="term-window-row">
              {SCORECARD_RATINGS.map(rating => (
                <button
                  type="button"
                  key={rating}
                  className={`term-token${goal.scorecardRating === rating ? ' is-active' : ''}`}
                  onClick={() => onRate(goal.id, goal.scorecardRating === rating ? undefined : rating)}
                >
                  {`[${rating}]`}
                </button>
              ))}
            </span>
            {goal.identityStatementIndex != null && identityStatements[goal.identityStatementIndex] && (
              <span className="term-comment is-nested">{`// ${identityStatements[goal.identityStatementIndex]}`}</span>
            )}
          </div>
        ))}
        {minusCount > 0 && (
          <button
            type="button"
            className="term-token is-action"
            onClick={() => {
              onConvertMinus(convertMinusHabits(goals));
              onReviewed?.();
            }}
          >
            {`[convert ${minusCount} minus → quests]`}
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="clay-card space-y-3 p-4">
      <div>
        <h3 className="text-sm font-black text-slate-800">Habits scorecard</h3>
        <p className="text-[10px] text-slate-500">
          Rate behaviors + / − / = against your identity · {summary.plus}+ · {summary.minus}− · {summary.neutral}=
        </p>
      </div>
      {goals.map(goal => (
        <div key={goal.id} className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 first:border-t-0">
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">{goal.title}</span>
          <div className="flex gap-1">
            {SCORECARD_RATINGS.map(rating => (
              <button
                type="button"
                key={rating}
                className={`rounded-lg px-2 py-1 text-xs font-black ${goal.scorecardRating === rating ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                onClick={() => onRate(goal.id, goal.scorecardRating === rating ? undefined : rating)}
              >
                {rating}
              </button>
            ))}
          </div>
        </div>
      ))}
      {minusCount > 0 && (
        <button
          type="button"
          className="w-full rounded-xl bg-amber-600 py-2 text-xs font-black text-white"
          onClick={() => {
            onConvertMinus(convertMinusHabits(goals));
            onReviewed?.();
          }}
        >
          Convert {minusCount} minus habit{minusCount === 1 ? '' : 's'} into quests
        </button>
      )}
    </section>
  );
}

interface GoldilocksBannerProps {
  suggestions: GoldilocksSuggestion[];
  theme?: 'clay' | 'terminal';
  mentorLine?: string;
  onApply: (goalId: string, kind: GoldilocksSuggestion['kind']) => void;
  onDismiss: (goalId: string) => void;
}

export function GoldilocksBanner({
  suggestions,
  theme = 'clay',
  mentorLine,
  onApply,
  onDismiss,
}: GoldilocksBannerProps) {
  if (suggestions.length === 0) return null;

  if (theme === 'terminal') {
    return (
      <section className="term-section">
        <h2 className="term-section-title is-purple">goldilocks</h2>
        {mentorLine && <p className="term-comment">{`// ${mentorLine}`}</p>}
        {suggestions.map(item => (
          <div className="term-stat-card" key={item.goalId}>
            <p className="term-stat-line">
              <span className="term-stat-label">{item.title}</span>
              <span className="term-stat-value">{`${Math.round(item.ratio * 100)}% / ${item.windowDays}d`}</span>
            </p>
            <p className="term-comment is-nested">{`// ${item.suggestion}`}</p>
            <div className="term-command-actions">
              <button type="button" className="term-token is-action" onClick={() => onApply(item.goalId, item.kind)}>
                {item.kind === 'easier' ? '[apply easier]' : '[apply harder]'}
              </button>
              <button type="button" className="term-token" onClick={() => onDismiss(item.goalId)}>[dismiss]</button>
            </div>
          </div>
        ))}
      </section>
    );
  }

  return (
    <div className="clay-card space-y-3 p-4">
      <h3 className="text-sm font-black text-slate-800">Goldilocks check</h3>
      {mentorLine && <p className="text-[10px] italic text-slate-500">{mentorLine}</p>}
      {suggestions.map(item => (
        <div key={item.goalId} className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs">
          <p className="font-bold text-slate-800">{item.title} · {Math.round(item.ratio * 100)}% ({item.windowDays}d)</p>
          <p className="text-slate-600">{item.suggestion}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="rounded-lg bg-violet-600 px-2 py-1 font-black text-white" onClick={() => onApply(item.goalId, item.kind)}>
              Apply
            </button>
            <button type="button" className="rounded-lg bg-slate-200 px-2 py-1 font-bold text-slate-600" onClick={() => onDismiss(item.goalId)}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export type { UserStats };
