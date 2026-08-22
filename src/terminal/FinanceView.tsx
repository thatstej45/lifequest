import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { db } from '../db';
import { UserStats } from '../types';
import {
  EXPENSE_CATEGORY_META,
  EXPENSE_CLASSIFICATIONS,
  FinanceCategoryMeta,
  INCOME_CATEGORY_META,
  formatRupees,
} from '../finance/categories';
import { FinanceRange, isInRange, useFinanceLedger } from '../finance/useFinanceLedger';
import TerminalCommandPanel from './TerminalCommandPanel';

type Section = 'dashboard' | 'budget' | 'transactions' | 'credit' | 'lending' | 'assets';
type LedgerFilter = 'all' | 'income' | 'expense' | 'transfer' | 'invest';

type ModalState =
  | { kind: 'income'; id?: string }
  | { kind: 'expense'; id?: string }
  | { kind: 'transfer' }
  | { kind: 'invest' }
  | { kind: 'card' }
  | { kind: 'pay'; cardId: string }
  | { kind: 'lend' }
  | { kind: 'asset' }
  | { kind: 'insurance' }
  | { kind: 'opening' }
  | { kind: 'budget' }
  | { kind: 'confirm'; label: string; run: () => void }
  | null;

const SECTIONS: Section[] = ['dashboard', 'budget', 'transactions', 'credit', 'lending', 'assets'];
const RANGES: FinanceRange[] = ['today', 'week', 'month', 'year'];

const BUDGET_GROUPS = [...EXPENSE_CLASSIFICATIONS];

interface FinanceViewProps {
  userStats: UserStats;
}

type LineTone = 'good' | 'bad' | 'plain' | 'cyan' | 'amber' | 'purple' | 'blue';

function Line({ label, value, tone }: { label: string; value: string; tone?: LineTone }) {
  return (
    <p className="term-stat-line">
      <span className="term-stat-label">{label}</span>
      <span className={`term-stat-value${tone && tone !== 'plain' ? ` is-${tone}` : ''}`}>{value}</span>
    </p>
  );
}

function Modal({ command, onClose, children }: { command: string; onClose: () => void; children: ReactNode }) {
  return (
    <TerminalCommandPanel command={command} onCancel={onClose}>
      {children}
    </TerminalCommandPanel>
  );
}

export default function FinanceView({ userStats }: FinanceViewProps) {
  const ledger = useFinanceLedger();
  const [section, setSection] = useState<Section>('dashboard');
  const [range, setRange] = useState<FinanceRange>('month');
  const [filter, setFilter] = useState<LedgerFilter>('all');
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [commandOutput, setCommandOutput] = useState('');
  const [budget, setBudget] = useState<{ income: number; percentages: Record<string, number> }>({
    income: 100000,
    percentages: { basic: 18, wants: 17, savings: 20, investments: 10, family: 30, extra: 5 },
  });

  useEffect(() => {
    (async () => {
      const [income, percentages] = await Promise.all([
        db.settings.get('budget_total_income'),
        db.settings.get('budget_group_percentages'),
      ]);
      setBudget(current => ({
        income: income?.value ?? current.income,
        percentages: percentages?.value ?? current.percentages,
      }));
    })();
  }, []);

  const expenseCategories = useMemo<FinanceCategoryMeta[]>(
    () => [
      ...EXPENSE_CATEGORY_META,
      ...ledger.customCategories.filter(item => item.type === 'expense').map(({ id, name, color }) => ({ id, name, color })),
    ],
    [ledger.customCategories],
  );

  const incomeCategories = useMemo<FinanceCategoryMeta[]>(
    () => [
      ...INCOME_CATEGORY_META,
      ...ledger.customCategories.filter(item => item.type === 'income').map(({ id, name, color }) => ({ id, name, color })),
    ],
    [ledger.customCategories],
  );

  const stats = ledger.rangeStats(range);
  const primaryBankId = ledger.bankAccounts[0]?.id ?? 'bank_default';
  const bankName = (id?: string) => ledger.bankAccounts.find(account => account.id === id)?.name ?? 'bank';

  const openModal = (next: NonNullable<ModalState>, initial: Record<string, string> = {}) => {
    setForm(initial);
    setModal(next);
  };
  const close = () => {
    setModal(null);
    setForm({});
  };
  const field = (key: string, fallback = '') => form[key] ?? fallback;
  const set = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }));
  const amount = (key = 'amount') => parseFloat(field(key)) || 0;

  const parseCashOrBank = (value: string) =>
    value === 'cash'
      ? { accountType: 'cash' as const }
      : { accountType: 'bank' as const, bankAccountId: value.replace('bank:', '') };

  const parseAccount = (value: string) =>
    value.startsWith('cc:')
      ? { accountType: 'credit_card' as const, creditCardId: value.slice(3) }
      : parseCashOrBank(value);

  const confirmDelete = (label: string, run: () => void) => setModal({ kind: 'confirm', label, run });

  const spendByCategory = useMemo(() => {
    const totals = new Map<string, { name: string; color: string; amount: number }>();
    ledger.expenses
      .filter(expense => isInRange(expense.date, range))
      .forEach(expense => {
        const meta = expenseCategories.find(entry => entry.id === expense.category);
        const current = totals.get(expense.category) ?? {
          name: meta?.name ?? expense.category,
          color: meta?.color ?? '#64748b',
          amount: 0,
        };
        current.amount += expense.amount;
        totals.set(expense.category, current);
      });
    return [...totals.values()].sort((a, b) => b.amount - a.amount);
  }, [ledger.expenses, range, expenseCategories]);

  const ledgerRows = useMemo(() => {
    const rows: Array<{
      id: string;
      date: string;
      kind: LedgerFilter;
      label: string;
      color: string;
      amount: number;
      account: string;
      note?: string;
    }> = [];

    ledger.incomes.forEach(income =>
      rows.push({
        id: income.id,
        date: income.date,
        kind: 'income',
        label: incomeCategories.find(entry => entry.id === income.sourceCategory)?.name ?? income.sourceCategory,
        color: incomeCategories.find(entry => entry.id === income.sourceCategory)?.color ?? '#22c55e',
        amount: income.amount,
        account: income.accountType === 'bank' ? bankName(income.bankAccountId ?? primaryBankId) : 'cash',
        note: income.note,
      }),
    );

    ledger.expenses.forEach(expense =>
      rows.push({
        id: expense.id,
        date: expense.date,
        kind: 'expense',
        label: expenseCategories.find(entry => entry.id === expense.category)?.name ?? expense.category,
        color: expenseCategories.find(entry => entry.id === expense.category)?.color ?? '#ef4444',
        amount: -expense.amount,
        account:
          expense.accountType === 'credit_card'
            ? ledger.creditCards.find(card => card.id === expense.creditCardId)?.title ?? 'credit card'
            : expense.accountType === 'bank'
              ? bankName(expense.bankAccountId ?? primaryBankId)
              : 'cash',
        note: expense.note,
      }),
    );

    ledger.transfers.forEach(transfer =>
      rows.push({
        id: transfer.id,
        date: transfer.date,
        kind: 'transfer',
        label: 'self transfer',
        color: '#38bdf8',
        amount: transfer.amount,
        account: `${transfer.fromAccount === 'cash' ? 'cash' : bankName(transfer.fromAccount)} -> ${transfer.toAccount === 'cash' ? 'cash' : bankName(transfer.toAccount)}`,
        note: transfer.note,
      }),
    );

    ledger.investments.forEach(investment =>
      rows.push({
        id: investment.id,
        date: investment.date,
        kind: 'invest',
        label: investment.type.toLowerCase(),
        color: '#eab308',
        amount: -investment.amount,
        account: investment.type === 'EPF' ? 'epf' : bankName(investment.bankAccountId ?? primaryBankId),
        note: investment.note,
      }),
    );

    return rows
      .filter(row => isInRange(row.date, range))
      .filter(row => filter === 'all' || row.kind === filter)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [ledger, range, filter, expenseCategories, incomeCategories, primaryBankId]);

  const budgetRows = useMemo(() => {
    const monthExpenses = ledger.expenses.filter(expense => isInRange(expense.date, 'month'));
    return BUDGET_GROUPS.map(group => {
      const planned = Math.round((budget.income * (budget.percentages[group] ?? 0)) / 100);
      const actual = monthExpenses
        .filter(expense => (expense.classification ?? 'basic') === group)
        .reduce((sum, expense) => sum + expense.amount, 0);
      return { group, planned, actual };
    });
  }, [ledger.expenses, budget]);

  const deleteRow = (row: { id: string; kind: LedgerFilter; label: string }) =>
    confirmDelete(`delete ${row.kind} entry "${row.label}"`, () => {
      if (row.kind === 'income') ledger.deleteIncome(row.id);
      else if (row.kind === 'expense') ledger.deleteExpense(row.id);
      else if (row.kind === 'transfer') ledger.deleteTransfer(row.id);
      else ledger.deleteInvestment(row.id);
    });

  const submit = (event: FormEvent, run: () => void) => {
    event.preventDefault();
    const command = modal?.kind ?? 'finance';
    run();
    setCommandOutput(`${command} command completed`);
    close();
  };

  if (!ledger.isLoaded) return <p className="term-comment">{'// reading finance ledger...'}</p>;

  return (
    <>
      <p className="term-prompt">
        <span className="term-prompt-user">{`${userStats.name || 'user'}[L${userStats.level}]@lifequest`}</span>
        <span className="term-prompt-symbol">$</span>
        <span className="term-prompt-cmd">{`finance --${section}`}</span>
      </p>
      <p className="term-comment">{`// net worth ${formatRupees(ledger.netWorth)} · ${ledger.incomes.length + ledger.expenses.length} entries logged`}</p>

      <div className="term-subnav" role="tablist" aria-label="Finance sections">
        {SECTIONS.map(entry => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={section === entry}
            className={`term-token${section === entry ? ' is-active' : ''}`}
            onClick={() => setSection(entry)}
          >
            {`[${entry}]`}
          </button>
        ))}
      </div>

      {(section === 'dashboard' || section === 'transactions') && (
        <div className="term-window-row">
          {RANGES.map(entry => (
            <button
              key={entry}
              type="button"
              className={`term-token${range === entry ? ' is-active' : ''}`}
              onClick={() => setRange(entry)}
            >
              {`[${entry}]`}
            </button>
          ))}
        </div>
      )}

      {section === 'dashboard' && (
        <>
          <section className="term-section">
            <h2 className="term-section-title">{`cash flow [${range}]`}</h2>
            <p className="term-comment is-nested">{'// inflow minus outflow and invested capital'}</p>
            <Line label="inflow" value={formatRupees(stats.income)} tone="good" />
            <Line label="outflow" value={formatRupees(stats.expense)} tone="bad" />
            <Line label="invested" value={formatRupees(stats.invested)} tone="purple" />
            <Line
              label="net"
              value={formatRupees(stats.cashFlow)}
              tone={stats.cashFlow >= 0 ? 'good' : 'bad'}
            />
            {stats.gross > stats.income && <Line label="gross (pre-deduction)" value={formatRupees(stats.gross)} />}
            <p className="term-comment is-nested">{`// ${stats.counts.income} inflow · ${stats.counts.expense} outflow · ${stats.counts.invested} investment entries`}</p>
          </section>

          <section className="term-section">
            <h2 className="term-section-title is-cyan">accounts</h2>
            <p className="term-comment is-nested">{'// live balances derived from every logged entry'}</p>
            {ledger.bankAccounts.map(account => (
              <Line
                key={account.id}
                label={account.name.toLowerCase()}
                value={formatRupees(ledger.balances.banks[account.id] ?? 0)}
                tone="cyan"
              />
            ))}
            <Line label="cash in hand" value={formatRupees(ledger.balances.cash)} tone="amber" />
            <Line label="credit card debt" value={formatRupees(ledger.debt)} tone={ledger.debt > 0 ? 'bad' : 'plain'} />
            <Line label="invested (incl. epf)" value={formatRupees(ledger.investedTotal)} tone="purple" />
            <Line label="asset valuation" value={formatRupees(ledger.assetsTotal)} tone="blue" />
            <Line label="lent out (pending)" value={formatRupees(ledger.lendingPending)} tone="amber" />
            <Line label="net worth" value={formatRupees(ledger.netWorth)} tone="good" />
            <div className="term-window-row">
              <button
                type="button"
                className="term-token"
                onClick={() =>
                  openModal({ kind: 'opening' }, {
                    bank: String(ledger.initialBank),
                    cash: String(ledger.initialCash),
                    epf: String(ledger.initialEpf),
                  })
                }
              >
                [opening balances]
              </button>
            </div>
          </section>

          <section className="term-section">
            <h2 className="term-section-title is-amber">quick entry</h2>
            <p className="term-comment is-nested">{'// log a transaction against the ledger'}</p>
            <div className="term-window-row">
              <button
                type="button"
                className="term-token is-action"
                onClick={() => openModal({ kind: 'income' }, { category: 'salary', account: `bank:${primaryBankId}` })}
              >
                [+ income]
              </button>
              <button
                type="button"
                className="term-token is-danger"
                onClick={() =>
                  openModal({ kind: 'expense' }, { category: 'food', account: `bank:${primaryBankId}`, classification: 'basic' })
                }
              >
                [+ expense]
              </button>
              <button
                type="button"
                className="term-token"
                onClick={() => openModal({ kind: 'transfer' }, { from: 'cash', to: `bank:${primaryBankId}` })}
              >
                [self transfer]
              </button>
              <button
                type="button"
                className="term-token"
                onClick={() => openModal({ kind: 'invest' }, { type: 'Stocks', account: `bank:${primaryBankId}` })}
              >
                [+ investment]
              </button>
            </div>
          </section>

          <section className="term-section">
            <h2 className="term-section-title is-purple">{`spend by category [${range}]`}</h2>
            <p className="term-comment is-nested">{'// share of outflow per category'}</p>
            {spendByCategory.length === 0 && <p className="term-comment">{'// no outflow recorded in this range'}</p>}
            {spendByCategory.slice(0, 10).map(entry => (
              <div className="term-bar-row is-labelled" key={entry.name}>
                <span className="term-bar-label">{entry.name.toLowerCase()}</span>
                <span className="term-bar-track">
                  <span
                    className="term-bar-fill"
                    style={{
                      width: `${stats.expense > 0 ? Math.round((entry.amount / stats.expense) * 100) : 0}%`,
                      background: entry.color,
                    }}
                  />
                </span>
                <span className="term-bar-value">{formatRupees(entry.amount)}</span>
              </div>
            ))}
          </section>
        </>
      )}

      {section === 'budget' && (
        <>
          <section className="term-section">
            <h2 className="term-section-title is-blue">budget plan</h2>
            <p className="term-comment is-nested">{'// planned split of monthly income vs actual spend this month'}</p>
            <Line label="planned income" value={formatRupees(budget.income)} tone="good" />
            <Line label="planned outflow" value={formatRupees(budgetRows.reduce((sum, row) => sum + row.planned, 0))} tone="blue" />
            <Line label="actual outflow" value={formatRupees(budgetRows.reduce((sum, row) => sum + row.actual, 0))} tone="amber" />
            <div className="term-window-row">
              <button
                type="button"
                className="term-token is-action"
                onClick={() =>
                  openModal({ kind: 'budget' }, {
                    income: String(budget.income),
                    ...Object.fromEntries(BUDGET_GROUPS.map(group => [group, String(budget.percentages[group] ?? 0)])),
                  })
                }
              >
                [edit plan]
              </button>
            </div>
          </section>

          <section className="term-section">
            <h2 className="term-section-title is-purple">group allocation</h2>
            <p className="term-comment is-nested">{'// bar shows actual spend against the planned cap'}</p>
            {budgetRows.map(row => {
              const ratio = row.planned > 0 ? row.actual / row.planned : row.actual > 0 ? 1 : 0;
              return (
                <div key={row.group}>
                  <div className="term-bar-row is-labelled">
                    <span className="term-bar-label">{row.group}</span>
                    <span className="term-bar-track">
                      <span
                        className="term-bar-fill"
                        style={{
                          width: `${Math.min(100, Math.round(ratio * 100))}%`,
                          background: ratio > 1 ? '#ef4444' : undefined,
                        }}
                      />
                    </span>
                    <span className="term-bar-value">{`${Math.round(ratio * 100)}%`}</span>
                  </div>
                  <p className="term-comment is-nested">
                    {`// ${budget.percentages[row.group] ?? 0}% · plan ${formatRupees(row.planned)} · actual ${formatRupees(row.actual)} · ${row.planned - row.actual >= 0 ? 'left' : 'over'} ${formatRupees(Math.abs(row.planned - row.actual))}`}
                  </p>
                </div>
              );
            })}
          </section>
        </>
      )}

      {section === 'transactions' && (
        <>
          <div className="term-toolbar">
            <div className="term-filter-row">
              {(['all', 'income', 'expense', 'transfer', 'invest'] as const).map(entry => (
                <button
                  key={entry}
                  type="button"
                  className={`term-token${filter === entry ? ' is-active' : ''}`}
                  onClick={() => setFilter(entry)}
                >
                  {`[${entry}]`}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="term-token is-action"
              onClick={() =>
                openModal({ kind: 'expense' }, { category: 'food', account: `bank:${primaryBankId}`, classification: 'basic' })
              }
            >
              [+ entry]
            </button>
          </div>

          <section className="term-section">
            {ledgerRows.length === 0 && <p className="term-comment">{'// no entries for this range and filter'}</p>}
            {ledgerRows.map(row => (
              <div className="term-quest-row" key={`${row.kind}-${row.id}`}>
                <span className={`term-ledger-sign is-${row.kind}`}>
                  {row.kind === 'income' ? '[+]' : row.kind === 'transfer' ? '[=]' : '[-]'}
                </span>
                <div className="term-quest-copy">
                  <p>
                    <span style={{ color: row.color }}>{row.label.toLowerCase()}</span>
                    <span className="term-inline-meta">{` ${formatRupees(Math.abs(row.amount))}`}</span>
                  </p>
                  <p className="term-comment">{`// ${row.date} · ${row.account}${row.note ? ` · ${row.note}` : ''}`}</p>
                </div>
                <span className="term-row-actions">
                  {row.kind === 'income' && (
                    <button
                      type="button"
                      className="term-token"
                      onClick={() => {
                        const income = ledger.incomes.find(entry => entry.id === row.id)!;
                        openModal({ kind: 'income', id: income.id }, {
                          amount: String(income.amount),
                          category: income.sourceCategory,
                          account: income.accountType === 'cash' ? 'cash' : `bank:${income.bankAccountId ?? primaryBankId}`,
                          note: income.note ?? '',
                          salary: income.isSalary ? 'yes' : '',
                          epf: String(income.deductions?.find(item => item.name === 'EPF')?.amount ?? 0),
                        });
                      }}
                    >
                      [edit]
                    </button>
                  )}
                  {row.kind === 'expense' && (
                    <button
                      type="button"
                      className="term-token"
                      onClick={() => {
                        const expense = ledger.expenses.find(entry => entry.id === row.id)!;
                        openModal({ kind: 'expense', id: expense.id }, {
                          amount: String(expense.amount),
                          category: expense.category,
                          account:
                            expense.accountType === 'cash'
                              ? 'cash'
                              : expense.accountType === 'credit_card'
                                ? `cc:${expense.creditCardId}`
                                : `bank:${expense.bankAccountId ?? primaryBankId}`,
                          classification: expense.classification ?? 'basic',
                          note: expense.note ?? '',
                        });
                      }}
                    >
                      [edit]
                    </button>
                  )}
                  <button type="button" className="term-token is-danger" onClick={() => deleteRow(row)}>[del]</button>
                </span>
              </div>
            ))}
          </section>
        </>
      )}

      {section === 'credit' && (
        <>
          <div className="term-toolbar">
            <p className="term-comment">{`// ${ledger.creditCards.length} cards · ${formatRupees(ledger.debt)} outstanding`}</p>
            <button type="button" className="term-token is-action" onClick={() => openModal({ kind: 'card' }, { balance: '0' })}>
              [+ card]
            </button>
          </div>
          <section className="term-section">
            {ledger.creditCards.length === 0 && <p className="term-comment">{'// no credit cards registered'}</p>}
            {ledger.creditCards.map(card => {
              const utilisation = card.cardLimit > 0 ? (card.balance || 0) / card.cardLimit : 0;
              return (
                <div className="term-quest-row" key={card.id}>
                  <span className="term-ledger-sign is-expense">[cc]</span>
                  <div className="term-quest-copy">
                    <p>
                      <span>{card.title.toLowerCase()}</span>
                      <span className="term-inline-meta">{` ${formatRupees(card.balance || 0)} / ${formatRupees(card.cardLimit)}`}</span>
                    </p>
                    <div className="term-bar-row">
                      <span className="term-bar-track">
                        <span
                          className="term-bar-fill"
                          style={{
                            width: `${Math.min(100, Math.round(utilisation * 100))}%`,
                            background: utilisation > 0.5 ? '#ef4444' : undefined,
                          }}
                        />
                      </span>
                      <span className="term-bar-value">{`${Math.round(utilisation * 100)}%`}</span>
                    </div>
                    <p className="term-comment">{`// available ${formatRupees(Math.max(0, card.cardLimit - (card.balance || 0)))}`}</p>
                  </div>
                  <span className="term-row-actions">
                    <button
                      type="button"
                      className="term-token"
                      onClick={() => openModal({ kind: 'pay', cardId: card.id }, { amount: String(card.balance || 0), source: `bank:${primaryBankId}` })}
                    >
                      [pay]
                    </button>
                    <button
                      type="button"
                      className="term-token is-danger"
                      onClick={() => confirmDelete(`delete card "${card.title}"`, () => ledger.deleteCreditCard(card.id))}
                    >
                      [del]
                    </button>
                  </span>
                </div>
              );
            })}
          </section>
        </>
      )}

      {section === 'lending' && (
        <>
          <div className="term-toolbar">
            <p className="term-comment">{`// ${formatRupees(ledger.lendingPending)} pending recovery`}</p>
            <button type="button" className="term-token is-action" onClick={() => openModal({ kind: 'lend' }, { account: `bank:${primaryBankId}` })}>
              [+ loan]
            </button>
          </div>
          <section className="term-section">
            {ledger.lending.length === 0 && <p className="term-comment">{'// nothing lent out'}</p>}
            {ledger.lending.map(loan => (
              <div className="term-quest-row" key={loan.id}>
                <button
                  type="button"
                  className={`term-check${loan.returnedStatus === 'Returned' ? ' is-done' : ''}`}
                  onClick={() => ledger.toggleLendingReturned(loan)}
                  aria-label={`Mark ${loan.personName} loan ${loan.returnedStatus === 'Returned' ? 'pending' : 'returned'}`}
                >
                  {loan.returnedStatus === 'Returned' ? '[✓]' : '[ ]'}
                </button>
                <div className="term-quest-copy">
                  <p>
                    <span className={loan.returnedStatus === 'Returned' ? 'term-done-copy' : ''}>{loan.personName.toLowerCase()}</span>
                    <span className="term-inline-meta">{` ${formatRupees(loan.amount)}`}</span>
                  </p>
                  <p className="term-comment">
                    {`// given ${loan.dateGiven} from ${loan.accountType === 'bank' ? bankName(loan.bankAccountId) : 'cash'} · `}
                    <span className={loan.returnedStatus === 'Returned' ? 'term-state-on' : 'term-state-off'}>
                      {loan.returnedStatus.toLowerCase()}
                    </span>
                  </p>
                </div>
                <span className="term-row-actions">
                  <button
                    type="button"
                    className="term-token is-danger"
                    onClick={() => confirmDelete(`delete loan to "${loan.personName}"`, () => ledger.deleteLending(loan.id))}
                  >
                    [del]
                  </button>
                </span>
              </div>
            ))}
          </section>
        </>
      )}

      {section === 'assets' && (
        <>
          <section className="term-section">
            <h2 className="term-section-title is-cyan">investments</h2>
            <p className="term-comment is-nested">{`// ${formatRupees(ledger.investedTotal)} invested including epf`}</p>
            <Line label="epf balance" value={formatRupees(ledger.epfBalance)} tone="purple" />
            <Line label="epf from salary" value={formatRupees(ledger.epfDeductions * 2)} tone="cyan" />
            <Line
              label="market investments"
              value={formatRupees(ledger.investments.filter(item => item.type !== 'EPF').reduce((sum, item) => sum + item.amount, 0))}
              tone="blue"
            />
            <div className="term-window-row">
              <button
                type="button"
                className="term-token is-action"
                onClick={() => openModal({ kind: 'invest' }, { type: 'Stocks', account: `bank:${primaryBankId}` })}
              >
                [+ investment]
              </button>
              <button type="button" className="term-token" onClick={() => openModal({ kind: 'opening' }, { bank: String(ledger.initialBank), cash: String(ledger.initialCash), epf: String(ledger.initialEpf) })}>
                [set epf opening]
              </button>
            </div>
          </section>

          <section className="term-section">
            <div className="term-toolbar">
              <h2 className="term-section-title is-amber">{`owned assets · ${formatRupees(ledger.assetsTotal)}`}</h2>
              <button type="button" className="term-token is-action" onClick={() => openModal({ kind: 'asset' }, { type: 'Bike' })}>
                [+ asset]
              </button>
            </div>
            {ledger.assets.length === 0 && <p className="term-comment">{'// no assets tracked'}</p>}
            {ledger.assets.map(asset => (
              <div className="term-quest-row" key={asset.id}>
                <span className="term-ledger-sign is-invest">[as]</span>
                <div className="term-quest-copy">
                  <p>
                    <span>{asset.name.toLowerCase()}</span>
                    <span className="term-inline-meta">{` ${formatRupees(asset.price)}`}</span>
                  </p>
                  <p className="term-comment">{`// type: ${asset.type.toLowerCase()}`}</p>
                </div>
                <span className="term-row-actions">
                  <button
                    type="button"
                    className="term-token is-danger"
                    onClick={() => confirmDelete(`delete asset "${asset.name}"`, () => ledger.deleteAsset(asset.id))}
                  >
                    [del]
                  </button>
                </span>
              </div>
            ))}
          </section>

          <section className="term-section">
            <div className="term-toolbar">
              <h2 className="term-section-title is-blue">insurance</h2>
              <button type="button" className="term-token is-action" onClick={() => openModal({ kind: 'insurance' }, { term: 'Yearly' })}>
                [+ policy]
              </button>
            </div>
            {ledger.insurances.length === 0 && <p className="term-comment">{'// no policies tracked'}</p>}
            {ledger.insurances.map(policy => (
              <div className="term-quest-row" key={policy.id}>
                <span className="term-ledger-sign is-transfer">[in]</span>
                <div className="term-quest-copy">
                  <p>
                    <span>{policy.name.toLowerCase()}</span>
                    <span className="term-inline-meta">{` ${formatRupees(policy.premium)}`}</span>
                  </p>
                  <p className="term-comment">{`// premium term: ${policy.term.toLowerCase()}`}</p>
                </div>
                <span className="term-row-actions">
                  <button
                    type="button"
                    className="term-token is-danger"
                    onClick={() => confirmDelete(`delete policy "${policy.name}"`, () => ledger.deleteInsurance(policy.id))}
                  >
                    [del]
                  </button>
                </span>
              </div>
            ))}
          </section>
        </>
      )}

      {modal?.kind === 'income' && (
        <Modal command={modal.id ? 'income --edit' : 'income --new'} onClose={close}>
          <form
            className="term-form"
            onSubmit={event =>
              submit(event, () =>
                ledger.addIncome({
                  id: modal.id,
                  date: modal.id ? ledger.incomes.find(entry => entry.id === modal.id)?.date : undefined,
                  amount: amount(),
                  sourceCategory: field('category', 'salary'),
                  note: field('note'),
                  isSalary: field('salary') === 'yes',
                  deductions: field('salary') === 'yes' ? [{ name: 'EPF', amount: amount('epf') }] : undefined,
                  ...parseCashOrBank(field('account', `bank:${primaryBankId}`)),
                }),
              )
            }
          >
            <label>amount<input autoFocus className="term-input" type="number" min="0" value={field('amount')} onChange={event => set('amount', event.target.value)} /></label>
            <label>source
              <select className="term-input" value={field('category', 'salary')} onChange={event => set('category', event.target.value)}>
                {incomeCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label>credit to
              <select className="term-input" value={field('account', `bank:${primaryBankId}`)} onChange={event => set('account', event.target.value)}>
                {ledger.bankAccounts.map(account => <option key={account.id} value={`bank:${account.id}`}>{account.name}</option>)}
                <option value="cash">Cash in hand</option>
              </select>
            </label>
            <label>note<input className="term-input" value={field('note')} onChange={event => set('note', event.target.value)} /></label>
            <fieldset className="term-fieldset">
              <legend>salary</legend>
              <div className="term-filter-row">
                <button type="button" className={`term-token${field('salary') === 'yes' ? ' is-active' : ''}`} onClick={() => set('salary', field('salary') === 'yes' ? '' : 'yes')}>
                  {`[${field('salary') === 'yes' ? 'x' : ' '}] salary entry`}
                </button>
              </div>
              {field('salary') === 'yes' && (
                <label>epf deduction<input className="term-input" type="number" min="0" value={field('epf', '0')} onChange={event => set('epf', event.target.value)} /></label>
              )}
            </fieldset>
            <div className="term-command-actions">
              <button type="button" className="term-token" onClick={close}>[cancel]</button>
              <button type="submit" className="term-token is-action" disabled={amount() <= 0}>[save income]</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === 'expense' && (
        <Modal command={modal.id ? 'expense --edit' : 'expense --new'} onClose={close}>
          <form
            className="term-form"
            onSubmit={event =>
              submit(event, () =>
                ledger.addExpense({
                  id: modal.id,
                  date: modal.id ? ledger.expenses.find(entry => entry.id === modal.id)?.date : undefined,
                  amount: amount(),
                  category: field('category', 'food'),
                  classification: field('classification', 'basic') as (typeof EXPENSE_CLASSIFICATIONS)[number],
                  note: field('note'),
                  ...parseAccount(field('account', `bank:${primaryBankId}`)),
                }),
              )
            }
          >
            <label>amount<input autoFocus className="term-input" type="number" min="0" value={field('amount')} onChange={event => set('amount', event.target.value)} /></label>
            <label>category
              <select className="term-input" value={field('category', 'food')} onChange={event => set('category', event.target.value)}>
                {expenseCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label>paid from
              <select className="term-input" value={field('account', `bank:${primaryBankId}`)} onChange={event => set('account', event.target.value)}>
                {ledger.bankAccounts.map(account => <option key={account.id} value={`bank:${account.id}`}>{account.name}</option>)}
                <option value="cash">Cash in hand</option>
                {ledger.creditCards.map(card => <option key={card.id} value={`cc:${card.id}`}>{card.title} (credit)</option>)}
              </select>
            </label>
            <fieldset className="term-fieldset">
              <legend>budget group</legend>
              <div className="term-filter-row">
                {BUDGET_GROUPS.map(group => (
                  <button
                    key={group}
                    type="button"
                    className={`term-token${field('classification', 'basic') === group ? ' is-active' : ''}`}
                    onClick={() => set('classification', group)}
                  >
                    {`[${group}]`}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>note<input className="term-input" value={field('note')} onChange={event => set('note', event.target.value)} /></label>
            <div className="term-command-actions">
              <button type="button" className="term-token" onClick={close}>[cancel]</button>
              <button type="submit" className="term-token is-action" disabled={amount() <= 0}>[save expense]</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === 'transfer' && (
        <Modal command="transfer --self" onClose={close}>
          <form
            className="term-form"
            onSubmit={event =>
              submit(event, () =>
                ledger.addTransfer(
                  amount(),
                  field('from', 'cash').replace('bank:', ''),
                  field('to', `bank:${primaryBankId}`).replace('bank:', ''),
                  field('note'),
                ),
              )
            }
          >
            <label>amount<input autoFocus className="term-input" type="number" min="0" value={field('amount')} onChange={event => set('amount', event.target.value)} /></label>
            <label>from
              <select className="term-input" value={field('from', 'cash')} onChange={event => set('from', event.target.value)}>
                <option value="cash">Cash in hand</option>
                {ledger.bankAccounts.map(account => <option key={account.id} value={`bank:${account.id}`}>{account.name}</option>)}
              </select>
            </label>
            <label>to
              <select className="term-input" value={field('to', `bank:${primaryBankId}`)} onChange={event => set('to', event.target.value)}>
                <option value="cash">Cash in hand</option>
                {ledger.bankAccounts.map(account => <option key={account.id} value={`bank:${account.id}`}>{account.name}</option>)}
              </select>
            </label>
            <label>note<input className="term-input" value={field('note')} onChange={event => set('note', event.target.value)} /></label>
            <div className="term-command-actions">
              <button type="button" className="term-token" onClick={close}>[cancel]</button>
              <button
                type="submit"
                className="term-token is-action"
                disabled={amount() <= 0 || field('from', 'cash') === field('to', `bank:${primaryBankId}`)}
              >
                [move funds]
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === 'invest' && (
        <Modal command="investment --new" onClose={close}>
          <form
            className="term-form"
            onSubmit={event =>
              submit(event, () =>
                ledger.addInvestment(
                  amount(),
                  field('type', 'Stocks') as 'Stocks' | 'Mutual Funds' | 'EPF',
                  field('account', `bank:${primaryBankId}`).replace('bank:', ''),
                  field('note'),
                ),
              )
            }
          >
            <label>amount<input autoFocus className="term-input" type="number" min="0" value={field('amount')} onChange={event => set('amount', event.target.value)} /></label>
            <fieldset className="term-fieldset">
              <legend>instrument</legend>
              <div className="term-filter-row">
                {(['Stocks', 'Mutual Funds', 'EPF'] as const).map(type => (
                  <button key={type} type="button" className={`term-token${field('type', 'Stocks') === type ? ' is-active' : ''}`} onClick={() => set('type', type)}>
                    {`[${type.toLowerCase()}]`}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>funded from
              <select className="term-input" value={field('account', `bank:${primaryBankId}`)} onChange={event => set('account', event.target.value)}>
                {ledger.bankAccounts.map(account => <option key={account.id} value={`bank:${account.id}`}>{account.name}</option>)}
              </select>
            </label>
            <label>note<input className="term-input" value={field('note')} onChange={event => set('note', event.target.value)} /></label>
            <div className="term-command-actions">
              <button type="button" className="term-token" onClick={close}>[cancel]</button>
              <button type="submit" className="term-token is-action" disabled={amount() <= 0}>[save investment]</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === 'card' && (
        <Modal command="card --new" onClose={close}>
          <form className="term-form" onSubmit={event => submit(event, () => ledger.addCreditCard(field('title'), amount('limit'), amount('balance')))}>
            <label>card name<input autoFocus className="term-input" value={field('title')} onChange={event => set('title', event.target.value)} /></label>
            <label>credit limit<input className="term-input" type="number" min="0" value={field('limit')} onChange={event => set('limit', event.target.value)} /></label>
            <label>current outstanding<input className="term-input" type="number" min="0" value={field('balance', '0')} onChange={event => set('balance', event.target.value)} /></label>
            <div className="term-command-actions">
              <button type="button" className="term-token" onClick={close}>[cancel]</button>
              <button type="submit" className="term-token is-action" disabled={!field('title').trim() || amount('limit') <= 0}>[save card]</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === 'pay' && (
        <Modal command="card --pay" onClose={close}>
          <form
            className="term-form"
            onSubmit={event => {
              const source = field('source', `bank:${primaryBankId}`);
              submit(event, () =>
                ledger.payCreditCard(
                  modal.cardId,
                  amount(),
                  source === 'cash' ? 'cash' : 'bank',
                  source === 'cash' ? undefined : source.replace('bank:', ''),
                ),
              );
            }}
          >
            <p className="term-comment">{`// paying ${ledger.creditCards.find(card => card.id === modal.cardId)?.title ?? ''}`}</p>
            <label>amount<input autoFocus className="term-input" type="number" min="0" value={field('amount')} onChange={event => set('amount', event.target.value)} /></label>
            <label>pay from
              <select className="term-input" value={field('source', `bank:${primaryBankId}`)} onChange={event => set('source', event.target.value)}>
                {ledger.bankAccounts.map(account => <option key={account.id} value={`bank:${account.id}`}>{account.name}</option>)}
                <option value="cash">Cash in hand</option>
              </select>
            </label>
            <div className="term-command-actions">
              <button type="button" className="term-token" onClick={close}>[cancel]</button>
              <button type="submit" className="term-token is-action" disabled={amount() <= 0}>[pay bill]</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === 'lend' && (
        <Modal command="lending --new" onClose={close}>
          <form
            className="term-form"
            onSubmit={event => {
              const account = field('account', `bank:${primaryBankId}`);
              submit(event, () =>
                ledger.addLending(
                  field('person'),
                  amount(),
                  account === 'cash' ? 'cash' : 'bank',
                  account === 'cash' ? undefined : account.replace('bank:', ''),
                ),
              );
            }}
          >
            <label>person<input autoFocus className="term-input" value={field('person')} onChange={event => set('person', event.target.value)} /></label>
            <label>amount<input className="term-input" type="number" min="0" value={field('amount')} onChange={event => set('amount', event.target.value)} /></label>
            <label>given from
              <select className="term-input" value={field('account', `bank:${primaryBankId}`)} onChange={event => set('account', event.target.value)}>
                {ledger.bankAccounts.map(account => <option key={account.id} value={`bank:${account.id}`}>{account.name}</option>)}
                <option value="cash">Cash in hand</option>
              </select>
            </label>
            <div className="term-command-actions">
              <button type="button" className="term-token" onClick={close}>[cancel]</button>
              <button type="submit" className="term-token is-action" disabled={!field('person').trim() || amount() <= 0}>[save loan]</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === 'asset' && (
        <Modal command="asset --new" onClose={close}>
          <form className="term-form" onSubmit={event => submit(event, () => ledger.addAsset(field('name'), field('type', 'Bike') as 'Bike' | 'Car' | 'Other', amount('price')))}>
            <label>name<input autoFocus className="term-input" value={field('name')} onChange={event => set('name', event.target.value)} /></label>
            <fieldset className="term-fieldset">
              <legend>type</legend>
              <div className="term-filter-row">
                {(['Bike', 'Car', 'Other'] as const).map(type => (
                  <button key={type} type="button" className={`term-token${field('type', 'Bike') === type ? ' is-active' : ''}`} onClick={() => set('type', type)}>
                    {`[${type.toLowerCase()}]`}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>valuation<input className="term-input" type="number" min="0" value={field('price')} onChange={event => set('price', event.target.value)} /></label>
            <div className="term-command-actions">
              <button type="button" className="term-token" onClick={close}>[cancel]</button>
              <button type="submit" className="term-token is-action" disabled={!field('name').trim() || amount('price') <= 0}>[save asset]</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === 'insurance' && (
        <Modal command="insurance --new" onClose={close}>
          <form
            className="term-form"
            onSubmit={event =>
              submit(event, () =>
                ledger.addInsurance(field('name'), amount('premium'), field('term', 'Yearly') as 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly'),
              )
            }
          >
            <label>policy name<input autoFocus className="term-input" value={field('name')} onChange={event => set('name', event.target.value)} /></label>
            <label>premium<input className="term-input" type="number" min="0" value={field('premium')} onChange={event => set('premium', event.target.value)} /></label>
            <fieldset className="term-fieldset">
              <legend>term</legend>
              <div className="term-filter-row">
                {(['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'] as const).map(term => (
                  <button key={term} type="button" className={`term-token${field('term', 'Yearly') === term ? ' is-active' : ''}`} onClick={() => set('term', term)}>
                    {`[${term.toLowerCase()}]`}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="term-command-actions">
              <button type="button" className="term-token" onClick={close}>[cancel]</button>
              <button type="submit" className="term-token is-action" disabled={!field('name').trim() || amount('premium') <= 0}>[save policy]</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === 'opening' && (
        <Modal command="balances --opening" onClose={close}>
          <form
            className="term-form"
            onSubmit={event =>
              submit(event, () => {
                ledger.setOpeningBalance('bank', amount('bank'));
                ledger.setOpeningBalance('cash', amount('cash'));
                ledger.setEpfOpeningBalance(amount('epf'));
              })
            }
          >
            <p className="term-comment">{'// starting values before any logged transaction'}</p>
            <label>bank opening<input autoFocus className="term-input" type="number" value={field('bank', '0')} onChange={event => set('bank', event.target.value)} /></label>
            <label>cash opening<input className="term-input" type="number" value={field('cash', '0')} onChange={event => set('cash', event.target.value)} /></label>
            <label>epf opening<input className="term-input" type="number" value={field('epf', '0')} onChange={event => set('epf', event.target.value)} /></label>
            <div className="term-command-actions">
              <button type="button" className="term-token" onClick={close}>[cancel]</button>
              <button type="submit" className="term-token is-action">[save balances]</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === 'budget' && (
        <Modal command="budget --edit" onClose={close}>
          <form
            className="term-form"
            onSubmit={event =>
              submit(event, () => {
                const income = amount('income');
                const percentages = Object.fromEntries(BUDGET_GROUPS.map(group => [group, amount(group)]));
                setBudget({ income, percentages });
                db.settings.put({ id: 'budget_total_income', value: income });
                db.settings.put({ id: 'budget_group_percentages', value: percentages });
              })
            }
          >
            <label>monthly income<input autoFocus className="term-input" type="number" min="0" value={field('income')} onChange={event => set('income', event.target.value)} /></label>
            <fieldset className="term-fieldset">
              <legend>{`allocation % (total ${BUDGET_GROUPS.reduce((sum, group) => sum + amount(group), 0)}%)`}</legend>
              {BUDGET_GROUPS.map(group => (
                <label key={group}>{group}
                  <input className="term-input" type="number" min="0" max="100" value={field(group, '0')} onChange={event => set(group, event.target.value)} />
                </label>
              ))}
            </fieldset>
            <div className="term-command-actions">
              <button type="button" className="term-token" onClick={close}>[cancel]</button>
              <button type="submit" className="term-token is-action">[save plan]</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === 'confirm' && (
        <Modal command="ledger --delete" onClose={close}>
          <p className="term-comment">{`// ${modal.label}? this cannot be undone`}</p>
          <div className="term-command-actions">
            <button type="button" className="term-token" onClick={close}>[cancel]</button>
            <button
              type="button"
              className="term-token is-danger"
              onClick={() => {
                const label = modal.label;
                modal.run();
                setCommandOutput(`${label} completed`);
                close();
              }}
            >
              [confirm delete]
            </button>
          </div>
        </Modal>
      )}
      {commandOutput && <p className="term-command-output"><b>&gt;</b> {commandOutput}</p>}
    </>
  );
}
