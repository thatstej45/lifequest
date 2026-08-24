import { trajectorySnapshot, recoveryRate } from '../analytics/trajectory';
import { isNativeApp } from '../platform';
import type { Goal, HistoryRecord, UserStats } from '../types';
import { dailyGoalSummary, dateKey } from './habitDomain';

export interface ShareCard {
  title: string;
  text: string;
  url?: string;
}

export type ShareResult = 'shared' | 'copied' | 'unsupported';

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://lifequest.app';

export const buildProgressShareCard = (
  userStats: UserStats,
  goals: Goal[],
  history: HistoryRecord[],
  progressCount = 0,
): ShareCard => {
  const trajectory = trajectorySnapshot(history);
  const daily = dailyGoalSummary(goals, [], userStats.dailyGoalTarget ?? 60);
  const name = userStats.name?.trim() || 'LifeQuest player';
  const streak = userStats.streak ?? 0;
  const recovery = Math.round(recoveryRate(userStats.recoveryDaysCompleted, userStats.recoveryAttempts) * 100);

  const lines = [
    `${name} · LifeQuest progress`,
    `Level ${userStats.level} · ${streak}-day streak`,
    `Today: ${daily.percent}% daily goal`,
    `7d: ${Math.round((trajectory.windows[0]?.ratio ?? 0) * 100)}% · 30d: ${Math.round((trajectory.windows[2]?.ratio ?? 0) * 100)}%`,
    `Recovery rate: ${recovery}%`,
  ];

  if (userStats.identityStatements?.length) {
    lines.push(`Identity: ${userStats.identityStatements.slice(0, 2).join(' · ')}`);
  }

  if (progressCount > 0) {
    lines.push(`${progressCount} habits tracked`);
  }

  lines.push('', 'Built with LifeQuest — daily votes for who I am becoming.');

  return {
    title: `${name}'s LifeQuest progress`,
    text: lines.join('\n'),
    url: APP_URL,
  };
};

export const buildCommitmentShareCard = (
  userStats: UserStats,
  commitment: string,
  partner?: string,
): ShareCard => {
  const name = userStats.name?.trim() || 'LifeQuest player';
  const partnerLine = partner?.trim()
    ? `Accountability partner: ${partner.trim()}`
    : 'Sharing this commitment publicly.';

  const text = [
    `${name}'s commitment`,
    '',
    commitment.trim(),
    '',
    partnerLine,
    `Starting ${dateKey()}`,
    '',
    'Hold me to this — I am building systems, not chasing perfection.',
    APP_URL,
  ].join('\n');

  return {
    title: `${name}'s habit commitment`,
    text,
    url: APP_URL,
  };
};

const copyToClipboard = async (text: string) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
};

/** Share via Web Share API, Capacitor Share on native, or clipboard fallback. */
export const shareCard = async (card: ShareCard): Promise<ShareResult> => {
  const payload = card.url ? `${card.text}\n\n${card.url}` : card.text;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: card.title,
        text: card.text,
        url: card.url,
      });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'unsupported';
      }
    }
  }

  if (isNativeApp) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: card.title,
        text: payload,
        url: card.url,
        dialogTitle: 'Share progress',
      });
      return 'shared';
    } catch {
      // fall through to clipboard
    }
  }

  const copied = await copyToClipboard(payload);
  return copied ? 'copied' : 'unsupported';
};

export const exportShareCardAsText = (card: ShareCard) =>
  card.url ? `${card.text}\n\n${card.url}` : card.text;
