import Dexie, { type Table } from 'dexie';
import { 
  Category, UserStats, Goal, CategoryConsistency, HistoryRecord, CompletedQuest, Routine, GoalDailyProgress,
  FinanceIncome, FinanceExpense, FinanceInvestment, FinanceLending, FinanceInsurance,
  FinanceAsset, FinanceTransfer, FinanceCreditCard
} from './types';

export class LifeQuestDatabase extends Dexie {
  categories!: Table<Category>;
  userStats!: Table<UserStats & { id: string }>;
  goals!: Table<Goal>;
  categoryConsistencies!: Table<CategoryConsistency>;
  settings!: Table<{ id: string, value: any }>;
  history!: Table<HistoryRecord>;
  questHistory!: Table<CompletedQuest>;
  routines!: Table<Routine>;
  goalDailyProgress!: Table<GoalDailyProgress>;
  financeIncomes!: Table<FinanceIncome>;
  financeExpenses!: Table<FinanceExpense>;
  financeInvestments!: Table<FinanceInvestment>;
  financeLending!: Table<FinanceLending>;
  financeInsurance!: Table<FinanceInsurance>;
  financeAssets!: Table<FinanceAsset>;
  financeTransfers!: Table<FinanceTransfer>;
  financeCreditCards!: Table<FinanceCreditCard>;

  constructor() {
    super('LifeQuestDB');
    this.version(5).stores({
      categories: 'id',
      userStats: 'id',
      goals: 'id, skillId',
      categoryConsistencies: 'categoryId',
      settings: 'id',
      history: 'date',
      questHistory: 'id, goalId, skillId, completedAt',
      financeIncomes: 'id, date, sourceCategory',
      financeExpenses: 'id, date, category',
      financeInvestments: 'id, date, type',
      financeLending: 'id, personName, returnedStatus',
      financeInsurance: 'id',
      financeAssets: 'id',
      financeTransfers: 'id, date',
      financeCreditCards: 'id'
    });
    this.version(6).stores({
      categories: 'id',
      userStats: 'id',
      goals: 'id, skillId, routineId, trackingMode',
      routines: 'id, sortOrder',
      goalDailyProgress: 'id, goalId, date, [goalId+date]',
      categoryConsistencies: 'categoryId',
      settings: 'id',
      history: 'date',
      questHistory: 'id, goalId, skillId, completedAt',
      financeIncomes: 'id, date, sourceCategory',
      financeExpenses: 'id, date, category',
      financeInvestments: 'id, date, type',
      financeLending: 'id, personName, returnedStatus',
      financeInsurance: 'id',
      financeAssets: 'id',
      financeTransfers: 'id, date',
      financeCreditCards: 'id'
    }).upgrade(async transaction => {
      await transaction.table('goals').toCollection().modify(goal => {
        goal.trackingMode ??= 'checkbox';
        goal.targetValue ??= 1;
        goal.unit ??= goal.trackingMode === 'timer' ? 'minutes' : 'times';
        goal.sortOrder ??= 0;
      });
      await transaction.table('userStats').toCollection().modify(stats => {
        stats.habitDataVersion ??= 1;
        stats.dailyGoalTarget ??= 60;
        stats.streakShields ??= 0;
        stats.shieldProgress ??= 0;
        stats.pauseMode ??= 'none';
        stats.appearanceDensity ??= 'cozy';
      });
    });
    this.version(7).stores({
      categories: 'id',
      userStats: 'id',
      goals: 'id, skillId, routineId, trackingMode',
      routines: 'id, sortOrder',
      goalDailyProgress: 'id, goalId, date, [goalId+date]',
      categoryConsistencies: 'categoryId',
      settings: 'id',
      history: 'date',
      questHistory: 'id, goalId, skillId, completedAt',
      financeIncomes: 'id, date, sourceCategory',
      financeExpenses: 'id, date, category',
      financeInvestments: 'id, date, type',
      financeLending: 'id, personName, returnedStatus',
      financeInsurance: 'id',
      financeAssets: 'id',
      financeTransfers: 'id, date',
      financeCreditCards: 'id'
    }).upgrade(async transaction => {
      await transaction.table('userStats').toCollection().modify(stats => {
        stats.identityStatements ??= [];
        stats.recoveryDaysCompleted ??= 0;
        stats.recoveryAttempts ??= 0;
        stats.habitDataVersion = 2;
      });
      await transaction.table('goals').toCollection().modify(goal => {
        if (goal.identityStatementIndex != null && goal.identityStatementIndex > 2) {
          delete goal.identityStatementIndex;
        }
      });
    });
  }
}

export const db = new LifeQuestDatabase();

