import type { MentorPersonality } from '../types';

type MentorContext = 'recovery' | 'twoMinute' | 'vagueHabit' | 'plateauEasy' | 'plateauHard' | 'bundleUnlocked' | 'commitmentBlocked' | 'missPenalty';

const COPY: Record<MentorContext, Record<MentorPersonality, (habit: string) => string>> = {
  recovery: {
    Supportive: habit => `Yesterday slipped on “${habit}”—today is your comeback day. One small win counts.`,
    Sarcastic: habit => `So “${habit}” ghosted you yesterday. Show up today before it becomes a trend.`,
    Stoic: habit => `“${habit}” was missed. Act today; do not negotiate with yesterday.`,
  },
  twoMinute: {
    Supportive: habit => `Two minutes on “${habit}” still moves you forward. Start tiny, finish proud.`,
    Sarcastic: habit => `Fine. Two minutes of “${habit}”. Try not to sprain something.`,
    Stoic: habit => `Log two minutes on “${habit}”. Imperfect action beats perfect avoidance.`,
  },
  vagueHabit: {
    Supportive: habit => `“${habit}” needs a clearer cue—add when/where so future-you knows what to do.`,
    Sarcastic: habit => `“${habit}” is vibes-only. Give it a time or place before it evaporates.`,
    Stoic: habit => `Define “${habit}” with a cue. Ambiguity is the enemy of execution.`,
  },
  plateauEasy: {
    Supportive: habit => `“${habit}” looks heavy lately. Want to try an easier or two-minute version?`,
    Sarcastic: habit => `“${habit}” is eating your streak. Maybe shrink it before it shrinks you.`,
    Stoic: habit => `Reduce friction on “${habit}”. Scale down until consistency returns.`,
  },
  plateauHard: {
    Supportive: habit => `“${habit}” looks easy now—ready to nudge the target up a notch?`,
    Sarcastic: habit => `“${habit}” is autopilot. Bump the bar or admit you like coasting.`,
    Stoic: habit => `“${habit}” is mastered at this level. Increase the standard deliberately.`,
  },
  bundleUnlocked: {
    Supportive: habit => `Needed habit done! Enjoy your bundled reward—you earned it.`,
    Sarcastic: habit => `Fine, you did “${habit}”. Go collect your prize before you regress.`,
    Stoic: habit => `“${habit}” complete. Take the bundled reward without guilt, then reset.`,
  },
  commitmentBlocked: {
    Supportive: habit => `“${habit}” unlocks later today—your commitment window hasn't opened yet.`,
    Sarcastic: habit => `Patience. “${habit}” isn't open until your self-imposed curfew ends.`,
    Stoic: habit => `Wait for the allowed window on “${habit}”. Discipline is the point.`,
  },
  missPenalty: {
    Supportive: habit => `Two misses on “${habit}”—small XP cost as your pre-commitment. Reset today.`,
    Sarcastic: habit => `“${habit}” missed twice. You literally asked for this XP haircut.`,
    Stoic: habit => `Consecutive misses on “${habit}”. Accept the penalty and re-engage today.`,
  },
};

export const mentorMessage = (
  context: MentorContext,
  personality: MentorPersonality = 'Supportive',
  habitTitle = 'this habit',
) => COPY[context][personality](habitTitle);
