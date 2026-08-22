import { Category } from "./types";

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'physical',
    name: 'Physical',
    icon: 'Activity',
    color: '#22c55e', // green-500
    skills: [
      { id: 'gym', name: 'Gym/Strength', level: 1, xp: 0, maxXp: 100, description: 'Building muscle and strength.', xpReward: 50, isUnlocked: true, spCost: 0, perks: [{ level: 2, description: "+5% XP Bonus" }, { level: 5, description: "Expert Unlock" }, { level: 10, description: "Master Unlock" }] },
      { id: 'cardio', name: 'Walk/Run', level: 1, xp: 0, maxXp: 100, description: 'Improving cardiovascular fitness.', xpReward: 40, isUnlocked: false, spCost: 1, prerequisites: ['gym'], perks: [{ level: 3, description: "+10% XP Bonus" }, { level: 7, description: "Expert Unlock" }] },
      { id: 'posture', name: 'Fixed Posture', level: 1, xp: 0, maxXp: 100, description: 'Maintaining correct standing and sitting posture.', xpReward: 30, isUnlocked: false, spCost: 1, prerequisites: ['cardio'] },
    ]
  },
  {
    id: 'financial',
    name: 'Financial',
    icon: 'Wallet',
    color: '#eab308', // yellow-500
    skills: [
      { id: 'money-mgmt', name: 'Money Management', level: 1, xp: 0, maxXp: 100, description: 'Tracking income and expenses.', xpReward: 60, isUnlocked: true, spCost: 0, perks: [{ level: 3, description: "Budgeting Basics" }, { level: 5, description: "Expense Expert" }] },
      { id: 'investing', name: 'Investing', level: 1, xp: 0, maxXp: 100, description: 'Growing wealth through assets.', xpReward: 100, prerequisites: ['money-mgmt'], isUnlocked: false, spCost: 2 },
      { id: 'income', name: 'Income Streams', level: 1, xp: 0, maxXp: 100, description: 'Developing multiple sources of revenue.', prerequisites: ['investing'], isUnlocked: false, spCost: 3, xpReward: 150 },
    ]
  },
  {
    id: 'social',
    name: 'Social',
    icon: 'Users',
    color: '#3b82f6', // blue-500
    skills: [
      { id: 'friends', name: 'Friends/Networking', level: 1, xp: 0, maxXp: 100, description: 'Building and maintaining relationships.', xpReward: 40, isUnlocked: true, spCost: 0, perks: [{ level: 2, description: "Small Talk Pro" }] },
      { id: 'character-rec', name: 'Character Recognition', level: 1, xp: 0, maxXp: 100, description: 'Understanding people and their motives.', xpReward: 50, isUnlocked: false, spCost: 1, prerequisites: ['friends'] },
      { id: 'social-presence', name: 'Social Presence', level: 1, xp: 0, maxXp: 100, description: 'Confidence and respect in social settings.', xpReward: 70, isUnlocked: false, spCost: 2, prerequisites: ['character-rec'] },
    ]
  },
  {
    id: 'mental',
    name: 'Mental',
    icon: 'Brain',
    color: '#a855f7', // purple-500
    skills: [
      { id: 'meditation', name: 'Meditation', level: 1, xp: 0, maxXp: 100, description: 'Calming the mind and reducing stress.', xpReward: 30, isUnlocked: true, spCost: 0, perks: [{ level: 5, description: "Inner Peace" }] },
      { id: 'learning', name: 'Continuous Learning', level: 1, xp: 0, maxXp: 100, description: 'Reading books and gaining knowledge.', xpReward: 50, isUnlocked: false, spCost: 1, prerequisites: ['meditation'] },
      { id: 'focus', name: 'Focused Thinking', level: 1, xp: 0, maxXp: 100, description: 'Deep work and concentration.', xpReward: 60, isUnlocked: false, spCost: 2, prerequisites: ['learning'] },
    ]
  },
  {
    id: 'career',
    name: 'Career',
    icon: 'Briefcase',
    color: '#f97316', // orange-500
    skills: [
      { id: 'education', name: 'Education', level: 1, xp: 0, maxXp: 100, description: 'Formal or self-taught academic progress.', xpReward: 80, isUnlocked: true, spCost: 0 },
      { id: 'dev', name: 'Skill Development', level: 1, xp: 0, maxXp: 100, description: 'Mastering tools and technologies.', xpReward: 90, isUnlocked: false, spCost: 1, prerequisites: ['education'] },
      { id: 'promotion', name: 'Promotion/Growth', level: 1, xp: 0, maxXp: 100, description: 'Advancing in professional hierarchy.', xpReward: 200, isUnlocked: false, spCost: 3, prerequisites: ['dev'] },
    ]
  },
  {
    id: 'personality',
    name: 'Personality',
    icon: 'User',
    color: '#ec4899', // pink-500
    skills: [
      { id: 'talking', name: 'Talking Skills', level: 1, xp: 0, maxXp: 100, description: 'Vocabulary, fluency, and tone.', xpReward: 40, isUnlocked: true, spCost: 0 },
      { id: 'dressing', name: 'Dressing Sense', level: 1, xp: 0, maxXp: 100, description: 'Fashion sense and color combinations.', xpReward: 30, isUnlocked: false, spCost: 1, prerequisites: ['talking'] },
      { id: 'happiness', name: 'Happiness/Mood', level: 1, xp: 0, maxXp: 100, description: 'Maintaining a positive outlook.', xpReward: 20, isUnlocked: false, spCost: 1, prerequisites: ['dressing'] },
    ]
  }
];
