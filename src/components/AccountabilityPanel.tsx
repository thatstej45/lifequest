import { useState } from 'react';
import type { Goal, HistoryRecord, UserStats } from '../types';
import {
  buildCommitmentShareCard,
  buildProgressShareCard,
  exportShareCardAsText,
  shareCard,
  type ShareResult,
} from '../habits/accountability';

interface AccountabilityPanelProps {
  userStats: UserStats;
  goals: Goal[];
  history: HistoryRecord[];
  theme?: 'clay' | 'terminal';
  onUpdateSettings: (settings: Partial<UserStats>) => void;
}

export function AccountabilityPanel({
  userStats,
  goals,
  history,
  theme = 'clay',
  onUpdateSettings,
}: AccountabilityPanelProps) {
  const [partner, setPartner] = useState(userStats.accountabilityPartner ?? '');
  const [commitment, setCommitment] = useState(userStats.accountabilityCommitment ?? '');
  const [status, setStatus] = useState<ShareResult | 'idle'>('idle');

  const saveFields = () => {
    onUpdateSettings({
      accountabilityPartner: partner.trim() || undefined,
      accountabilityCommitment: commitment.trim() || undefined,
    });
  };

  const runShare = async (kind: 'progress' | 'commitment') => {
    saveFields();
    const card = kind === 'progress'
      ? buildProgressShareCard(userStats, goals, history, goals.length)
      : buildCommitmentShareCard(
        userStats,
        commitment || 'I will log my habits daily and never miss twice.',
        partner,
      );
    const result = await shareCard(card);
    setStatus(result);
    setTimeout(() => setStatus('idle'), 3000);
  };

  const copyCard = async (kind: 'progress' | 'commitment') => {
    saveFields();
    const card = kind === 'progress'
      ? buildProgressShareCard(userStats, goals, history, goals.length)
      : buildCommitmentShareCard(
        userStats,
        commitment || 'I will log my habits daily and never miss twice.',
        partner,
      );
    const text = exportShareCardAsText(card);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  if (theme === 'terminal') {
    return (
      <section className="term-section">
        <h2 className="term-section-title is-purple">accountability</h2>
        <p className="term-comment is-nested">{'// share progress or a commitment — no backend required'}</p>
        <div className="term-field">
          <label className="term-field-label" htmlFor="term-partner">partner</label>
          <input
            id="term-partner"
            className="term-input"
            value={partner}
            onChange={event => setPartner(event.target.value)}
            placeholder="name or handle"
            onBlur={saveFields}
          />
        </div>
        <div className="term-field">
          <label className="term-field-label" htmlFor="term-commitment">commitment</label>
          <textarea
            id="term-commitment"
            className="term-input"
            rows={3}
            value={commitment}
            onChange={event => setCommitment(event.target.value)}
            placeholder="what you are committing to this quarter"
            onBlur={saveFields}
          />
        </div>
        <div className="term-command-actions">
          <button type="button" className="term-token is-action" onClick={() => runShare('progress')}>[share progress]</button>
          <button type="button" className="term-token is-action" onClick={() => runShare('commitment')}>[share commitment]</button>
          <button type="button" className="term-token" onClick={() => copyCard('progress')}>[copy card]</button>
        </div>
        {status !== 'idle' && (
          <p className="term-comment">
            {status === 'shared' && '// opened share sheet'}
            {status === 'copied' && '// copied to clipboard'}
            {status === 'unsupported' && '// share unavailable — try copy card'}
          </p>
        )}
        <p className="term-comment is-nested">{'// native android uses @capacitor/share when web share is unavailable'}</p>
      </section>
    );
  }

  return (
    <section className="clay-card space-y-3 p-4">
      <div>
        <h3 className="text-sm font-black text-slate-800">Accountability</h3>
        <p className="text-[10px] text-slate-600">Share progress or a commitment via your device share sheet or clipboard.</p>
      </div>
      <label className="block space-y-1">
        <span className="text-[10px] font-bold uppercase text-slate-500">Partner (optional)</span>
        <input
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          value={partner}
          onChange={event => setPartner(event.target.value)}
          placeholder="Friend, coach, or group"
          onBlur={saveFields}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[10px] font-bold uppercase text-slate-500">Commitment</span>
        <textarea
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          rows={3}
          value={commitment}
          onChange={event => setCommitment(event.target.value)}
          placeholder="What are you committing to this quarter?"
          onBlur={saveFields}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="rounded-xl bg-violet-600 py-2 text-xs font-black text-white" onClick={() => runShare('progress')}>
          Share progress
        </button>
        <button type="button" className="rounded-xl bg-indigo-600 py-2 text-xs font-black text-white" onClick={() => runShare('commitment')}>
          Share commitment
        </button>
      </div>
      <button type="button" className="w-full rounded-xl bg-slate-200 py-2 text-xs font-bold text-slate-700" onClick={() => copyCard('progress')}>
        Copy progress card
      </button>
      {status !== 'idle' && (
        <p className="text-[10px] font-medium text-slate-600">
          {status === 'shared' && 'Share sheet opened.'}
          {status === 'copied' && 'Copied to clipboard.'}
          {status === 'unsupported' && 'Share unavailable on this device — use copy instead.'}
        </p>
      )}
    </section>
  );
}
