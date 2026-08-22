import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '../db';
import {
  FinanceAsset,
  FinanceCreditCard,
  FinanceExpense,
  FinanceIncome,
  FinanceInsurance,
  FinanceInvestment,
  FinanceLending,
  FinanceTransfer,
} from '../types';

export type FinanceRange = 'today' | 'week' | 'month' | 'year';

export interface BankAccount {
  id: string;
  name: string;
  type: 'savings' | 'salaried' | 'current' | 'other';
  initialBalance: number;
}

const today = () => new Date().toISOString().split('T')[0];

export const isInRange = (dateStr: string, range: FinanceRange) => {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rowDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (range === 'today') return rowDate.getTime() === startOfToday.getTime();
  if (range === 'week') return rowDate >= new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  return date.getFullYear() === now.getFullYear();
};

/**
 * Single source of truth for the finance ledger. Balance maths mirrors the
 * claymorphic tracker so both themes report identical numbers.
 */
export function useFinanceLedger() {
  const [incomes, setIncomes] = useState<FinanceIncome[]>([]);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [investments, setInvestments] = useState<FinanceInvestment[]>([]);
  const [lending, setLending] = useState<FinanceLending[]>([]);
  const [insurances, setInsurances] = useState<FinanceInsurance[]>([]);
  const [assets, setAssets] = useState<FinanceAsset[]>([]);
  const [transfers, setTransfers] = useState<FinanceTransfer[]>([]);
  const [creditCards, setCreditCards] = useState<FinanceCreditCard[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [initialBank, setInitialBank] = useState(0);
  const [initialCash, setInitialCash] = useState(0);
  const [initialEpf, setInitialEpf] = useState(0);
  const [customCategories, setCustomCategories] = useState<
    Array<{ id: string; name: string; type: 'income' | 'expense'; color: string; iconName: string }>
  >([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [inc, exp, inv, len, ins, ast, tfr, cc] = await Promise.all([
      db.financeIncomes.toArray(),
      db.financeExpenses.toArray(),
      db.financeInvestments.toArray(),
      db.financeLending.toArray(),
      db.financeInsurance.toArray(),
      db.financeAssets.toArray(),
      db.financeTransfers.toArray(),
      db.financeCreditCards.toArray(),
    ]);

    const [epfInitial, epfLegacy, bankSetting, cashSetting, banksSetting, catsSetting] = await Promise.all([
      db.settings.get('initial_epf_balance'),
      db.settings.get('epf_balance'),
      db.settings.get('initial_bank_balance'),
      db.settings.get('initial_cash_balance'),
      db.settings.get('custom_bank_accounts'),
      db.settings.get('custom_finance_categories'),
    ]);

    setIncomes(inc);
    setExpenses(exp);
    setInvestments(inv);
    setLending(len);
    setInsurances(ins);
    setAssets(ast);
    setTransfers(tfr);
    setCreditCards(cc);
    setInitialEpf(epfInitial?.value ?? epfLegacy?.value ?? 0);

    const primaryBankValue = bankSetting?.value || 0;
    setInitialBank(primaryBankValue);
    setInitialCash(cashSetting?.value || 0);
    setCustomCategories(catsSetting?.value || []);

    let banks: BankAccount[] = banksSetting?.value || [];
    if (banks.length === 0) {
      banks = [{ id: 'bank_default', name: 'Primary Bank Account', type: 'savings', initialBalance: primaryBankValue }];
      await db.settings.put({ id: 'custom_bank_accounts', value: banks });
    }
    setBankAccounts(banks);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const epfDeductions = useMemo(
    () =>
      incomes.reduce((sum, income) => {
        if (!income.isSalary || !income.deductions) return sum;
        const epf = income.deductions.find(item => item.name === 'EPF');
        return sum + (Number(epf?.amount) || 0);
      }, 0),
    [incomes],
  );

  const epfBalance = initialEpf + epfDeductions * 2;

  const balances = useMemo(() => {
    let cash = initialCash;
    const banks: Record<string, number> = {};
    bankAccounts.forEach(account => {
      banks[account.id] = account.initialBalance;
    });

    const primaryId = bankAccounts[0]?.id || 'bank_default';
    if (banks[primaryId] === undefined) banks[primaryId] = initialBank;

    const applyToBank = (bankId: string | undefined, amount: number) => {
      const target = bankId && banks[bankId] !== undefined ? bankId : primaryId;
      banks[target] += amount;
    };

    incomes.forEach(income => {
      if (income.accountType === 'bank') applyToBank(income.bankAccountId, income.amount);
      else if (income.accountType === 'cash') cash += income.amount;
    });

    expenses.forEach(expense => {
      if (expense.accountType === 'bank') applyToBank(expense.bankAccountId, -expense.amount);
      else if (expense.accountType === 'cash') cash -= expense.amount;
    });

    investments.forEach(investment => {
      if (investment.type !== 'EPF') applyToBank(investment.bankAccountId, -investment.amount);
    });

    transfers.forEach(transfer => {
      if (transfer.fromAccount === 'cash') cash -= transfer.amount;
      else if (transfer.fromAccount === 'bank') applyToBank(primaryId, -transfer.amount);
      else applyToBank(transfer.fromAccount, -transfer.amount);

      if (transfer.toAccount === 'cash') cash += transfer.amount;
      else if (transfer.toAccount === 'bank') applyToBank(primaryId, transfer.amount);
      else applyToBank(transfer.toAccount, transfer.amount);
    });

    lending.forEach(loan => {
      if (loan.returnedStatus !== 'Pending') return;
      if (loan.accountType === 'bank') applyToBank(loan.bankAccountId, -loan.amount);
      else if (loan.accountType === 'cash') cash -= loan.amount;
    });

    return {
      cash,
      banks,
      bank: Object.values(banks).reduce((sum, value) => sum + value, 0),
    };
  }, [incomes, expenses, investments, transfers, lending, bankAccounts, initialBank, initialCash]);

  const debt = useMemo(() => creditCards.reduce((sum, card) => sum + (card.balance || 0), 0), [creditCards]);

  const investedTotal = useMemo(
    () => investments.filter(item => item.type !== 'EPF').reduce((sum, item) => sum + item.amount, 0) + epfBalance,
    [investments, epfBalance],
  );

  const assetsTotal = useMemo(() => assets.reduce((sum, asset) => sum + asset.price, 0), [assets]);

  const lendingPending = useMemo(
    () => lending.filter(loan => loan.returnedStatus === 'Pending').reduce((sum, loan) => sum + loan.amount, 0),
    [lending],
  );

  const netWorth = balances.bank + balances.cash + investedTotal + assetsTotal + lendingPending - debt;

  const rangeStats = useCallback(
    (range: FinanceRange) => {
      const rangeIncomes = incomes.filter(item => isInRange(item.date, range));
      const rangeExpenses = expenses.filter(item => isInRange(item.date, range));
      const rangeInvestments = investments.filter(item => isInRange(item.date, range));

      const income = rangeIncomes.reduce((sum, item) => sum + item.amount, 0);
      const expense = rangeExpenses.reduce((sum, item) => sum + item.amount, 0);
      const invested = rangeInvestments.reduce((sum, item) => sum + item.amount, 0);
      const deductions = rangeIncomes.reduce((sum, item) => {
        if (!item.isSalary) return sum;
        return sum + (item.deductions?.reduce((acc, entry) => acc + (Number(entry.amount) || 0), 0) ?? 0);
      }, 0);

      return {
        income,
        expense,
        invested,
        cashFlow: income - expense - invested,
        gross: income + deductions,
        tax: rangeIncomes.reduce((sum, item) => sum + (item.taxAmount || 0), 0),
        counts: { income: rangeIncomes.length, expense: rangeExpenses.length, invested: rangeInvestments.length },
      };
    },
    [incomes, expenses, investments],
  );

  const mutate = useCallback(
    async (operation: () => Promise<unknown>) => {
      await operation();
      await reload();
    },
    [reload],
  );

  const addIncome = (payload: Omit<FinanceIncome, 'id' | 'date'> & { id?: string; date?: string }) =>
    mutate(async () => {
      const record: FinanceIncome = { ...payload, id: payload.id ?? crypto.randomUUID(), date: payload.date ?? today() };
      await db.financeIncomes.put(record);

      // Salary EPF deductions double as an EPF investment entry, matching the tracker.
      const epf = record.isSalary ? record.deductions?.find(item => item.name === 'EPF')?.amount ?? 0 : 0;
      if (epf > 0) {
        const existing = await db.financeInvestments
          .filter(item => item.date === record.date && item.note === 'Auto salary deduction contribution')
          .first();
        if (existing) await db.financeInvestments.update(existing.id, { amount: epf });
        else {
          await db.financeInvestments.add({
            id: crypto.randomUUID(),
            date: record.date,
            amount: epf,
            type: 'EPF',
            note: 'Auto salary deduction contribution',
          });
        }
      }
    });

  const addExpense = (payload: Omit<FinanceExpense, 'id' | 'date'> & { id?: string; date?: string }) =>
    mutate(async () => {
      const record: FinanceExpense = { ...payload, id: payload.id ?? crypto.randomUUID(), date: payload.date ?? today() };
      const previous = payload.id ? await db.financeExpenses.get(payload.id) : undefined;

      if (previous?.accountType === 'credit_card' && previous.creditCardId) {
        const card = await db.financeCreditCards.get(previous.creditCardId);
        if (card) {
          await db.financeCreditCards.update(card.id, { balance: Math.max(0, (card.balance || 0) - previous.amount) });
        }
      }
      if (record.accountType === 'credit_card' && record.creditCardId) {
        const card = await db.financeCreditCards.get(record.creditCardId);
        if (card) await db.financeCreditCards.update(card.id, { balance: (card.balance || 0) + record.amount });
      }
      await db.financeExpenses.put(record);
    });

  const deleteIncome = (id: string) => mutate(() => db.financeIncomes.delete(id));

  const deleteExpense = (id: string) =>
    mutate(async () => {
      const record = await db.financeExpenses.get(id);
      if (record?.accountType === 'credit_card' && record.creditCardId) {
        const card = await db.financeCreditCards.get(record.creditCardId);
        if (card) {
          await db.financeCreditCards.update(card.id, { balance: Math.max(0, (card.balance || 0) - record.amount) });
        }
      }
      await db.financeExpenses.delete(id);
    });

  const addTransfer = (amount: number, fromAccount: string, toAccount: string, note?: string) =>
    mutate(() =>
      db.financeTransfers.add({ id: crypto.randomUUID(), date: today(), amount, fromAccount, toAccount, note }),
    );

  const deleteTransfer = (id: string) => mutate(() => db.financeTransfers.delete(id));

  const addInvestment = (amount: number, type: FinanceInvestment['type'], bankAccountId?: string, note?: string) =>
    mutate(() => db.financeInvestments.add({ id: crypto.randomUUID(), date: today(), amount, type, bankAccountId, note }));

  const deleteInvestment = (id: string) => mutate(() => db.financeInvestments.delete(id));

  const addCreditCard = (title: string, cardLimit: number, balance: number) =>
    mutate(() => db.financeCreditCards.add({ id: crypto.randomUUID(), title, cardLimit, balance }));

  const deleteCreditCard = (id: string) => mutate(() => db.financeCreditCards.delete(id));

  const payCreditCard = (cardId: string, amount: number, source: 'bank' | 'cash', bankAccountId?: string) =>
    mutate(async () => {
      const card = await db.financeCreditCards.get(cardId);
      if (!card) return;
      await db.financeCreditCards.update(cardId, { balance: Math.max(0, (card.balance || 0) - amount) });
      await db.financeExpenses.add({
        id: crypto.randomUUID(),
        date: today(),
        amount,
        category: 'loan_emi',
        accountType: source,
        bankAccountId: source === 'bank' ? bankAccountId : undefined,
        note: `CC Bill Payment: ${card.title}`,
      });
    });

  const addLending = (personName: string, amount: number, accountType: 'bank' | 'cash', bankAccountId?: string) =>
    mutate(() =>
      db.financeLending.add({
        id: crypto.randomUUID(),
        personName,
        amount,
        dateGiven: today(),
        returnedStatus: 'Pending',
        accountType,
        bankAccountId: accountType === 'bank' ? bankAccountId : undefined,
      }),
    );

  const toggleLendingReturned = (loan: FinanceLending) =>
    mutate(async () => {
      const nextStatus = loan.returnedStatus === 'Pending' ? 'Returned' : 'Pending';
      const returnedDate = nextStatus === 'Returned' ? today() : undefined;
      await db.financeLending.update(loan.id, { returnedStatus: nextStatus, returnedDate });

      if (nextStatus === 'Returned') {
        await db.financeIncomes.add({
          id: crypto.randomUUID(),
          date: returnedDate!,
          amount: loan.amount,
          sourceCategory: 'lending_return',
          accountType: loan.accountType,
          bankAccountId: loan.accountType === 'bank' ? loan.bankAccountId : undefined,
          note: `Payment returned by ${loan.personName}`,
        });
      }
    });

  const deleteLending = (id: string) => mutate(() => db.financeLending.delete(id));

  const addAsset = (name: string, type: FinanceAsset['type'], price: number) =>
    mutate(() => db.financeAssets.add({ id: crypto.randomUUID(), name, type, price }));

  const deleteAsset = (id: string) => mutate(() => db.financeAssets.delete(id));

  const addInsurance = (name: string, premium: number, term: FinanceInsurance['term']) =>
    mutate(() => db.financeInsurance.add({ id: crypto.randomUUID(), name, premium, term, active: true }));

  const deleteInsurance = (id: string) => mutate(() => db.financeInsurance.delete(id));

  const setOpeningBalance = (account: 'bank' | 'cash', value: number) =>
    mutate(async () => {
      if (account === 'cash') {
        await db.settings.put({ id: 'initial_cash_balance', value });
        return;
      }
      await db.settings.put({ id: 'initial_bank_balance', value });
      if (bankAccounts.length > 0) {
        const updated = bankAccounts.map((entry, index) => (index === 0 ? { ...entry, initialBalance: value } : entry));
        await db.settings.put({ id: 'custom_bank_accounts', value: updated });
      }
    });

  const setEpfOpeningBalance = (value: number) =>
    mutate(async () => {
      await db.settings.put({ id: 'initial_epf_balance', value });
      await db.settings.put({ id: 'epf_balance', value: value + epfDeductions * 2 });
    });

  const saveBankAccounts = (accounts: BankAccount[]) =>
    mutate(() => db.settings.put({ id: 'custom_bank_accounts', value: accounts }));

  return {
    isLoaded,
    incomes,
    expenses,
    investments,
    lending,
    insurances,
    assets,
    transfers,
    creditCards,
    bankAccounts,
    customCategories,
    initialBank,
    initialCash,
    initialEpf,
    epfBalance,
    epfDeductions,
    balances,
    debt,
    investedTotal,
    assetsTotal,
    lendingPending,
    netWorth,
    rangeStats,
    reload,
    addIncome,
    addExpense,
    deleteIncome,
    deleteExpense,
    addTransfer,
    deleteTransfer,
    addInvestment,
    deleteInvestment,
    addCreditCard,
    deleteCreditCard,
    payCreditCard,
    addLending,
    toggleLendingReturned,
    deleteLending,
    addAsset,
    deleteAsset,
    addInsurance,
    deleteInsurance,
    setOpeningBalance,
    setEpfOpeningBalance,
    saveBankAccounts,
  };
}
