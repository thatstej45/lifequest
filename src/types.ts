export type CategoryId = string;
export type QuestDifficulty = 'trivial' | 'easy' | 'medium' | 'hard';
export type TrackingMode = 'checkbox' | 'counter' | 'numeric' | 'timer' | 'health';
export type PauseMode = 'none' | 'vacation' | 'sick';
export type AppearanceDensity = 'compact' | 'cozy' | 'relaxed';
export type ScorecardRating = '+' | '-' | '=';
export type HabitKind = 'build' | 'break' | 'replace';
export type MentorPersonality = 'Supportive' | 'Snarky' | 'Stoic';
export type QuarterlyReviewDecision = 'keep' | 'change' | 'drop';

/** Inversion of the 4 laws for break-habit mode (make it invisible / unattractive / difficult / unsatisfying). */
export interface BreakInversions {
  invisible?: string;
  unattractive?: string;
  difficult?: string;
  unsatisfying?: string;
}

export interface Perk {
  level: number;
  description: string;
  isUnlocked?: boolean;
}

export interface Skill {
  id: string;
  name: string;
  icon?: string;
  level: number;
  xp: number;
  maxXp: number;
  description: string;
  xpReward: number;
  prerequisites?: string[];
  specialization?: 'Expert' | 'Master';
  isUnlocked: boolean;
  spCost: number;
  perks?: Perk[];
}

export interface Category {
  id: CategoryId;
  name: string;
  icon: string;
  color: string;
  skills: Skill[];
}

export interface UserStats {
  level: number;
  xp: number;
  maxXp: number;
  consistency: number;
  maxConsistency: number;
  stamina: number;
  maxStamina: number;
  streak: number;
  lastLoginDate: string;
  xpMultiplier: number;
  skillPoints: number;
  name?: string;
  title?: string;
  mentorPersonality?: MentorPersonality;
  notificationSound?: string;
  progressionVersion?: number;
  habitDataVersion?: number;
  dailyGoalTarget?: number;
  streakShields?: number;
  shieldProgress?: number;
  lastDailyGoalDate?: string;
  pauseMode?: PauseMode;
  pauseUntil?: string;
  appearanceDensity?: AppearanceDensity;
  /** 1–3 identity statements the user is building evidence for. */
  identityStatements?: string[];
  /** Habits completed on the day after a scheduled miss (never-miss-twice). */
  recoveryDaysCompleted?: number;
  /** Days where at least one habit entered recovery (missed prior scheduled day). */
  recoveryAttempts?: number;
  /** ISO timestamp of last habits scorecard review. */
  scorecardReviewedAt?: string;
  /** ISO timestamp of last quarterly identity/habit review. */
  lastQuarterlyReviewAt?: string;
  /** Per-habit quarterly review decisions keyed by goal id. */
  quarterlyReviewDecisions?: Record<string, QuarterlyReviewDecision>;
  /** Optional accountability partner name or handle. */
  accountabilityPartner?: string;
  /** Public commitment statement shared with partner. */
  accountabilityCommitment?: string;
}

export interface Goal {
  id: string;
  skillId: string;
  title: string;
  completed: boolean;
  xpReward: number;
  difficulty?: QuestDifficulty;
  requiredSpecialization?: 'Expert' | 'Master';
  achieveGuide?: string;
  isRepeatable?: boolean;
  repeatType?: 'none' | 'daily' | 'weekly';
  repeatDays?: number[]; // 0-6 for Sun-Sat (0 = Sunday, 1 = Monday, etc.)
  lastCompletedAt?: string;
  streak?: number;
  appliedXp?: number;
  reminderTimes?: string[]; // Array of "HH:mm"
  reminderFrequency?: 'once' | 'multiple';
  icon?: string;
  note?: string;
  trackingMode?: TrackingMode;
  targetValue?: number;
  unit?: string;
  routineId?: string;
  sortOrder?: number;
  /** Index into UserStats.identityStatements (0–2). */
  identityStatementIndex?: number;
  /** Cue location for implementation intention sentence. */
  cueLocation?: string;
  /** Within the same routine, start after this habit completes. */
  stackAfterGoalId?: string;
  /** Starter/minimum target for two-minute mode (counter/numeric/timer). */
  twoMinuteTarget?: number;
  /** Scorecard alignment: vote for (+), against (−), or neutral (=) identity. */
  scorecardRating?: ScorecardRating;
  habitKind?: HabitKind;
  /** For replace habits: the build habit that replaces this behavior. */
  replacementGoalId?: string;
  /** Temptation bundle reward after completing this needed habit. */
  bundleReward?: string;
  /** Honor-system amount logged to finance when skipping instead of earning the bundle. */
  bundleSkipSaveAmount?: number;
  /** Cannot mark complete before this local time (HH:mm). */
  earliestCompleteTime?: string;
  /** Opt-in XP loss when two scheduled days are missed in a row. */
  consecutiveMissPenaltyXp?: number;
  /** ISO date when user last dismissed a Goldilocks suggestion for this habit. */
  goldilocksDismissedAt?: string;
  /** 4-law inversions for break / replace habits. */
  breakInversions?: BreakInversions;
}

export interface Routine {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  sortOrder: number;
}

export interface GoalDailyProgress {
  id: string;
  goalId: string;
  date: string;
  value: number;
  elapsedSeconds: number;
  timerStartedAt?: string;
  completed: boolean;
  appliedXp?: number;
  completedAt?: string;
  historyEntryId?: string;
  /** Logged via two-minute rule without reaching full target. */
  twoMinuteLogged?: boolean;
  completionMode?: 'full' | 'twoMinute';
}

export interface CategoryConsistency {
  categoryId: string;
  name: string;
  consistency: number;
  maxConsistency: number;
}

export interface HistoryRecord {
  date: string;
  completedCount: number;
  totalCount: number;
  goalMet?: boolean;
  shieldUsed?: boolean;
  paused?: boolean;
  /** User completed at least one habit in never-miss-twice recovery this day. */
  recoveryDay?: boolean;
}

export interface CompletedQuest {
  id: string; // unique ID for the history record
  goalId: string;
  title: string;
  skillId: string;
  xpEarned: number;
  completedAt: string; // ISO timestamp
  scheduledTime?: string; // Original scheduled time (optional)
}

export interface FinanceIncome {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // Net amount received
  sourceCategory: string; // e.g., "Salary", "Freelance", "Shift Allowance", etc.
  accountType: 'bank' | 'cash';
  bankAccountId?: string;
  note?: string;
  // Salary specific deductions
  isSalary?: boolean;
  taxAmount?: number;
  deductions?: Array<{ name: string; amount: number }>;
  // Shift allowance specific fields
  isShiftAllowance?: boolean;
  shiftPerDay?: number;
  expectedShiftDays?: number;
  actualShiftDays?: number;
}

export interface FinanceExpense {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  category: string; // Over 50 categories
  accountType: 'bank' | 'cash' | 'credit_card';
  bankAccountId?: string;
  creditCardId?: string; // ID if paid using credit card
  note?: string;
  classification?: 'basic' | 'wants' | 'savings' | 'investments' | 'family' | 'extra';
}

export interface FinanceInvestment {
  id: string;
  date: string;
  amount: number;
  type: 'Stocks' | 'Mutual Funds' | 'EPF';
  bankAccountId?: string;
  note?: string;
}

export interface FinanceLending {
  id: string;
  personName: string;
  amount: number;
  dateGiven: string; // YYYY-MM-DD
  returnedStatus: 'Pending' | 'Returned';
  returnedDate?: string;
  accountType: 'bank' | 'cash';
  bankAccountId?: string;
}

export interface FinanceInsurance {
  id: string;
  name: string;
  premium: number;
  term: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  active: boolean;
}

export interface FinanceAsset {
  id: string;
  name: string;
  type: 'Bike' | 'Car' | 'Other';
  price: number; // Current market price/valuation
}

export interface FinanceTransfer {
  id: string;
  date: string;
  amount: number;
  fromAccount: 'bank' | 'cash' | string;
  toAccount: 'bank' | 'cash' | string;
  note?: string;
}

export interface FinanceCreditCard {
  id: string;
  title: string;
  cardLimit: number;
  balance: number;
}

