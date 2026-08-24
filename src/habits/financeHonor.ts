import { db } from '../db';
import type { FinanceExpense } from '../types';
import { dateKey } from './habitDomain';

/** Honor-system skip-and-save log; does not touch bank balances beyond expense ledger. */
export const logSkipAndSave = async (amount: number, habitTitle: string, goalId: string) => {
  if (amount <= 0) return;
  const entry: FinanceExpense = {
    id: `honor-${goalId}-${Date.now()}`,
    date: dateKey(),
    amount,
    category: 'savings',
    accountType: 'cash',
    note: `Skip-and-save (honor): skipped “${habitTitle}” bundle`,
    classification: 'savings',
  };
  await db.financeExpenses.put(entry);
  return entry;
};
