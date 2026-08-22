import { Goal, QuestDifficulty, Skill } from './types';

export const PROGRESSION_VERSION = 2;
export const QUEST_DIFFICULTIES: QuestDifficulty[] = ['trivial', 'easy', 'medium', 'hard'];

const DIFFICULTY_MULTIPLIER: Record<QuestDifficulty, number> = {
  trivial: 0.25,
  easy: 1,
  medium: 1.5,
  hard: 2,
};

const roundToTen = (value: number) => Math.round(value / 10) * 10;

/** Habitica's level threshold curve. */
export const xpRequiredForLevel = (level: number) => {
  const safeLevel = Math.max(1, Math.floor(level));
  if (safeLevel <= 4) return 25 * safeLevel;
  return roundToTen(0.25 * safeLevel ** 2 + 10 * safeLevel + 139.75);
};

export const questCadenceMultiplier = (goal: Pick<Goal, 'repeatType' | 'isRepeatable'>) => {
  if (goal.repeatType === 'weekly') return 2;
  if (goal.repeatType === 'daily' || goal.isRepeatable) return 1;
  return 3;
};

export const streakMultiplier = (streak: number) => {
  if (streak >= 90) return 1.5;
  if (streak >= 60) return 1.4;
  if (streak >= 30) return 1.3;
  if (streak >= 21) return 1.2;
  if (streak >= 7) return 1.1;
  return 1;
};

export const questBaseReward = (
  difficulty: QuestDifficulty,
  goal: Pick<Goal, 'repeatType' | 'isRepeatable'>,
) => Math.max(1, Math.round(10 * DIFFICULTY_MULTIPLIER[difficulty] * questCadenceMultiplier(goal)));

export const calculateQuestReward = (
  goal: Pick<Goal, 'difficulty' | 'repeatType' | 'isRepeatable'>,
  streak = 0,
  specialization?: Skill['specialization'],
) => {
  const specializationMultiplier = specialization === 'Master' ? 1.5 : specialization === 'Expert' ? 1.2 : 1;
  return Math.round(
    questBaseReward(goal.difficulty ?? 'easy', goal) *
      streakMultiplier(streak) *
      specializationMultiplier,
  );
};

export const inferDifficulty = (legacyReward: number): QuestDifficulty => {
  if (legacyReward <= 15) return 'trivial';
  if (legacyReward <= 50) return 'easy';
  if (legacyReward <= 100) return 'medium';
  return 'hard';
};

export interface LevelProgress {
  level: number;
  xp: number;
  maxXp: number;
  levelsChanged: number;
}

export const applyXp = (level: number, xp: number, amount: number): LevelProgress => {
  let nextLevel = Math.max(1, Math.floor(level));
  let nextXp = xp + amount;
  const initialLevel = nextLevel;

  while (nextXp >= xpRequiredForLevel(nextLevel)) {
    nextXp -= xpRequiredForLevel(nextLevel);
    nextLevel += 1;
  }

  while (nextXp < 0 && nextLevel > 1) {
    nextLevel -= 1;
    nextXp += xpRequiredForLevel(nextLevel);
  }

  if (nextXp < 0) nextXp = 0;

  return {
    level: nextLevel,
    xp: Math.round(nextXp),
    maxXp: xpRequiredForLevel(nextLevel),
    levelsChanged: nextLevel - initialLevel,
  };
};

export const migrateLevelProgress = (level: number, xp: number, oldMaxXp: number): LevelProgress => {
  const safeLevel = Math.max(1, Math.floor(level));
  const nextMax = xpRequiredForLevel(safeLevel);
  const ratio = oldMaxXp > 0 ? Math.min(1, Math.max(0, xp / oldMaxXp)) : 0;
  return {
    level: safeLevel,
    xp: Math.round(nextMax * ratio),
    maxXp: nextMax,
    levelsChanged: 0,
  };
};
