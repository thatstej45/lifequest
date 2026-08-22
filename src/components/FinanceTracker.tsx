import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Utensils, Home, ShoppingCart, Zap, Droplet, Flame, Globe, Phone, Fuel, Bus,
  Wrench, Shield, Pill, Stethoscope, Dumbbell, Film, Gamepad, BookOpen,
  Shirt, Scissors, Cat, Laptop, Sofa, PenTool, Gift, Heart,
  Plane, Bed, Coffee, Pizza, Wine, Receipt, CreditCard, Landmark,
  PiggyBank, Hammer, Sparkles, Smile, RefreshCw, AlertTriangle, Bike,
  Car, ArrowLeftRight, HelpCircle, DollarSign, Wallet, FileText,
  Banknote, Calendar, User, Briefcase, Plus, Trash2, Check, CheckCircle2,
  TrendingUp, TrendingDown, Clock, ShieldAlert, ChevronRight, Scale, Coins, GraduationCap, Trophy, Edit2, Sliders, ChevronDown
} from 'lucide-react';
import { db } from '../db';
import { 
  FinanceIncome, FinanceExpense, FinanceInvestment, FinanceLending, 
  FinanceInsurance, FinanceAsset, FinanceTransfer, FinanceCreditCard, UserStats
} from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { EXPENSE_CATEGORY_META, INCOME_CATEGORY_META } from '../finance/categories';

// --- Indian Currency Formatter (Thousands=T, Lacs=L, Crore=C) ---
export const formatIndianCurrency = (value: number): string => {
  if (value === 0) return '0';
  const absVal = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absVal >= 10000000) { // 1 Crore = 10,000,000
    const cr = absVal / 10000000;
    return `${sign}${Number(cr.toFixed(2))}C`;
  }
  if (absVal >= 100000) { // 1 Lakh = 100,000
    const lakh = absVal / 100000;
    return `${sign}${Number(lakh.toFixed(2))}L`;
  }
  if (absVal >= 1000) { // 1 Thousand = 1,000
    const k = absVal / 1000;
    return `${sign}${Number(k.toFixed(2))}T`;
  }
  return `${sign}${absVal}`;
};

// --- Category Data ---
// Names and colors live in src/finance/categories.ts so both themes stay in sync;
// only the claymorphic icon per category is defined here.
const EXPENSE_ICONS: Record<string, typeof HelpCircle> = {
  food: Utensils, groceries: ShoppingCart, rent: Home, electricity: Zap, water: Droplet,
  gas: Flame, internet: Globe, phone: Phone, fuel: Fuel, public_transit: Bus,
  cabs: Car, car_maint: Wrench, medicine: Pill, doctor: Stethoscope, gym: Dumbbell,
  cinema: Film, gaming: Gamepad, books: BookOpen, clothing: Shirt, salon: Scissors,
  pets: Cat, electronics: Laptop, furniture: Sofa, stationery: PenTool, gifts: Gift,
  charity: Heart, travel: Plane, hotel: Bed, cafe: Coffee, snacks: Pizza,
  bars: Wine, taxes: Receipt, bank_fees: Landmark, subscriptions: CreditCard,
  epf_contribution: PiggyBank, repairs: Hammer, cleaning: Sparkles, insurance: Shield,
  penalty: AlertTriangle, invest_outflow: TrendingUp, bike_maint: Bike, car_expense: Car,
  loan_emi: CreditCard, office_lunch: Utensils, cosmetics: Smile, software: Laptop,
  education: GraduationCap, maids: User, business_cost: Briefcase,
  self_trans_charge: ArrowLeftRight, misc: HelpCircle
};

const INCOME_ICONS: Record<string, typeof HelpCircle> = {
  salary: Banknote, shift_allowance: Clock, freelance: Briefcase, dividends: TrendingUp,
  mf_returns: TrendingUp, interest: Landmark, rental: Home, gift: Gift, cash_back: Coffee,
  side_hustle: Sparkles, items_sold: ShoppingCart, lending_return: User, bonus: Trophy,
  commission: Gift, reimbursement: Receipt, epf_withdrawal: PiggyBank, crypto: Flame,
  royalty: PenTool, subsidy: Gift, misc: HelpCircle
};

export const EXPENSE_CATEGORIES = EXPENSE_CATEGORY_META.map(meta => ({
  ...meta,
  icon: EXPENSE_ICONS[meta.id] ?? HelpCircle
}));

export const INCOME_CATEGORIES = INCOME_CATEGORY_META.map(meta => ({
  ...meta,
  icon: INCOME_ICONS[meta.id] ?? HelpCircle
}));

export const getExpenseIcon = (catId: string) => {
  const match = EXPENSE_CATEGORIES.find(c => c.id === catId);
  return match ? React.createElement(match.icon, { size: 16, style: { color: match.color } }) : <HelpCircle size={16} className="text-gray-400" />;
};

export const getIncomeIcon = (catId: string) => {
  const match = INCOME_CATEGORIES.find(c => c.id === catId);
  return match ? React.createElement(match.icon, { size: 16, style: { color: match.color } }) : <HelpCircle size={16} className="text-gray-400" />;
};

interface FinanceTrackerProps {
  onBalancesChange?: (balances: {
    bank: number;
    cash: number;
    debt: number;
    investments: number;
    initialBank: number;
    initialCash: number;
    epfBalance: number;
  }) => void;
}

export default function FinanceTracker({ onBalancesChange }: FinanceTrackerProps = {}) {
  const [activeRange, setActiveRange] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [subSection, setSubSection] = useState<'dashboard' | 'budget' | 'transactions' | 'credit' | 'lending' | 'assets'>('dashboard');

  // --- Budget Planning and Expense Distribution States ---
  const [budgetTotalIncome, setBudgetTotalIncome] = useState<number>(100000);
  const [budgetTypeMode, setBudgetTypeMode] = useState<'fixed' | 'actual'>('fixed');
  const [wantsCollectiveCap, setWantsCollectiveCap] = useState<number>(15000);
  const [investmentsCollectiveCap, setInvestmentsCollectiveCap] = useState<number>(10000);
  const [budgetPercentages, setBudgetPercentages] = useState<{
    basic: number;
    wants: number;
    savings: number;
    investments: number;
    family: number;
    extra: number;
  }>({
    basic: 18,
    wants: 17,
    savings: 20,
    investments: 10,
    family: 30,
    extra: 5
  });

  const [budgetCategories, setBudgetCategories] = useState<Array<{
    id: string;
    groupId: string; // 'basic' | 'wants' | 'savings' | 'investments' | 'family' | 'extra'
    name: string;
    spendCap: number; // spend cap in PKR/INR
    mappedCategories: string[]; // transaction category IDs
    noteFilter?: string; // option to match expense note text e.g. "rent" or "parents"
  }>>([]);

  const [budgetSelectedMonth, setBudgetSelectedMonth] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });

  // Modal for adding or editing a budget category
  const [showBudgetCategoryModal, setShowBudgetCategoryModal] = useState(false);
  const [editingBudgetCategory, setEditingBudgetCategory] = useState<{
    id?: string;
    groupId: string;
    name: string;
    spendCap: number;
    mappedCategories: string[];
    noteFilter?: string;
  } | null>(null);

  // --- Core State Variables ---
  const [incomes, setIncomes] = useState<FinanceIncome[]>([]);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [investments, setInvestments] = useState<FinanceInvestment[]>([]);
  const [lending, setLending] = useState<FinanceLending[]>([]);
  const [insurances, setInsurances] = useState<FinanceInsurance[]>([]);
  const [assets, setAssets] = useState<FinanceAsset[]>([]);
  const [transfers, setTransfers] = useState<FinanceTransfer[]>([]);
  const [creditCards, setCreditCards] = useState<FinanceCreditCard[]>([]);
  const [initialEpfBalance, setInitialEpfBalance] = useState<number>(0);

  // Dynamic salary-deducted EPF sum (calculated as sum of all EPF deductions from salary incomes)
  const totalSalariedEPFDeductions = useMemo(() => {
    return incomes.reduce((sum, inc) => {
      if (inc.isSalary && inc.deductions) {
        const d = inc.deductions.find(item => item.name === 'EPF');
        return sum + (parseFloat(d?.amount as any) || 0);
      }
      return sum;
    }, 0);
  }, [incomes]);

  // Derived EPF balance = Initial EPF opening amount + (total salary deductions multiplied by 2)
  const epfBalance = useMemo(() => {
    return initialEpfBalance + (totalSalariedEPFDeductions * 2);
  }, [initialEpfBalance, totalSalariedEPFDeductions]);
  
  // Custom finance categories list & error
  const [customCategories, setCustomCategories] = useState<{ id: string, name: string, type: 'income' | 'expense', color: string, iconName: string }[]>([]);
  const [catError, setCatError] = useState('');
  
  // Custom bank accounts
  const [customBankAccounts, setCustomBankAccounts] = useState<Array<{
    id: string;
    name: string;
    type: 'savings' | 'salaried' | 'current' | 'other';
    initialBalance: number;
  }>>([]);
  const [showBankAccountsModal, setShowBankAccountsModal] = useState(false);
  const [editingBankAccountId, setEditingBankAccountId] = useState<string | null>(null);
  const [newBankName, setNewBankName] = useState('');
  const [newBankType, setNewBankType] = useState<'savings' | 'salaried' | 'current' | 'other'>('savings');
  const [newBankInitialBalance, setNewBankInitialBalance] = useState('');
  const [bankError, setBankError] = useState('');

  // Selected bank account IDs for each transaction type (defaults to 'bank_default' or bank ID)
  const [incBankAccountId, setIncBankAccountId] = useState('bank_default');
  const [expBankAccountId, setExpBankAccountId] = useState('bank_default');
  const [payCCBankAccountId, setPayCCBankAccountId] = useState('bank_default');
  const [lendBankAccountId, setLendBankAccountId] = useState('bank_default');
  const [investBankAccountId, setInvestBankAccountId] = useState('bank_default');

  // Editing state for transactions
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  
  // Starting configurable balance state (persisted simple settings)
  const [initialBankBalance, setInitialBankBalance] = useState<number>(0);
  const [initialCashBalance, setInitialCashBalance] = useState<number>(0);

  // Forms Visibility Toggles
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCCModal, setShowCCModal] = useState(false);
  const [showLendingModal, setShowLendingModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showPayCCModal, setShowPayCCModal] = useState(false);
  const [showEPFBalanceModal, setShowEPFBalanceModal] = useState(false);
  const [showAdjustOpenModal, setShowAdjustOpenModal] = useState(false);
  const [showCategoryManagerModal, setShowCategoryManagerModal] = useState(false);
  const [adjustOpenAccount, setAdjustOpenAccount] = useState<'bank' | 'cash'>('bank');
  const [adjustOpenValue, setAdjustOpenValue] = useState('');
  const [expError, setExpError] = useState('');

  // --- Category Manager Creation Wizard ---
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');
  const [newCatColor, setNewCatColor] = useState('#fb923c'); // Defaults to Orange-400
  const [newCatIcon, setNewCatIcon] = useState('Sparkles');

  // --- Forms State binding ---
  // Income Form
  const [incAmount, setIncAmount] = useState('');
  const [incCategory, setIncCategory] = useState('salary');
  const [showSourceCategoryPicker, setShowSourceCategoryPicker] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [incAccount, setIncAccount] = useState<'bank' | 'cash'>('bank');
  const [incNote, setIncNote] = useState('');
  const [incIsSalary, setIncIsSalary] = useState(false);
  const [incTax, setIncTax] = useState('0');
  const [incDeductions, setIncDeductions] = useState<Array<{ name: string; amount: number }>>([
    { name: 'EPF', amount: 0 },
    { name: 'Canteen Recovery', amount: 0 },
    { name: 'Transport Recovery', amount: 0 },
  ]);
  const [customDeductName, setCustomDeductName] = useState('');
  const [customDeductAmount, setCustomDeductAmount] = useState('');
  const [incIsShift, setIncIsShift] = useState(false);
  const [incShiftPerDay, setIncShiftPerDay] = useState('');
  const [incShiftExpected, setIncShiftExpected] = useState('');
  const [incShiftActualDays, setIncShiftActualDays] = useState('');

  // Expense Form
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('food');
  const [expAccount, setExpAccount] = useState<'bank' | 'cash' | 'credit_card'>('bank');
  const [expCCId, setExpCCId] = useState('');
  const [expNote, setExpNote] = useState('');
  const [expClassification, setExpClassification] = useState<'basic' | 'wants' | 'savings' | 'investments' | 'family' | 'extra'>('basic');

  // Credit Card Form
  const [ccTitle, setCcTitle] = useState('');
  const [ccLimit, setCcLimit] = useState('');
  const [ccBalance, setCcBalance] = useState('0');

  // Pay Credit Card Form
  const [payCCId, setPayCCId] = useState('');
  const [payCCAmount, setPayCCAmount] = useState('');
  const [payCCSource, setPayCCSource] = useState<'bank' | 'cash'>('bank');

  // Lending Form
  const [lendPerson, setLendPerson] = useState('');
  const [lendAmount, setLendAmount] = useState('');
  const [lendAccount, setLendAccount] = useState<'bank' | 'cash'>('bank');

  // Asset Form
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState<'Bike' | 'Car' | 'Other'>('Bike');
  const [assetPrice, setAssetPrice] = useState('');

  // Insurance Form
  const [insName, setInsName] = useState('');
  const [insPremium, setInsPremium] = useState('');
  const [insTerm, setInsTerm] = useState<'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly'>('Yearly');

  // Transfer Form
  const [transAmount, setTransAmount] = useState('');
  const [transFrom, setTransFrom] = useState<string>('cash');
  const [transTo, setTransTo] = useState<string>('bank_default');

  // EPF Accumulate Form
  const [epfInput, setEpfInput] = useState('');

  // Load Database Function
  const loadFinanceData = async () => {
    try {
      const inc = await db.financeIncomes.toArray();
      const exp = await db.financeExpenses.toArray();
      const inv = await db.financeInvestments.toArray();
      const len = await db.financeLending.toArray();
      const ins = await db.financeInsurance.toArray();
      const ast = await db.financeAssets.toArray();
      const tfr = await db.financeTransfers.toArray();
      const cc = await db.financeCreditCards.toArray();
      
      const configEpf = await db.settings.get('epf_balance');
      const configInitialEpf = await db.settings.get('initial_epf_balance');
      const configInitialBank = await db.settings.get('initial_bank_balance');
      const configInitialCash = await db.settings.get('initial_cash_balance');
      const configCustomCats = await db.settings.get('custom_finance_categories');
      const configCustomBanks = await db.settings.get('custom_bank_accounts');

      setIncomes(inc);
      setExpenses(exp);
      setInvestments(inv);
      setLending(len);
      setInsurances(ins);
      setAssets(ast);
      setTransfers(tfr);
      setCreditCards(cc);
      
      if (configInitialEpf) {
        setInitialEpfBalance(configInitialEpf.value || 0);
      } else if (configEpf) {
        setInitialEpfBalance(configEpf.value || 0);
        await db.settings.put({ id: 'initial_epf_balance', value: configEpf.value || 0 });
      } else {
        setInitialEpfBalance(0);
      }
      
      const primaryBankVal = configInitialBank?.value || 0;
      setInitialBankBalance(primaryBankVal);
      setInitialCashBalance(configInitialCash?.value || 0);

      let loadedBanks = configCustomBanks?.value || [];
      if (loadedBanks.length === 0) {
        loadedBanks = [{
          id: 'bank_default',
          name: 'Primary Bank Account',
          type: 'savings',
          initialBalance: primaryBankVal
        }];
        await db.settings.put({ id: 'custom_bank_accounts', value: loadedBanks });
      }
      setCustomBankAccounts(loadedBanks);

      if (configCustomCats?.value) {
        setCustomCategories(configCustomCats.value);
      }
    } catch (e) {
      console.error('Error loading finance data:', e);
    }
  };

  useEffect(() => {
    loadFinanceData();
    loadBudgetSettings();
  }, []);

  // --- Budget Planning Constants & Synchronizers ---
  const DEFAULT_BUDGET_CATEGORIES = useMemo(() => [
    // BASIC NEEDS
    { id: 'b1', groupId: 'basic', name: 'Flat rent', spendCap: 5500, mappedCategories: ['rent'] },
    { id: 'b2', groupId: 'basic', name: 'Water Bill', spendCap: 600, mappedCategories: ['water'] },
    { id: 'b3', groupId: 'basic', name: 'Electricity Bill', spendCap: 600, mappedCategories: ['electricity'] },
    { id: 'b4', groupId: 'basic', name: 'House Help Bill', spendCap: 2000, mappedCategories: ['maids'] },
    { id: 'b5', groupId: 'basic', name: 'Wifi Bill', spendCap: 1500, mappedCategories: ['internet'] },
    { id: 'b6', groupId: 'basic', name: 'Grossories', spendCap: 3000, mappedCategories: ['groceries'] },
    { id: 'b7', groupId: 'basic', name: 'Fuel', spendCap: 2000, mappedCategories: ['fuel'] },
    { id: 'b8', groupId: 'basic', name: 'Food', spendCap: 2000, mappedCategories: ['food'] },
    { id: 'b9', groupId: 'basic', name: 'Extra', spendCap: 800, mappedCategories: ['misc'] },

    // WANTS (Dynamic! Allocated dynamically based on actual wants expenses tracked)

    // SAVINGS
    { id: 's1', groupId: 'savings', name: 'Emergency Fund', spendCap: 10000, mappedCategories: ['Emergency Fund'] },
    { id: 's2', groupId: 'savings', name: 'Savings for short term expenses', spendCap: 5000, mappedCategories: ['Short Term Savings'] },
    { id: 's3', groupId: 'savings', name: 'Saving for long term expenses like house,car,bike,phone,etc', spendCap: 5000, mappedCategories: ['Long Term Savings'] },

    // INVESTMENTS
    { id: 'i1', groupId: 'investments', name: 'Stocks', spendCap: 0, mappedCategories: ['Stocks'] },
    { id: 'i2', groupId: 'investments', name: 'Mutual Fund', spendCap: 0, mappedCategories: ['Mutual Funds'] },
    { id: 'i3', groupId: 'investments', name: 'FD', spendCap: 0, mappedCategories: ['FD'] },
    { id: 'i4', groupId: 'investments', name: 'EPF', spendCap: 0, mappedCategories: ['EPF'] },

    // FAMILY CARE
    { id: 'f1', groupId: 'family', name: 'Send money to parents', spendCap: 30000, mappedCategories: ['gifts'] },

    // EXTRA
    { id: 'e1', groupId: 'extra', name: 'Extra', spendCap: 5000, mappedCategories: ['misc'] }
  ], []);

  const loadBudgetSettings = async () => {
    try {
      const dbIncome = await db.settings.get('budget_total_income');
      const dbPercentages = await db.settings.get('budget_group_percentages');
      const dbCategories = await db.settings.get('budget_categories');
      const dbMode = await db.settings.get('budget_type_mode');
      const dbWantsCap = await db.settings.get('budget_wants_collective_cap');
      const dbInvestCap = await db.settings.get('budget_invest_collective_cap');

      if (dbIncome) setBudgetTotalIncome(dbIncome.value);
      if (dbPercentages) setBudgetPercentages(dbPercentages.value);
      if (dbMode) setBudgetTypeMode(dbMode.value || 'fixed');
      if (dbWantsCap) setWantsCollectiveCap(dbWantsCap.value);
      if (dbInvestCap) setInvestmentsCollectiveCap(dbInvestCap.value);
      
      if (dbCategories && dbCategories.value && dbCategories.value.length > 0) {
        setBudgetCategories(dbCategories.value);
      } else {
        setBudgetCategories(DEFAULT_BUDGET_CATEGORIES);
        await db.settings.put({ id: 'budget_categories', value: DEFAULT_BUDGET_CATEGORIES });
      }
    } catch(err) {
      console.error('Error loading budget configurations:', err);
    }
  };

  const handleUpdateBudgetCategories = async (updated: typeof budgetCategories) => {
    setBudgetCategories(updated);
    await db.settings.put({ id: 'budget_categories', value: updated });
  };

  const handleUpdateBudgetPercentages = async (updated: typeof budgetPercentages) => {
    setBudgetPercentages(updated);
    await db.settings.put({ id: 'budget_group_percentages', value: updated });
  };

  const handleUpdateBudgetIncome = async (val: number) => {
    setBudgetTotalIncome(val);
    await db.settings.put({ id: 'budget_total_income', value: val });
  };

  const handleUpdateBudgetTypeMode = async (mode: 'fixed' | 'actual') => {
    setBudgetTypeMode(mode);
    await db.settings.put({ id: 'budget_type_mode', value: mode });
  };

  const handleUpdateWantsCap = async (val: number) => {
    setWantsCollectiveCap(val);
    await db.settings.put({ id: 'budget_wants_collective_cap', value: val });
  };

  const handleUpdateInvestmentsCap = async (val: number) => {
    setInvestmentsCollectiveCap(val);
    await db.settings.put({ id: 'budget_invest_collective_cap', value: val });
  };

  const handleResetBudgetDefaults = async () => {
    if (confirm('Are you sure you want to restore the default spreadsheet budget allocations and percentages? This will revert your customizations.')) {
      setBudgetTotalIncome(100000);
      const defaultPercs = { basic: 18, wants: 17, savings: 20, investments: 10, family: 30, extra: 5 };
      setBudgetPercentages(defaultPercs);
      setBudgetTypeMode('fixed');
      setWantsCollectiveCap(15000);
      setInvestmentsCollectiveCap(10000);
      setBudgetCategories(DEFAULT_BUDGET_CATEGORIES);

      await db.settings.put({ id: 'budget_total_income', value: 100000 });
      await db.settings.put({ id: 'budget_group_percentages', value: defaultPercs });
      await db.settings.put({ id: 'budget_type_mode', value: 'fixed' });
      await db.settings.put({ id: 'budget_wants_collective_cap', value: 15000 });
      await db.settings.put({ id: 'budget_invest_collective_cap', value: 10000 });
      await db.settings.put({ id: 'budget_categories', value: DEFAULT_BUDGET_CATEGORIES });
    }
  };

  // --- Category Customization Logic & Helpers ---
  const getCustomIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles': return Sparkles;
      case 'Coins': return Coins;
      case 'Briefcase': return Briefcase;
      case 'Gift': return Gift;
      case 'Heart': return Heart;
      case 'Trophy': return Trophy;
      case 'HelpCircle': return HelpCircle;
      case 'DollarSign': return DollarSign;
      case 'Wallet': return Wallet;
      case 'Utensils': return Utensils;
      case 'Home': return Home;
      case 'Car': return Car;
      case 'Gamepad': return Gamepad;
      case 'Laptop': return Laptop;
      case 'Dumbbell': return Dumbbell;
      case 'Coffee': return Coffee;
      case 'BookOpen': return BookOpen;
      default: return Sparkles;
    }
  };

  const allExpenseCategories = useMemo(() => {
    const customExps = customCategories
      .filter(c => c.type === 'expense')
      .map(c => {
        const IconComp = getCustomIconComponent(c.iconName);
        return { id: c.id, name: c.name, icon: IconComp, color: c.color, isCustom: true };
      });
    return [...EXPENSE_CATEGORIES.map(c => ({ ...c, isCustom: false })), ...customExps];
  }, [customCategories]);

  const allIncomeCategories = useMemo(() => {
    const customIncs = customCategories
      .filter(c => c.type === 'income')
      .map(c => {
        const IconComp = getCustomIconComponent(c.iconName);
        return { id: c.id, name: c.name, icon: IconComp, color: c.color, isCustom: true };
      });
    return [...INCOME_CATEGORIES.map(c => ({ ...c, isCustom: false })), ...customIncs];
  }, [customCategories]);

  const getExpenseIconLocal = (catId: string) => {
    const match = allExpenseCategories.find(c => c.id === catId);
    return match ? React.createElement(match.icon, { size: 16, style: { color: match.color } }) : <HelpCircle size={16} className="text-gray-400" />;
  };

  const getIncomeIconLocal = (catId: string) => {
    const match = allIncomeCategories.find(c => c.id === catId);
    return match ? React.createElement(match.icon, { size: 16, style: { color: match.color } }) : <HelpCircle size={16} className="text-gray-400" />;
  };

  const saveCustomCategories = async (updatedList: typeof customCategories) => {
    setCustomCategories(updatedList);
    await db.settings.put({ id: 'custom_finance_categories', value: updatedList });
  };
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newCatName.trim();
    if (!trimmedName) return;

    const nameLower = trimmedName.toLowerCase();
    // Validate if category already exists in standard or custom lists
    const existsInExpense = allExpenseCategories.some(c => c.name.toLowerCase() === nameLower);
    const existsInIncome = allIncomeCategories.some(c => c.name.toLowerCase() === nameLower);

    if (existsInExpense || existsInIncome) {
      setCatError(`Category "${trimmedName}" already exists! Please use a unique category name.`);
      return;
    }

    const newCat = {
      id: `custom_${Date.now()}`,
      name: trimmedName,
      type: newCatType,
      color: newCatColor,
      iconName: newCatIcon
    };

    const updated = [...customCategories, newCat];
    await saveCustomCategories(updated);
    setNewCatName('');
    setCatError('');
  };

  const handleDeleteCategory = async (id: string) => {
    const updated = customCategories.filter(cat => cat.id !== id);
    await saveCustomCategories(updated);
    if (catError) setCatError('');
  };

  const saveCustomBankAccounts = async (updatedList: typeof customBankAccounts) => {
    setCustomBankAccounts(updatedList);
    await db.settings.put({ id: 'custom_bank_accounts', value: updatedList });
    loadFinanceData();
  };

  const handleCreateBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newBankName.trim();
    const balance = parseFloat(newBankInitialBalance) || 0;
    if (!name) {
      setBankError('Bank account name is required.');
      return;
    }

    if (editingBankAccountId) {
      // Check duplicate (case-insensitive) excluding itself
      const exists = customBankAccounts.some(acc => acc.name.toLowerCase() === name.toLowerCase() && acc.id !== editingBankAccountId);
      if (exists) {
        setBankError(`A bank account named "${name}" already exists.`);
        return;
      }

      const updated = customBankAccounts.map(acc => acc.id === editingBankAccountId ? {
        ...acc,
        name,
        type: newBankType,
        initialBalance: balance
      } : acc);

      await saveCustomBankAccounts(updated);

      setEditingBankAccountId(null);
      setNewBankName('');
      setNewBankType('savings');
      setNewBankInitialBalance('');
      setBankError('');
    } else {
      // Check duplicate (case-insensitive)
      const exists = customBankAccounts.some(acc => acc.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        setBankError(`A bank account named "${name}" already exists.`);
        return;
      }

      const newAcc = {
        id: `bank_${Date.now()}`,
        name,
        type: newBankType,
        initialBalance: balance
      };

      const updated = [...customBankAccounts, newAcc];
      await saveCustomBankAccounts(updated);

      // Reset inputs
      setNewBankName('');
      setNewBankType('savings');
      setNewBankInitialBalance('');
      setBankError('');
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    if (customBankAccounts.length <= 1) {
      setBankError('Cannot delete the last remaining bank account. Add another account first.');
      return;
    }
    const updated = customBankAccounts.filter(acc => acc.id !== id);
    await saveCustomBankAccounts(updated);
    setBankError('');
  };

  // --- Dynamic Account Balances Calculus with custom multiple bank support ---
  const calculatedBalances = useMemo(() => {
    let cash = initialCashBalance;

    // Initialize all custom bank registers to their starting balances
    const banksMap: Record<string, number> = {};
    customBankAccounts.forEach(acc => {
      banksMap[acc.id] = acc.initialBalance;
    });

    const primaryId = customBankAccounts[0]?.id || 'bank_default';
    if (banksMap[primaryId] === undefined) {
      banksMap[primaryId] = initialBankBalance;
    }

    // Helper to safely add to a specific bank account with fallback to primary
    const addToBank = (bankId: string | undefined, amount: number) => {
      const target = bankId || primaryId;
      if (banksMap[target] !== undefined) {
        banksMap[target] += amount;
      } else {
        banksMap[primaryId] += amount;
      }
    };

    // Helper to safely subtract from a specific bank account with fallback to primary
    const subtractFromBank = (bankId: string | undefined, amount: number) => {
      const target = bankId || primaryId;
      if (banksMap[target] !== undefined) {
        banksMap[target] -= amount;
      } else {
        banksMap[primaryId] -= amount;
      }
    };

    // 1. Add Incomes
    incomes.forEach(i => {
      if (i.accountType === 'bank') {
        const iBankId = (i as any).bankAccountId;
        addToBank(iBankId, i.amount);
      } else if (i.accountType === 'cash') {
        cash += i.amount;
      }
    });

    // 2. Subtract Expenses
    expenses.forEach(e => {
      if (e.accountType === 'bank') {
        const eBankId = (e as any).bankAccountId;
        subtractFromBank(eBankId, e.amount);
      } else if (e.accountType === 'cash') {
        cash -= e.amount;
      }
    });

    // 3. Subtract Investments
    investments.forEach(inv => {
      if (inv.type !== 'EPF') {
        const invBankId = (inv as any).bankAccountId;
        subtractFromBank(invBankId, inv.amount);
      }
    });

    // 4. Transfers (Cash <-> Bank, Bank <-> Bank)
    transfers.forEach(t => {
      // Deduct from sender
      if (t.fromAccount === 'cash') {
        cash -= t.amount;
      } else if (t.fromAccount === 'bank') {
        // legacy compatibility
        subtractFromBank(primaryId, t.amount);
      } else {
        // Specific bank account ID
        subtractFromBank(t.fromAccount, t.amount);
      }

      // Add to receiver
      if (t.toAccount === 'cash') {
        cash += t.amount;
      } else if (t.toAccount === 'bank') {
        // legacy compatibility
        addToBank(primaryId, t.amount);
      } else {
        // Specific bank account ID
        addToBank(t.toAccount, t.amount);
      }
    });

    // 5. Money Lending
    lending.forEach(l => {
      if (l.returnedStatus === 'Pending') {
        if (l.accountType === 'bank') {
          const lendBankId = (l as any).bankAccountId;
          subtractFromBank(lendBankId, l.amount);
        } else if (l.accountType === 'cash') {
          cash -= l.amount;
        }
      }
    });

    // Aggregate primary bank amount as sum of all bank accounts
    const totalBank = Object.values(banksMap).reduce((sum, val) => sum + val, 0);

    return { bank: totalBank, cash, banks: banksMap };
  }, [incomes, expenses, investments, transfers, lending, initialBankBalance, initialCashBalance, customBankAccounts]);;

  // Credit Card Balance Calculation (Limit & Outstanding)
  const ccOutstandingTotal = useMemo(() => {
    return creditCards.reduce((acc, cc) => acc + (cc.balance || 0), 0);
  }, [creditCards]);

  // --- Today, Week, Month, Year Date Filters helper ---
  const isInRange = (dateStr: string, range: 'today' | 'week' | 'month' | 'year') => {
    const d = new Date(dateStr);
    const now = new Date();
    
    // Set hours to 0 to compare days properly
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const rowDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (range === 'today') {
      return rowDate.getTime() === startOfToday.getTime();
    }
    if (range === 'week') {
      const oneWeekAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
      return rowDate >= oneWeekAgo;
    }
    if (range === 'month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (range === 'year') {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // Filtered stats
  const rangeStats = useMemo(() => {
    const rangeIncomes = incomes.filter(i => isInRange(i.date, activeRange));
    const rangeExpenses = expenses.filter(e => isInRange(e.date, activeRange));
    const rangeInvestments = investments.filter(i => isInRange(i.date, activeRange));

    const totalIncome = rangeIncomes.reduce((acc, i) => acc + i.amount, 0);
    const totalExpense = rangeExpenses.reduce((acc, e) => acc + e.amount, 0);
    const totalInvestments = rangeInvestments.reduce((acc, i) => acc + i.amount, 0);

    // Sum deductible taxes and other items for Salary Gross computation
    const grossSalaryCompensation = rangeIncomes.reduce((acc, i) => {
      let extra = 0;
      if (i.isSalary) {
        i.deductions?.forEach(d => extra += (parseFloat(d.amount as any) || 0));
      }
      return acc + extra;
    }, 0);

    const cashFlow = totalIncome - totalExpense - totalInvestments;

    return {
      totalIncome,
      totalExpense,
      totalInvestments,
      cashFlow,
      grossIncome: totalIncome + grossSalaryCompensation,
      taxPaid: rangeIncomes.reduce((acc, i) => acc + (i.taxAmount || 0), 0)
    };
  }, [incomes, expenses, investments, activeRange]);

  // --- Category Distributions ---
  const categoryChartData = useMemo(() => {
    const distribution: Record<string, { name: string, amount: number, color: string }> = {};
    expenses.filter(e => isInRange(e.date, activeRange)).forEach(e => {
      const catInfo = allExpenseCategories.find(c => c.id === e.category) || { name: 'Miscellaneous', color: '#64748b' };
      if (!distribution[e.category]) {
        distribution[e.category] = { name: catInfo.name, amount: 0, color: catInfo.color };
      }
      distribution[e.category].amount += e.amount;
    });
    return Object.values(distribution).sort((a,b) => b.amount - a.amount);
  }, [expenses, activeRange, allExpenseCategories]);

  // --- Recharts Datasets for Visual Overviews ---
  const dashboardBarData = useMemo(() => {
    return [
      { name: 'Inflow', Amount: rangeStats.totalIncome, color: '#10b981' },
      { name: 'Outflows', Amount: rangeStats.totalExpense, color: '#ef4444' },
      { name: 'Invested', Amount: rangeStats.totalInvestments, color: '#eab308' }
    ];
  }, [rangeStats]);

  const creditCardsChartData = useMemo(() => {
    return creditCards.map(cc => ({
      name: cc.title,
      Debt: cc.balance || 0,
      Limit: cc.cardLimit || 0
    }));
  }, [creditCards]);

  const lendingComparisonData = useMemo(() => {
    let pending = 0;
    let returned = 0;
    lending.forEach(l => {
      if (l.returnedStatus === 'Returned') returned += l.amount;
      else pending += l.amount;
    });
    return [
      { name: 'Pending Recovery', value: pending, color: '#ef4444' },
      { name: 'Recovered Balance', value: returned, color: '#10b981' }
    ];
  }, [lending]);

  const assetsComparisonData = useMemo(() => {
    let bike = 0;
    let car = 0;
    let other = 0;
    assets.forEach(a => {
      if (a.type === 'Bike') bike += a.price;
      else if (a.type === 'Car') car += a.price;
      else other += a.price;
    });
    return [
      { name: 'Bike Valuation', value: bike, color: '#6366f1' },
      { name: 'Car Valuation', value: car, color: '#ec4899' },
      { name: 'Other Assets', value: other, color: '#fbbf24' }
    ].filter(item => item.value > 0);
  }, [assets]);

  // --- Submissions handlers & Add/Edit helpers ---

  const addCustomDeduction = () => {
    if (!customDeductName.trim()) return;
    const amt = parseFloat(customDeductAmount) || 0;
    if (amt <= 0) return;
    
    // check duplicate name
    if (incDeductions.some(d => d.name.toLowerCase() === customDeductName.trim().toLowerCase())) {
      alert("A deduction with this name already exists.");
      return;
    }

    setIncDeductions([...incDeductions, { name: customDeductName.trim(), amount: amt }]);
    setCustomDeductName('');
    setCustomDeductAmount('');
  };

  const removeDeduction = (index: number) => {
    setIncDeductions(incDeductions.filter((_, idx) => idx !== index));
  };

  const openAddIncomeModal = () => {
    setEditingIncomeId(null);
    setIncAmount('');
    setIncCategory('salary');
    setIncNote('');
    setIncAccount('bank');
    setIncIsSalary(false);
    setIncTax('0');
    setIncIsShift(false);
    setIncShiftPerDay('');
    setIncShiftExpected('');
    setIncShiftActualDays('');
    setCustomDeductName('');
    setCustomDeductAmount('');
    setIncDeductions([
      { name: 'EPF', amount: 0 },
      { name: 'Canteen Recovery', amount: 0 },
      { name: 'Transport Recovery', amount: 0 },
    ]);
    if (customBankAccounts.length > 0) {
      setIncBankAccountId(customBankAccounts[0].id);
    } else {
      setIncBankAccountId('bank_default');
    }
    setShowIncomeModal(true);
  };

  const openEditIncomeModal = (income: FinanceIncome) => {
    setEditingIncomeId(income.id);
    setIncAmount(income.amount.toString());
    setIncCategory(income.sourceCategory);
    setIncNote(income.note || '');
    setIncAccount(income.accountType);
    setIncBankAccountId(income.bankAccountId || 'bank_default');
    setIncIsSalary(income.isSalary || false);
    setIncTax('0');
    setIncIsShift(income.isShiftAllowance || false);
    setIncShiftPerDay(income.shiftPerDay?.toString() || '');
    setIncShiftExpected(income.expectedShiftDays?.toString() || '');
    setIncShiftActualDays(income.actualShiftDays?.toString() || '');
    setCustomDeductName('');
    setCustomDeductAmount('');
    if (income.deductions) {
      setIncDeductions(income.deductions);
    } else {
      setIncDeductions([
        { name: 'EPF', amount: 0 },
        { name: 'Canteen Recovery', amount: 0 },
        { name: 'Transport Recovery', amount: 0 },
      ]);
    }
    setShowIncomeModal(true);
  };

  const openAddExpenseModal = () => {
    setEditingExpenseId(null);
    setExpAmount('');
    setExpCategory('food');
    setExpClassification('basic');
    setExpNote('');
    setExpAccount('bank');
    setExpCCId(creditCards[0]?.id || '');
    if (customBankAccounts.length > 0) {
      setExpBankAccountId(customBankAccounts[0].id);
    } else {
      setExpBankAccountId('bank_default');
    }
    setShowExpenseModal(true);
  };

  const openEditExpenseModal = (expense: FinanceExpense) => {
    setEditingExpenseId(expense.id);
    setExpAmount(expense.amount.toString());
    setExpCategory(expense.category);
    setExpClassification(expense.classification || 'basic');
    setExpNote(expense.note || '');
    setExpAccount(expense.accountType);
    setExpCCId(expense.creditCardId || '');
    setExpBankAccountId(expense.bankAccountId || 'bank_default');
    setShowExpenseModal(true);
  };

  // Add/Edit Income
  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(incAmount) || 0;
    if (parsedAmount <= 0) return;

    let subdeductions: Array<{ name: string; amount: number }> = [];
    let netAmount = parsedAmount;

    if (incIsSalary) {
       subdeductions = incDeductions.map(d => ({ name: d.name, amount: parseFloat(d.amount as any) || 0 }));
    }

    let parsedShiftDays = 0;
    let parsedShiftPerDay = 0;
    let parsedExpected = 0;

    if (incIsShift) {
       parsedShiftDays = parseFloat(incShiftActualDays) || 0;
       parsedShiftPerDay = parseFloat(incShiftPerDay) || 0;
       parsedExpected = parseFloat(incShiftExpected) || 0;
    }

    const targetId = editingIncomeId || crypto.randomUUID();
    const original = editingIncomeId ? incomes.find(i => i.id === editingIncomeId) : null;
    const date = original ? original.date : new Date().toISOString().split('T')[0];

    const newIncome: FinanceIncome = {
      id: targetId,
      date: date,
      amount: netAmount,
      sourceCategory: incCategory,
      accountType: incAccount,
      bankAccountId: incAccount === 'bank' ? incBankAccountId : undefined,
      note: incNote,
      isSalary: incIsSalary,
      deductions: incIsSalary ? subdeductions : undefined,
      isShiftAllowance: incIsShift,
      shiftPerDay: incIsShift ? parsedShiftPerDay : undefined,
      expectedShiftDays: incIsShift ? parsedExpected : undefined,
      actualShiftDays: incIsShift ? parsedShiftDays : undefined
    };

    // Auto-update EPF Balance setting if it was deducted as EPF under salary
    if (incIsSalary) {
      const epfDeduction = subdeductions.find(d => d.name === 'EPF')?.amount || 0;
      if (epfDeduction > 0) {
        // Also enter/update EPF investment tracking!
        const existingEPF = await db.financeInvestments
          .filter(inv => inv.date === date && inv.note === 'Auto salary deduction contribution')
          .first();
        if (existingEPF) {
          await db.financeInvestments.update(existingEPF.id, { amount: epfDeduction });
        } else {
          const investmentRecord: FinanceInvestment = {
            id: crypto.randomUUID(),
            date: date,
            amount: epfDeduction,
            type: 'EPF',
            note: 'Auto salary deduction contribution'
          };
          await db.financeInvestments.add(investmentRecord);
        }
      }
    }

    if (editingIncomeId) {
      await db.financeIncomes.put(newIncome);
    } else {
      await db.financeIncomes.add(newIncome);
    }

    setShowIncomeModal(false);
    setEditingIncomeId(null);
    
    // Clear forms
    setIncAmount('');
    setIncCategory('salary');
    setIncNote('');
    setIncIsSalary(false);
    setIncTax('0');
    setIncIsShift(false);
    setIncShiftPerDay('');
    setIncShiftExpected('');
    setIncShiftActualDays('');
    setCustomDeductName('');
    setCustomDeductAmount('');

    loadFinanceData();
  };

  // Add/Edit Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(expAmount) || 0;
    if (parsedAmount <= 0) return;

    const expenseId = editingExpenseId || crypto.randomUUID();
    const isCc = expAccount === 'credit_card';

    if (isCc && !expCCId) {
      setExpError("Please select a Credit Card.");
      return;
    }
    setExpError('');

    const original = editingExpenseId ? expenses.find(e => e.id === editingExpenseId) : null;
    const date = original ? original.date : new Date().toISOString().split('T')[0];

    const newExpense: FinanceExpense = {
      id: expenseId,
      date: date,
      amount: parsedAmount,
      category: expCategory,
      accountType: expAccount,
      bankAccountId: expAccount === 'bank' ? expBankAccountId : undefined,
      creditCardId: isCc ? expCCId : undefined,
      classification: expClassification,
      note: expNote
    };

    if (editingExpenseId && original) {
      // Revert original CC impact
      if (original.accountType === 'credit_card' && original.creditCardId) {
        const card = await db.financeCreditCards.get(original.creditCardId);
        if (card) {
          await db.financeCreditCards.update(original.creditCardId, { balance: Math.max(0, (card.balance || 0) - original.amount) });
        }
      }
    }

    if (isCc) {
      // Increase Card balance
      const card = await db.financeCreditCards.get(expCCId);
      if (card) {
        await db.financeCreditCards.update(expCCId, { balance: (card.balance || 0) + parsedAmount });
      }
    }

    if (editingExpenseId) {
      await db.financeExpenses.put(newExpense);
    } else {
      await db.financeExpenses.add(newExpense);
    }

    setShowExpenseModal(false);
    setEditingExpenseId(null);
    
    // Clear Form
    setExpAmount('');
    setExpCategory('food');
    setExpClassification('basic');
    setExpNote('');
    loadFinanceData();
  };

  // Add Credit Card
  const handleAddCC = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLimit = parseFloat(ccLimit) || 0;
    const parsedBal = parseFloat(ccBalance) || 0;
    if (!ccTitle || parsedLimit <= 0) return;

    const card: FinanceCreditCard = {
      id: crypto.randomUUID(),
      title: ccTitle,
      cardLimit: parsedLimit,
      balance: parsedBal
    };

    await db.financeCreditCards.add(card);
    setCcTitle('');
    setCcLimit('');
    setCcBalance('0');
    setShowCCModal(false);
    loadFinanceData();
  };

  // Adjust Starting Balance Submission
  const handleAdjustOpenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(adjustOpenValue) || 0;
    if (adjustOpenAccount === 'bank') {
      setInitialBankBalance(val);
      await db.settings.put({ id: 'initial_bank_balance', value: val });
    } else {
      setInitialCashBalance(val);
      await db.settings.put({ id: 'initial_cash_balance', value: val });
    }
    setShowAdjustOpenModal(false);
    loadFinanceData();
  };

  // Pay CC Bill
  const handlePayCC = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(payCCAmount) || 0;
    if (!payCCId || parsedAmount <= 0) return;

    const card = creditCards.find(c => c.id === payCCId);
    if (!card) return;

    // Deduct Balance on Card
    await db.financeCreditCards.update(payCCId, { balance: Math.max(0, (card.balance || 0) - parsedAmount) });

    // Enter as standard payment expense out or track it
    const expenseEntry: FinanceExpense = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      amount: parsedAmount,
      category: 'loan_emi',
      accountType: payCCSource,
      bankAccountId: payCCSource === 'bank' ? payCCBankAccountId : undefined,
      note: `CC Bill Payment: ${card.title}`
    };
    await db.financeExpenses.add(expenseEntry);

    setPayCCId('');
    setPayCCAmount('');
    setShowPayCCModal(false);
    loadFinanceData();
  };

  // Lending
  const handleAddLending = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(lendAmount) || 0;
    if (!lendPerson || parsedAmount <= 0) return;

    const record: FinanceLending = {
      id: crypto.randomUUID(),
      personName: lendPerson,
      amount: parsedAmount,
      dateGiven: new Date().toISOString().split('T')[0],
      returnedStatus: 'Pending',
      accountType: lendAccount,
      bankAccountId: lendAccount === 'bank' ? lendBankAccountId : undefined
    };

    await db.financeLending.add(record);
    setLendPerson('');
    setLendAmount('');
    setShowLendingModal(false);
    loadFinanceData();
  };

  // Mark Lending returned
  const toggleLendReturned = async (item: FinanceLending) => {
    const updatedStatus = item.returnedStatus === 'Pending' ? 'Returned' : 'Pending';
    const returnDate = updatedStatus === 'Returned' ? new Date().toISOString().split('T')[0] : undefined;
    
    await db.financeLending.update(item.id, {
      returnedStatus: updatedStatus,
      returnedDate: returnDate
    });

    // Create mutual transaction return as income if returned
    if (updatedStatus === 'Returned') {
      const incomeEntry: FinanceIncome = {
        id: crypto.randomUUID(),
        date: returnDate!,
        amount: item.amount,
        sourceCategory: 'lending_return',
        accountType: item.accountType,
        bankAccountId: item.accountType === 'bank' ? item.bankAccountId : undefined,
        note: `Payment returned by ${item.personName}`
      };
      await db.financeIncomes.add(incomeEntry);
    }

    loadFinanceData();
  };

  // Add Asset
  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseFloat(assetPrice) || 0;
    if (!assetName || parsedPrice <= 0) return;

    const record: FinanceAsset = {
      id: crypto.randomUUID(),
      name: assetName,
      type: assetType,
      price: parsedPrice
    };

    await db.financeAssets.add(record);
    setAssetName('');
    setAssetPrice('');
    setShowAssetModal(false);
    loadFinanceData();
  };

  // Add Insurance
  const handleAddInsurance = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPremium = parseFloat(insPremium) || 0;
    if (!insName || parsedPremium <= 0) return;

    const record: FinanceInsurance = {
      id: crypto.randomUUID(),
      name: insName,
      premium: parsedPremium,
      term: insTerm,
      active: true
    };

    await db.financeInsurance.add(record);
    setInsName('');
    setInsPremium('');
    setShowInsuranceModal(false);
    loadFinanceData();
  };

  // Direct Transfer bank/cash
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(transAmount) || 0;
    if (parsedAmount <= 0 || transFrom === transTo) return;

    const record: FinanceTransfer = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      amount: parsedAmount,
      fromAccount: transFrom,
      toAccount: transTo
    };

    await db.financeTransfers.add(record);
    setTransAmount('');
    setShowTransferModal(false);
    loadFinanceData();
  };

  // Direct update EPF current Balance
  const handleSetEPFBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(epfInput) || 0;
    await db.settings.put({ id: 'initial_epf_balance', value: val });
    await db.settings.put({ id: 'epf_balance', value: val + totalSalariedEPFDeductions * 2 });
    setInitialEpfBalance(val);
    setEpfInput('');
    setShowEPFBalanceModal(false);
    loadFinanceData();
  };

  // Total investment assets (excluding EPF to prevent double counting since epfBalance is rendered/added explicitly)
  const totalInvestAssets = useMemo(() => {
    const invSum = investments.filter(i => i.type !== 'EPF').reduce((acc, i) => acc + i.amount, 0);
    return invSum + epfBalance;
  }, [investments, epfBalance]);

  // Propagate balances to parent sticky header
  useEffect(() => {
    if (onBalancesChange) {
      onBalancesChange({
        bank: calculatedBalances.bank,
        cash: calculatedBalances.cash,
        debt: ccOutstandingTotal,
        investments: totalInvestAssets,
        initialBank: initialBankBalance,
        initialCash: initialCashBalance,
        epfBalance: epfBalance,
        banks: calculatedBalances.banks,
        customBankAccounts: customBankAccounts
      } as any);
    }
  }, [calculatedBalances, ccOutstandingTotal, totalInvestAssets, initialBankBalance, initialCashBalance, epfBalance, onBalancesChange, customBankAccounts]);

  // Synchronize dynamic binders when customBankAccounts updates
  useEffect(() => {
    if (customBankAccounts.length > 0) {
      const firstId = customBankAccounts[0].id;
      setIncBankAccountId(prev => customBankAccounts.some(acc => acc.id === prev) ? prev : firstId);
      setExpBankAccountId(prev => customBankAccounts.some(acc => acc.id === prev) ? prev : firstId);
      setPayCCBankAccountId(prev => customBankAccounts.some(acc => acc.id === prev) ? prev : firstId);
      setLendBankAccountId(prev => customBankAccounts.some(acc => acc.id === prev) ? prev : firstId);
      setInvestBankAccountId(prev => customBankAccounts.some(acc => acc.id === prev) ? prev : firstId);
      
      setTransFrom(prev => (prev === 'cash' || customBankAccounts.some(acc => acc.id === prev)) ? prev : 'cash');
      setTransTo(prev => (prev === 'cash' || customBankAccounts.some(acc => acc.id === prev)) ? prev : firstId);
    }
  }, [customBankAccounts]);

  // Listen to remote actions from top sticky header
  useEffect(() => {
    const handleAdjustOpen = (e: Event) => {
      const customEvent = e as CustomEvent;
      const account = customEvent.detail?.account || 'bank';
      setAdjustOpenAccount(account);
      setAdjustOpenValue(account === 'bank' ? initialBankBalance.toString() : initialCashBalance.toString());
      setShowAdjustOpenModal(true);
    };

    const handleManageEPF = () => {
      setShowEPFBalanceModal(true);
    };

    const handleOpenBanks = () => {
      setShowBankAccountsModal(true);
    };

    window.addEventListener('finance-adjust-open', handleAdjustOpen);
    window.addEventListener('finance-manage-epf', handleManageEPF);
    window.addEventListener('finance-open-banks', handleOpenBanks);
    return () => {
      window.removeEventListener('finance-adjust-open', handleAdjustOpen);
      window.removeEventListener('finance-manage-epf', handleManageEPF);
      window.removeEventListener('finance-open-banks', handleOpenBanks);
    };
  }, [initialBankBalance, initialCashBalance]);

  // Clean-up actions for debug/reset
  const deleteIncome = async (id: string) => {
    await db.financeIncomes.delete(id);
    loadFinanceData();
  };

  const deleteExpense = async (id: string) => {
    const record = expenses.find(e => e.id === id);
    if (record && record.accountType === 'credit_card' && record.creditCardId) {
      const card = creditCards.find(c => c.id === record.creditCardId);
      if (card) {
        await db.financeCreditCards.update(record.creditCardId, { balance: Math.max(0, card.balance - record.amount) });
      }
    }
    await db.financeExpenses.delete(id);
    loadFinanceData();
  };

  // Deductions gross computation display helper
  const workingGross = useMemo(() => {
    const net = parseFloat(incAmount) || 0;
    const extra = incIsSalary ? incDeductions.reduce((sum, d) => sum + (parseFloat(d.amount as any) || 0), 0) : 0;
    return net + extra;
  }, [incAmount, incIsSalary, incDeductions]);

  // --- Budget Live Monthly Real-Time Calculations ---
  
  // Available months list for selection dropdown
  const budgetAvailableMonths = useMemo(() => {
    const list = new Set<string>();
    
    // Add current month
    const d = new Date();
    const currentYYYYMM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    list.add(currentYYYYMM);
    
    // Scan all incomes & expenses
    incomes.forEach(inc => {
      if (inc.date && inc.date.length >= 7) {
        list.add(inc.date.substring(0, 7));
      }
    });
    expenses.forEach(exp => {
      if (exp.date && exp.date.length >= 7) {
        list.add(exp.date.substring(0, 7));
      }
    });

    const sorted = Array.from(list).sort((a, b) => b.localeCompare(a)); // Newest first
    return sorted;
  }, [incomes, expenses]);

  // Actual income received in the selected month
  const budgetActualIncome = useMemo(() => {
    return incomes
      .filter(inc => inc.date && inc.date.startsWith(budgetSelectedMonth))
      .reduce((sum, inc) => sum + inc.amount, 0);
  }, [incomes, budgetSelectedMonth]);

  // Effective anchor base income to calculate rupees off percentages
  const effectiveBaseIncome = useMemo(() => {
    if (budgetTypeMode === 'actual') {
      return budgetActualIncome > 0 ? budgetActualIncome : budgetTotalIncome;
    }
    return budgetTotalIncome;
  }, [budgetTypeMode, budgetActualIncome, budgetTotalIncome]);

  // Actual spend computed for each budget category
  const budgetActualSpends = useMemo(() => {
    const spends: { [categoryId: string]: number } = {};
    
    // Dynamic wants categories for this selected month based on actual tracking classified as 'wants'
    const wantsExpensesForMonth = expenses.filter(e => {
      const isThisMonth = e.date && e.date.startsWith(budgetSelectedMonth);
      const isExplicitWant = e.classification === 'wants';
      return isThisMonth && isExplicitWant;
    });
    
    const uniqueWantsCategoryIds = Array.from(new Set(wantsExpensesForMonth.map(e => e.category)));
    const dynamicWantsCats = uniqueWantsCategoryIds.map(cId => ({
      id: cId,
      groupId: 'wants',
      name: cId,
      spendCap: 0,
      mappedCategories: [cId],
      noteFilter: ''
    }));

    // Merge static budgetCategories + dynamically generated wants categories
    const allCatsToCompute = [
      ...budgetCategories,
      ...dynamicWantsCats
    ];
    
    allCatsToCompute.forEach(cat => {
      let spentSum = 0;

      // 1. Scan expenses
      expenses.forEach(e => {
        if (!e.date || !e.date.startsWith(budgetSelectedMonth)) return;
        
        // Direct category ID match
        const hasDirectCat = cat.mappedCategories.includes(e.category);
        
        // Note keyword filter (case insensitive)
        const matchesNote = cat.noteFilter && e.note && e.note.toLowerCase().includes(cat.noteFilter.toLowerCase());
        
        if (hasDirectCat || matchesNote) {
          if (cat.groupId === 'wants') {
            // Only aggregate if expense is explicitly classified as a want
            if (e.classification === 'wants') {
              spentSum += e.amount;
            }
          } else {
            // For other groups, if explicitly classified, match must be exact, else fallback to default category mapping
            if (e.classification) {
              if (e.classification === cat.groupId) {
                spentSum += e.amount;
              }
            } else {
              spentSum += e.amount;
            }
          }
        }
      });

      // 2. Scan investments (for savings or investments groups)
      if (cat.groupId === 'investments' || cat.groupId === 'savings') {
        investments.forEach(inv => {
          if (!inv.date || !inv.date.startsWith(budgetSelectedMonth)) return;
          
          let matches = false;
          // Match by investment type or custom tags
          const invType = inv.type.toLowerCase();
          const matchesType = cat.mappedCategories.some(cId => invType.includes(cId.toLowerCase()) || cId.toLowerCase().includes(invType));
          const matchesNote = cat.noteFilter && inv.note && inv.note.toLowerCase().includes(cat.noteFilter.toLowerCase());
          
          if (matchesType || matchesNote) {
            matches = true;
          }
          
          if (matches) {
            spentSum += inv.amount;
          }
        });
      }

      // 3. Scan transfers (transfers from specific sources to savings, etc)
      transfers.forEach(t => {
        if (!t.date || !t.date.startsWith(budgetSelectedMonth)) return;
        
        let matches = false;
        // Check if category note filter is present and matches the transfer note
        const matchesNote = cat.noteFilter && t.note && t.note.toLowerCase().includes(cat.noteFilter.toLowerCase());
        
        // Match specific transfers for family parent support
        if (cat.groupId === 'family') {
          if (t.note && t.note.toLowerCase().includes('parent')) {
            matches = true;
          }
        }
        
        // Match savings transfers
        if (cat.groupId === 'savings') {
          if (t.toAccount && t.toAccount.toLowerCase().includes('save')) {
            matches = true;
          }
        }

        if (matchesNote || matches) {
          spentSum += t.amount;
        }
      });

      spends[cat.id] = spentSum;
    });

    return spends;
  }, [budgetCategories, expenses, investments, transfers, budgetSelectedMonth]);

  // Overall balance validation
  const totalPercentageAllocated = useMemo(() => {
    return (
      (budgetPercentages.basic || 0) +
      (budgetPercentages.wants || 0) +
      (budgetPercentages.savings || 0) +
      (budgetPercentages.investments || 0) +
      (budgetPercentages.family || 0) +
      (budgetPercentages.extra || 0)
    );
  }, [budgetPercentages]);

  const autoBalancePercentages = () => {
    const total = totalPercentageAllocated;
    if (total === 0) return;
    const factor = 100 / total;
    const balanced = {
      basic: Math.round((budgetPercentages.basic || 0) * factor),
      wants: Math.round((budgetPercentages.wants || 0) * factor),
      savings: Math.round((budgetPercentages.savings || 0) * factor),
      investments: Math.round((budgetPercentages.investments || 0) * factor),
      family: Math.round((budgetPercentages.family || 0) * factor),
      extra: Math.round((budgetPercentages.extra || 0) * factor),
    };
    
    // Assure exact 100% due to rounding
    const newTotal = balanced.basic + balanced.wants + balanced.savings + balanced.investments + balanced.family + balanced.extra;
    if (newTotal !== 100) {
      balanced.extra += (100 - newTotal);
    }
    handleUpdateBudgetPercentages(balanced);
  };

  const handlePercentageChange = (group: keyof typeof budgetPercentages, val: number) => {
    const updated = { ...budgetPercentages, [group]: val };
    handleUpdateBudgetPercentages(updated);
  };

  // Check mismatch shift allowance
  const shiftWarningText = useMemo(() => {
    if (!incIsShift) return null;
    const perDay = parseFloat(incShiftPerDay) || 0;
    const days = parseFloat(incShiftActualDays) || 0;
    const expected = parseFloat(incShiftExpected) || 0;
    const calc = perDay * days;
    if (expected !== calc) {
      return `Warning: Shift allowance amount didn't match! Expected ₹${calc.toLocaleString('en-IN')} (actual worked ${days} days x ₹${perDay}/day) but expected amount requested is ₹${expected.toLocaleString('en-IN')}.`;
    }
    return null;
  }, [incIsShift, incShiftPerDay, incShiftActualDays, incShiftExpected]);

  return (
    <div className="space-y-6 pb-24">
      {/* Header and Filter Option */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter text-yellow-500 uppercase flex items-center gap-2">
            <Coins className="text-yellow-500" size={28} />
            FINANCE
          </h2>
        </div>

        {/* Filters and Sub-Nav */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100/90 p-1.5 rounded-[20px] shadow-[inset_2px_2px_5px_rgba(148,163,184,0.18),_inset_-2px_-2px_5px_rgba(255,255,255,0.8)] border border-slate-200/60 self-start">
          {(['dashboard', 'budget', 'transactions', 'credit', 'lending', 'assets'] as const).map((sub) => (
            <button
              key={sub}
              onClick={() => setSubSection(sub)}
              className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer active:scale-95 ${
                subSection === sub 
                  ? 'bg-yellow-500 text-white border border-white/25 shadow-[0_4px_10px_rgba(234,179,8,0.35),_inset_-3px_-3px_6px_rgba(0,0,0,0.15),_inset_3px_3px_6px_rgba(255,255,255,0.35)]' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Workspaces */}
      <AnimatePresence mode="wait">
        {subSection === 'dashboard' && (
          <motion.div
            key="dash-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Quick Actions Panel */}
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={openAddIncomeModal}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-[0_5px_12px_rgba(16,185,129,0.35),_inset_-3px_-3px_6px_rgba(0,0,0,0.4),_inset_3px_3px_6px_rgba(255,255,255,0.3)] border border-white/10"
              >
                <Plus size={14} className="stroke-[3px]" /> Add Income
              </button>
              <button
                type="button"
                onClick={openAddExpenseModal}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white cursor-pointer rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-[0_5px_12px_rgba(239,68,68,0.35),_inset_-3px_-3px_6px_rgba(0,0,0,0.4),_inset_3px_3px_6px_rgba(255,255,255,0.3)] border border-white/10"
              >
                <Plus size={14} className="stroke-[3px]" /> Add Expense
              </button>
              <button
                type="button"
                onClick={() => setShowTransferModal(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-[0_5px_12px_rgba(59,130,246,0.35),_inset_-3px_-3px_6px_rgba(0,0,0,0.4),_inset_3px_3px_6px_rgba(255,255,255,0.3)] border border-white/10"
              >
                <ArrowLeftRight size={14} className="stroke-[3px]" /> Self Transfer
              </button>
              <button
                type="button"
                onClick={() => setShowCategoryManagerModal(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black cursor-pointer rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-[0_5px_12px_rgba(245,158,11,0.35),_inset_-3px_-3px_6px_rgba(0,0,0,0.4),_inset_3px_3px_6px_rgba(255,255,255,0.35)] border border-white/15"
              >
                <Sparkles size={14} className="stroke-[3px]" /> Setup categories
              </button>
            </div>

            {/* Range statistical filtering */}
            <div className="clay-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm uppercase tracking-widest text-[#ececf1]">Cash Flow & Summary</h3>
                <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 shadow-[inset_1.5px_1.5px_3px_rgba(148,163,184,0.18),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.8)]">
                  {(['today', 'week', 'month', 'year'] as const).map(range => (
                    <button
                      key={range}
                      onClick={() => setActiveRange(range)}
                      className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        activeRange === range 
                          ? 'bg-yellow-500 text-white shadow-[0_2px_6px_rgba(245,158,11,0.2),_inset_-1.5px_-1.5px_3.5px_rgba(0,0,0,0.15),_inset_1.5px_1.5px_3.5px_rgba(255,255,255,0.35)]' 
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid of details for this range */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4.5 clay-inset-panel-deep space-y-1.5 hover:scale-102 transition-all">
                  <span className="text-[8px] font-black uppercase text-emerald-400 tracking-wider">Range Net Inflow</span>
                  <div className="text-xl font-black text-[#ececf1]">₹{rangeStats.totalIncome.toLocaleString('en-IN')}</div>
                  <span className="text-[7.5px] text-gray-500 block">Gross Estimated: ₹{rangeStats.grossIncome.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-4.5 clay-inset-panel-deep space-y-1.5 hover:scale-102 transition-all">
                  <span className="text-[8px] font-black uppercase text-red-400 tracking-wider">Range Outflows</span>
                  <div className="text-xl font-black text-red-400">₹{rangeStats.totalExpense.toLocaleString('en-IN')}</div>
                </div>
                <div className="p-4.5 clay-inset-panel-deep space-y-1.5 hover:scale-102 transition-all">
                  <span className="text-[8px] font-black uppercase text-amber-400 tracking-wider">Range Invested</span>
                  <div className="text-xl font-black text-amber-400">₹{rangeStats.totalInvestments.toLocaleString('en-IN')}</div>
                </div>
                <div className="p-4.5 clay-inset-panel-deep space-y-1.5 hover:scale-102 transition-all">
                  <span className="text-[8px] font-black uppercase text-blue-400 tracking-wider">Active Cash Flow</span>
                  <div className={`text-xl font-black ${rangeStats.cashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {rangeStats.cashFlow >= 0 ? '+' : ''}₹{rangeStats.cashFlow.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Visual Insights Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Flow Overview Chart */}
                <div className="p-5 rounded-3xl bg-gray-950/40 border border-white/5 space-y-3 flex flex-col justify-between">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest block">Flow Comparisons</span>
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardBarData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        <XAxis dataKey="name" tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatIndianCurrency} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1.5px solid rgba(226, 232, 240, 0.95)', borderRadius: '16px', fontSize: '10px', boxShadow: '0 8px 24px rgba(148, 163, 184, 0.15)', color: '#1e293b' }}
                          labelStyle={{ color: '#475569', fontWeight: 'bold' }}
                          itemStyle={{ color: '#d97706' }}
                          cursor={{ fill: 'rgba(148,163,184,0.06)' }}
                          formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Amount']}
                        />
                        <Bar dataKey="Amount" radius={[8, 8, 0, 0]}>
                          {dashboardBarData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Expenses Breakdown Pie */}
                <div className="p-5 rounded-3xl bg-gray-950/40 border border-white/5 space-y-3 flex flex-col justify-between">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest block font-bold">Category Contributions</span>
                  {categoryChartData.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center">
                      <p className="text-xs text-gray-600 italic">No expenses reported within this frame.</p>
                    </div>
                  ) : (
                    <div className="w-full h-64 flex flex-col justify-center">
                      <ResponsiveContainer width="100%" height="90%">
                        <PieChart>
                          <Pie
                            data={categoryChartData.map(c => ({ name: c.name, value: c.amount, color: c.color }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {categoryChartData.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1.5px solid rgba(226, 232, 240, 0.95)', borderRadius: '16px', fontSize: '10px', boxShadow: '0 8px 24px rgba(148, 163, 184, 0.15)', color: '#1e293b' }}
                            itemStyle={{ color: '#1e293b', fontSize: '11px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-2 justify-center max-h-16 overflow-y-auto mt-2 custom-scrollbar">
                        {categoryChartData.slice(0, 5).map((c, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-[8.5px] font-bold text-gray-400 uppercase">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                            <span>{c.name}</span>
                          </div>
                        ))}
                        {categoryChartData.length > 5 && (
                          <div className="text-[8.5px] font-bold text-gray-500 uppercase">
                            + {categoryChartData.length - 5} More
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Categories split distributions list */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Range Expenses Distribution</h4>
                {categoryChartData.length === 0 ? (
                  <p className="text-xs text-gray-600 italic">No expenses reported within this frame.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categoryChartData.map(c => {
                      const percentage = Math.round((c.amount / rangeStats.totalExpense) * 100) || 0;
                      return (
                        <div key={c.name} className="p-3 rounded-2xl bg-gray-950/20 border border-white/5 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-300">{c.name}</span>
                            <span className="text-xs font-black text-gray-100">₹{c.amount.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-4">
                            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: c.color }} />
                            </div>
                            <span className="text-[10px] font-bold text-gray-500 shrink-0">{percentage}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {subSection === 'budget' && (
          <motion.div
            key="budget-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6 animate-fade-in"
          >
            {/* Header / Intro Card */}
            <div className="clay-card p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-black italic tracking-tighter text-yellow-500 uppercase flex items-center gap-2">
                    <Sliders className="text-yellow-500 shrink-0" size={24} />
                    Auto-Allocating Budget Planner & Distribution Sheet
                  </h3>
                  <p className="text-xs text-gray-400 font-medium">
                    Set your custom monthly anchor budget goals and distribute expenses dynamically by percentage splits. Track actual expenditures in real time.
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleResetBudgetDefaults}
                    className="px-3.5 py-1.5 rounded-xl text-[10px] bg-red-650 hover:bg-red-500 text-white font-black uppercase tracking-widest transition-all shrink-0 flex items-center gap-1.5 shadow-[0_4px_10px_rgba(239,68,68,0.25),_inset_-2px_-2px_4px_rgba(0,0,0,0.4),_inset_2px_2px_4px_rgba(255,255,255,0.2)] border border-white/10 cursor-pointer active:scale-95"
                  >
                    <RefreshCw size={11} className="shrink-0" />
                    Reset to Defaults
                  </button>

                  {/* Month Selection */}
                  <div className="flex items-center gap-1.5 bg-[#0a0a0f] px-3.5 py-1.5 rounded-xl border border-white/5 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                    <Calendar size={12} className="text-gray-400" />
                    <select
                      className="bg-transparent text-[11px] text-gray-200 outline-none font-black uppercase tracking-wider cursor-pointer"
                      value={budgetSelectedMonth}
                      onChange={(e) => setBudgetSelectedMonth(e.target.value)}
                    >
                      {budgetAvailableMonths.map(mon => {
                        const [yyyy, mm] = mon.split('-');
                        const dStr = new Date(parseInt(yyyy), parseInt(mm)-1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        return (
                          <option key={mon} value={mon} className="bg-[#0f0f12] text-white">
                            {dStr}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Top Configuration Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Anchor Income Configuration */}
                <div className="bg-gray-950/45 border border-white/5 p-5 rounded-3xl space-y-4">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">1. Anchor Monthly Income</span>
                  
                  <div className="space-y-3">
                    <div className="flex gap-1.5 p-1 bg-black/40 rounded-xl border border-gray-800">
                      <button
                        onClick={() => handleUpdateBudgetTypeMode('fixed')}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                          budgetTypeMode === 'fixed'
                            ? 'bg-yellow-500 text-black'
                            : 'text-gray-500'
                        }`}
                      >
                        Fixed Target Limit
                      </button>
                      <button
                        onClick={() => handleUpdateBudgetTypeMode('actual')}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                          budgetTypeMode === 'actual'
                            ? 'bg-yellow-500 text-black'
                            : 'text-gray-400'
                        }`}
                      >
                        Selected Month Actuals
                      </button>
                    </div>

                    {budgetTypeMode === 'fixed' ? (
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-500 font-bold block uppercase">Fixed Monthly Target (₹)</label>
                        <div className="flex items-center gap-2 bg-black/45 border border-gray-850 rounded-xl px-3 py-2">
                          <span className="text-gray-400 font-bold">₹</span>
                          <input
                            type="number"
                            className="bg-transparent text-sm text-gray-200 outline-none w-full font-black"
                            value={budgetTotalIncome}
                            onChange={(e) => handleUpdateBudgetIncome(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <span className="text-[9px] text-gray-500 font-bold block uppercase">Actual Inflow for {budgetSelectedMonth}</span>
                        <div className="bg-black/25 rounded-xl p-3 border border-emerald-500/10">
                          <div className="text-xl font-black text-emerald-400">₹{budgetActualIncome.toLocaleString('en-IN')}</div>
                          <span className="text-[9px] text-gray-500 font-bold block mt-1">Loaded from actual transaction records</span>
                        </div>
                      </div>
                    )}

                    <div className="p-3 bg-white/5 rounded-xl text-[10px] text-gray-400 line-clamp-2">
                      Using <strong className="text-yellow-500 font-black">₹{effectiveBaseIncome.toLocaleString('en-IN')}</strong> as the divisor anchor for all percentage distribution calculations.
                    </div>
                  </div>
                </div>

                {/* Percentage Sliders Controller */}
                <div className="clay-card lg:col-span-2 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <span className="text-xs font-black uppercase text-gray-100 tracking-wider block">2. Distribution Split Proportions</span>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                      totalPercentageAllocated === 100 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.05)]' 
                        : 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.05)] animate-pulse'
                    }`}>
                      Sum: {totalPercentageAllocated}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-4">
                      {/* Basic Needs */}
                      <div className="p-3 bg-[#0a0a0f]/40 rounded-2xl border border-white/5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.02)] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-300">Basic Needs (Food, Rent, utilities)</span>
                          <span className="font-black text-gray-400 text-[10px]">(₹{Math.round(effectiveBaseIncome * (budgetPercentages.basic || 0) / 100).toLocaleString('en-IN')})</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => handlePercentageChange('basic', Math.max(0, (budgetPercentages.basic || 0) - 1))}
                            className="w-8 h-8 rounded-xl bg-gray-900 border border-white/5 text-gray-400 font-bold flex items-center justify-center hover:bg-gray-800 hover:text-white active:scale-90 transition-all shadow-[0_2px_5px_rgba(0,0,0,0.3),_inset_1px_1px_2px_rgba(255,255,255,0.1)] cursor-pointer select-none"
                          >
                            -
                          </button>
                          <div className="flex-1 flex items-center gap-1.5 bg-[#08080c] border border-white/5 rounded-xl px-2.5 py-1.5 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] focus-within:border-yellow-500/40">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={budgetPercentages.basic || 0}
                              onChange={(e) => handlePercentageChange('basic', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                              className="bg-transparent text-xs text-gray-200 outline-none w-full font-black border-0 p-0 focus:ring-0 focus:outline-none text-center font-mono"
                            />
                            <span className="text-gray-500 text-xs font-bold shrink-0">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePercentageChange('basic', Math.min(100, (budgetPercentages.basic || 0) + 1))}
                            className="w-8 h-8 rounded-xl bg-gray-900 border border-white/5 text-gray-400 font-bold flex items-center justify-center hover:bg-gray-800 hover:text-white active:scale-90 transition-all shadow-[0_2px_5px_rgba(0,0,0,0.3),_inset_1px_1px_2px_rgba(255,255,255,0.1)] cursor-pointer select-none"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Wants */}
                      <div className="p-3 bg-[#0a0a0f]/40 rounded-2xl border border-white/5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.02)] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-300">Wants (Eating out, Subscriptions)</span>
                          <span className="font-black text-gray-400 text-[10px]">(₹{Math.round(effectiveBaseIncome * (budgetPercentages.wants || 0) / 100).toLocaleString('en-IN')})</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => handlePercentageChange('wants', Math.max(0, (budgetPercentages.wants || 0) - 1))}
                            className="w-8 h-8 rounded-xl bg-gray-900 border border-white/5 text-gray-400 font-bold flex items-center justify-center hover:bg-gray-800 hover:text-white active:scale-90 transition-all shadow-[0_2px_5px_rgba(0,0,0,0.3),_inset_1px_1px_2px_rgba(255,255,255,0.1)] cursor-pointer select-none"
                          >
                            -
                          </button>
                          <div className="flex-1 flex items-center gap-1.5 bg-[#08080c] border border-white/5 rounded-xl px-2.5 py-1.5 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] focus-within:border-yellow-500/40">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={budgetPercentages.wants || 0}
                              onChange={(e) => handlePercentageChange('wants', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                              className="bg-transparent text-xs text-gray-200 outline-none w-full font-black border-0 p-0 focus:ring-0 focus:outline-none text-center font-mono"
                            />
                            <span className="text-gray-500 text-xs font-bold shrink-0">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePercentageChange('wants', Math.min(100, (budgetPercentages.wants || 0) + 1))}
                            className="w-8 h-8 rounded-xl bg-gray-900 border border-white/5 text-gray-400 font-bold flex items-center justify-center hover:bg-gray-800 hover:text-white active:scale-90 transition-all shadow-[0_2px_5px_rgba(0,0,0,0.3),_inset_1px_1px_2px_rgba(255,255,255,0.1)] cursor-pointer select-none"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Savings */}
                      <div className="p-3 bg-[#0a0a0f]/40 rounded-2xl border border-white/5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.02)] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-300">Savings (Emergency, short/long-term)</span>
                          <span className="font-black text-gray-400 text-[10px]">(₹{Math.round(effectiveBaseIncome * (budgetPercentages.savings || 0) / 100).toLocaleString('en-IN')})</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => handlePercentageChange('savings', Math.max(0, (budgetPercentages.savings || 0) - 1))}
                            className="w-8 h-8 rounded-xl bg-gray-900 border border-white/5 text-gray-400 font-bold flex items-center justify-center hover:bg-gray-800 hover:text-white active:scale-90 transition-all shadow-[0_2px_5px_rgba(0,0,0,0.3),_inset_1px_1px_2px_rgba(255,255,255,0.1)] cursor-pointer select-none"
                          >
                            -
                          </button>
                          <div className="flex-1 flex items-center gap-1.5 bg-[#08080c] border border-white/5 rounded-xl px-2.5 py-1.5 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] focus-within:border-yellow-500/40">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={budgetPercentages.savings || 0}
                              onChange={(e) => handlePercentageChange('savings', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                              className="bg-transparent text-xs text-gray-200 outline-none w-full font-black border-0 p-0 focus:ring-0 focus:outline-none text-center font-mono"
                            />
                            <span className="text-gray-500 text-xs font-bold shrink-0">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePercentageChange('savings', Math.min(100, (budgetPercentages.savings || 0) + 1))}
                            className="w-8 h-8 rounded-xl bg-gray-900 border border-white/5 text-gray-400 font-bold flex items-center justify-center hover:bg-gray-800 hover:text-white active:scale-90 transition-all shadow-[0_2px_5px_rgba(0,0,0,0.3),_inset_1px_1px_2px_rgba(255,255,255,0.1)] cursor-pointer select-none"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Investments */}
                      <div className="p-3 bg-[#0a0a0f]/40 rounded-2xl border border-white/5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.02)] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-300">Investments (Stocks, EPF, Mutual Funds)</span>
                          <span className="font-black text-gray-400 text-[10px]">(₹{Math.round(effectiveBaseIncome * (budgetPercentages.investments || 0) / 100).toLocaleString('en-IN')})</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => handlePercentageChange('investments', Math.max(0, (budgetPercentages.investments || 0) - 1))}
                            className="w-8 h-8 rounded-xl bg-gray-900 border border-white/5 text-gray-400 font-bold flex items-center justify-center hover:bg-gray-800 hover:text-white active:scale-90 transition-all shadow-[0_2px_5px_rgba(0,0,0,0.3),_inset_1px_1px_2px_rgba(255,255,255,0.1)] cursor-pointer select-none"
                          >
                            -
                          </button>
                          <div className="flex-1 flex items-center gap-1.5 bg-[#08080c] border border-white/5 rounded-xl px-2.5 py-1.5 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] focus-within:border-yellow-500/40">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={budgetPercentages.investments || 0}
                              onChange={(e) => handlePercentageChange('investments', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                              className="bg-transparent text-xs text-gray-200 outline-none w-full font-black border-0 p-0 focus:ring-0 focus:outline-none text-center font-mono"
                            />
                            <span className="text-gray-500 text-xs font-bold shrink-0">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePercentageChange('investments', Math.min(100, (budgetPercentages.investments || 0) + 1))}
                            className="w-8 h-8 rounded-xl bg-gray-900 border border-white/5 text-gray-400 font-bold flex items-center justify-center hover:bg-gray-800 hover:text-white active:scale-90 transition-all shadow-[0_2px_5px_rgba(0,0,0,0.3),_inset_1px_1px_2px_rgba(255,255,255,0.1)] cursor-pointer select-none"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Family Support */}
                      <div className="p-3 bg-[#0a0a0f]/40 rounded-2xl border border-white/5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.02)] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-300">Family Care (Sending to Parents)</span>
                          <span className="font-black text-gray-400 text-[10px]">(₹{Math.round(effectiveBaseIncome * (budgetPercentages.family || 0) / 100).toLocaleString('en-IN')})</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => handlePercentageChange('family', Math.max(0, (budgetPercentages.family || 0) - 1))}
                            className="w-8 h-8 rounded-xl bg-gray-900 border border-white/5 text-gray-400 font-bold flex items-center justify-center hover:bg-gray-800 hover:text-white active:scale-90 transition-all shadow-[0_2px_5px_rgba(0,0,0,0.3),_inset_1px_1px_2px_rgba(255,255,255,0.1)] cursor-pointer select-none"
                          >
                            -
                          </button>
                          <div className="flex-1 flex items-center gap-1.5 bg-[#08080c] border border-white/5 rounded-xl px-2.5 py-1.5 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] focus-within:border-yellow-500/40">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={budgetPercentages.family || 0}
                              onChange={(e) => handlePercentageChange('family', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                              className="bg-transparent text-xs text-gray-200 outline-none w-full font-black border-0 p-0 focus:ring-0 focus:outline-none text-center font-mono"
                            />
                            <span className="text-gray-500 text-xs font-bold shrink-0">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePercentageChange('family', Math.min(100, (budgetPercentages.family || 0) + 1))}
                            className="w-8 h-8 rounded-xl bg-gray-900 border border-white/5 text-gray-400 font-bold flex items-center justify-center hover:bg-gray-800 hover:text-white active:scale-90 transition-all shadow-[0_2px_5px_rgba(0,0,0,0.3),_inset_1px_1px_2px_rgba(255,255,255,0.1)] cursor-pointer select-none"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Extra Buffer */}
                      <div className="p-3 bg-[#0a0a0f]/40 rounded-2xl border border-white/5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.02)] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-300">Extra Buffer / Others</span>
                          <span className="font-black text-gray-400 text-[10px]">(₹{Math.round(effectiveBaseIncome * (budgetPercentages.extra || 0) / 100).toLocaleString('en-IN')})</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => handlePercentageChange('extra', Math.max(0, (budgetPercentages.extra || 0) - 1))}
                            className="w-8 h-8 rounded-xl bg-gray-900 border border-white/5 text-gray-400 font-bold flex items-center justify-center hover:bg-gray-800 hover:text-white active:scale-90 transition-all shadow-[0_2px_5px_rgba(0,0,0,0.3),_inset_1px_1px_2px_rgba(255,255,255,0.1)] cursor-pointer select-none"
                          >
                            -
                          </button>
                          <div className="flex-1 flex items-center gap-1.5 bg-[#08080c] border border-white/5 rounded-xl px-2.5 py-1.5 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] focus-within:border-yellow-500/40">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={budgetPercentages.extra || 0}
                              onChange={(e) => handlePercentageChange('extra', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                              className="bg-transparent text-xs text-gray-200 outline-none w-full font-black border-0 p-0 focus:ring-0 focus:outline-none text-center font-mono"
                            />
                            <span className="text-gray-500 text-xs font-bold shrink-0">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePercentageChange('extra', Math.min(100, (budgetPercentages.extra || 0) + 1))}
                            className="w-8 h-8 rounded-xl bg-gray-900 border border-white/5 text-gray-400 font-bold flex items-center justify-center hover:bg-gray-800 hover:text-white active:scale-90 transition-all shadow-[0_2px_5px_rgba(0,0,0,0.3),_inset_1px_1px_2px_rgba(255,255,255,0.1)] cursor-pointer select-none"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                {totalPercentageAllocated !== 100 && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 flex items-center justify-between gap-4 transition-all">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle size={14} className="shrink-0 text-red-400 animate-pulse" />
                        <span>Allocations total {totalPercentageAllocated}% instead of exactly 100%.</span>
                      </div>
                      <button
                        onClick={autoBalancePercentages}
                        className="px-2.5 py-1 rounded bg-red-500 text-black font-black uppercase tracking-wider text-[8.5px] hover:bg-white transition-all whitespace-nowrap shrink-0"
                      >
                        ⚡ Snap to 100%
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Main Sheet Cards Roster */}
            <div className="space-y-6">
              
              {(['basic', 'wants', 'savings', 'investments', 'family', 'extra'] as const).map(gId => {
                const groupPercentage = budgetPercentages[gId] || 0;
                const groupAllocation = Math.round(effectiveBaseIncome * groupPercentage / 100);
                
                let groupCats = [];
                if (gId === 'wants') {
                  const wantsExpensesForMonth = expenses.filter(e => {
                    const isThisMonth = e.date && e.date.startsWith(budgetSelectedMonth);
                    const isExplicitWant = e.classification === 'wants';
                    return isThisMonth && isExplicitWant;
                  });
                  const uniqueWantsCategoryIds = Array.from(new Set(wantsExpensesForMonth.map(e => e.category)));
                  groupCats = uniqueWantsCategoryIds.map(cId => {
                    const matched = EXPENSE_CATEGORIES.find(e => e.id === cId) || customCategories.find(cc => cc.id === cId);
                    const catName = matched ? matched.name : (cId.charAt(0).toUpperCase() + cId.slice(1));
                    return {
                      id: cId,
                      groupId: 'wants' as any,
                      name: catName,
                      spendCap: 0,
                      mappedCategories: [cId]
                    };
                  });
                } else {
                  groupCats = budgetCategories.filter(c => c.groupId === gId);
                }
                
                let groupSpendCapTotal = 0;
                if (gId === 'wants') {
                  groupSpendCapTotal = wantsCollectiveCap;
                } else if (gId === 'investments') {
                  groupSpendCapTotal = investmentsCollectiveCap;
                } else {
                  groupSpendCapTotal = groupCats.reduce((acc, c) => acc + c.spendCap, 0);
                }

                const groupActualTotal = groupCats.reduce((acc, c) => acc + (budgetActualSpends[c.id] || 0), 0);
                const groupSavedTotal = groupSpendCapTotal - groupActualTotal;
                const groupPercentSpent = groupSpendCapTotal > 0 ? (groupActualTotal / groupSpendCapTotal) : 0;
                
                const titleMap = {
                  basic: { title: 'Basic Needs', desc: 'Housing lease, fuel, electricity, internet, wifi, maid salaries and food', color: 'border-l-blue-500 text-blue-400' },
                  wants: { title: 'Wants & Comforts', desc: 'Dine-outs, events, transport cabs, salon grooming, cosmetics and personal shopping (Shares collective cap)', color: 'border-l-pink-500 text-pink-400' },
                  savings: { title: 'Savings', desc: 'Emergency funds, short-term expenses and safe multi-year target reserves', color: 'border-l-emerald-500 text-emerald-400' },
                  investments: { title: 'Investments Block', desc: 'Active Stock lines, FD reserves, PF allocations and Mutual units (Shares collective cap)', color: 'border-l-yellow-500 text-yellow-400' },
                  family: { title: 'Family Care', desc: 'Direct support checks and gifts routed safely to parents', color: 'border-l-violet-500 text-violet-400' },
                  extra: { title: 'Extra Buffer', desc: 'Unplanned generic buffer limits for direct unexpected contingencies', color: 'border-l-cyan-500 text-cyan-400' }
                };

                return (
                  <div key={gId} className={`bg-[#0f0f12]/95 rounded-3xl border border-gray-800 p-6 space-y-4 border-l-4 ${titleMap[gId].color.split(' ')[0]}`}>
                    
                    {/* Header line of Group */}
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-gray-800 pb-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-black uppercase tracking-wider text-gray-200">
                            {titleMap[gId].title} <span className="text-gray-500 font-extrabold">({groupPercentage}%)</span>
                          </h4>
                          <span className="px-2 py-0.5 rounded-lg bg-yellow-500/10 text-[9.5px] font-black text-yellow-500 tracking-wider">
                            Allocated: ₹{groupAllocation.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-semibold">{titleMap[gId].desc}</p>
                      </div>

                      {/* Group aggregate values */}
                      <div className="flex flex-wrap items-center gap-3 text-xs font-black">
                        <div className="bg-black/45 px-3 py-1.5 rounded-xl border border-gray-800">
                          <span className="text-[8.5px] text-gray-500 block uppercase font-bold tracking-wider">Collective Cap</span>
                          {gId === 'wants' ? (
                            <div className="flex items-center gap-1 font-black">
                              <span className="text-yellow-500 font-bold">₹</span>
                              <input
                                type="number"
                                className="bg-transparent border-0 font-extrabold w-16 text-yellow-500 text-xs focus:ring-0 focus:outline-none"
                                value={wantsCollectiveCap}
                                onChange={(e) => handleUpdateWantsCap(parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          ) : gId === 'investments' ? (
                            <div className="flex items-center gap-1 font-black">
                              <span className="text-yellow-500 font-bold">₹</span>
                              <input
                                type="number"
                                className="bg-transparent border-0 font-extrabold w-16 text-yellow-500 text-xs focus:ring-0 focus:outline-none"
                                value={investmentsCollectiveCap}
                                onChange={(e) => handleUpdateInvestmentsCap(parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          ) : (
                            <span className="text-gray-200 font-black">₹{groupSpendCapTotal.toLocaleString('en-IN')}</span>
                          )}
                        </div>

                        <div className="bg-black/45 px-3 py-1.5 rounded-xl border border-gray-800">
                          <span className="text-[8.5px] text-gray-500 block uppercase font-bold tracking-wider">Actual Spent</span>
                          <span className="text-red-400 font-black">₹{groupActualTotal.toLocaleString('en-IN')}</span>
                        </div>

                        <div className="bg-[#10b981]/10 px-3 py-1.5 rounded-xl border border-[#10b981]/20">
                          <span className="text-[8.5px] text-[#10b981]/60 block uppercase font-bold tracking-wider">Expected Saved</span>
                          <span className={`font-black ${groupSavedTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {groupSavedTotal >= 0 ? '+' : ''}₹{groupSavedTotal.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Add category helper */}
                        <button
                          onClick={() => {
                            setEditingBudgetCategory({
                              groupId: gId,
                              name: '',
                              spendCap: 0,
                              mappedCategories: []
                            });
                            setShowBudgetCategoryModal(true);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-yellow-500/10 hover:bg-yellow-500 text-yellow-400 hover:text-black font-extrabold text-[10px] uppercase tracking-widest transition-all shrink-0 flex items-center gap-1"
                        >
                          <Plus size={12} className="shrink-0" />
                          Add Node
                        </button>
                      </div>
                    </div>

                    {/* Progress tracking gauge for group */}
                    <div className="bg-black/20 p-3 rounded-2xl border border-white/5 space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400 font-semibold uppercase tracking-wider text-[8px]">Group Cap Consumption Gauge:</span>
                        <span className={`font-black uppercase text-[9px] ${groupActualTotal > groupSpendCapTotal ? 'text-red-400' : 'text-gray-300'}`}>
                          {Math.round(groupPercentSpent * 100)}% Spent
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            groupActualTotal > groupSpendCapTotal ? 'bg-red-500' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.round(groupPercentSpent * 100))}%` }}
                        />
                      </div>
                    </div>

                    {/* Desktop spreadsheet row mapping */}
                    <div className="overflow-x-auto custom-scrollbar pt-1">
                      <table className="w-full text-left text-xs text-gray-300 min-w-[700px]">
                        <thead>
                          <tr className="border-b border-gray-800 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                            <th className="py-2.5 pb-3">Distribution Node Item</th>
                            <th className="py-2.5 pb-3">Mapped actual category keys</th>
                            <th className="py-2.5 pb-3 w-32">Configured Spend Cap</th>
                            <th className="py-2.5 pb-3">Actual Spent this Month</th>
                            <th className="py-2.5 pb-3">Saved Amount</th>
                            <th className="py-2.5 pb-3 text-right w-24">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/40">
                          {groupCats.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-6 text-xs text-gray-500 italic">
                                No custom mapped categories assigned into this segment. Click "Add Category" above to initialize.
                              </td>
                            </tr>
                          ) : (
                            groupCats.map(cat => {
                              const spent = budgetActualSpends[cat.id] || 0;
                              const hasIndivCap = gId !== 'wants' && gId !== 'investments';
                              const saved = hasIndivCap ? (cat.spendCap - spent) : null;
                              
                              return (
                                <tr key={cat.id} className="hover:bg-gray-950/20 group transition-colors">
                                  {/* Title / Name */}
                                  <td className="py-3.5 font-bold text-gray-200">
                                    <div className="flex flex-col">
                                      <span>{cat.name}</span>
                                      {cat.noteFilter && (
                                        <span className="text-[9px] text-[#fbbf24]/50 italic font-semibold mt-0.5">Filter word match: "{cat.noteFilter}"</span>
                                      )}
                                    </div>
                                  </td>
                                  
                                  {/* Mappings pills */}
                                  <td className="py-3.5 pr-2">
                                    <div className="flex flex-wrap gap-1">
                                      {cat.mappedCategories.length === 0 && !cat.noteFilter ? (
                                        <span className="text-[8px] text-red-500/80 font-black uppercase bg-red-500/10 px-1.5 py-0.5 rounded">Unmapped Key</span>
                                      ) : (
                                        cat.mappedCategories.map(cId => {
                                          const matched = EXPENSE_CATEGORIES.find(e => e.id === cId) || customCategories.find(cc => cc.id === cId);
                                          return (
                                            <span key={cId} className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700/30">
                                              {matched ? matched.name : cId}
                                            </span>
                                          );
                                        })
                                      )}
                                    </div>
                                  </td>

                                  {/* Inline Editable Cap input */}
                                  <td className="py-3.5">
                                    {hasIndivCap ? (
                                      <div className="flex items-center gap-1 bg-black/40 border border-gray-800 rounded-xl px-2 py-1 max-w-[110px] hover:border-gray-700 transition-all focus-within:border-yellow-500/50">
                                        <span className="text-gray-500 text-[10px] font-bold">₹</span>
                                        <input
                                          type="number"
                                          className="bg-transparent text-xs text-white outline-none w-full font-black border-0 p-0 focus:ring-0 focus:outline-none"
                                          value={cat.spendCap}
                                          onChange={(e) => {
                                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                                            const updated = budgetCategories.map(c => c.id === cat.id ? { ...c, spendCap: val } : c);
                                            handleUpdateBudgetCategories(updated);
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-gray-600 text-[9px] font-bold uppercase tracking-wide bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">Shared cap</span>
                                    )}
                                  </td>

                                  {/* Actual Spent */}
                                  <td className="py-3.5 font-bold text-gray-200">
                                    <div className="flex items-center gap-2">
                                      <span>₹{spent.toLocaleString('en-IN')}</span>
                                      {hasIndivCap && cat.spendCap > 0 && (
                                        <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded-lg ${
                                          spent > cat.spendCap ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-gray-800/80 text-gray-500'
                                        }`}>
                                          {Math.round((spent / cat.spendCap) * 100)}%
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Saved */}
                                  <td className="py-3.5">
                                    {saved !== null ? (
                                      <span className={`font-black text-xs ${saved >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {saved >= 0 ? '+' : ''}₹{saved.toLocaleString('en-IN')}
                                      </span>
                                    ) : (
                                      <span className="text-gray-600 text-[10px] italic">Not applicable</span>
                                    )}
                                  </td>

                                  {/* Row triggers setup */}
                                  <td className="py-3.5 text-right font-bold uppercase text-[9px] tracking-wide">
                                    {gId === 'wants' ? (
                                      <span className="text-[8px] font-black uppercase text-pink-400 bg-pink-500/10 border border-pink-500/15 px-2 py-1 rounded-lg">
                                        Auto-derived
                                      </span>
                                    ) : (
                                      <div className="flex items-center justify-end gap-1 px-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => {
                                            setEditingBudgetCategory({
                                              id: cat.id,
                                              groupId: cat.groupId,
                                              name: cat.name,
                                              spendCap: cat.spendCap,
                                              mappedCategories: cat.mappedCategories,
                                              noteFilter: cat.noteFilter
                                            });
                                            setShowBudgetCategoryModal(true);
                                          }}
                                          title="Configure Mapping / Filter Keys"
                                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-yellow-500 hover:text-black text-gray-400 transition-all"
                                        >
                                          <Edit2 size={11} className="shrink-0" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (confirm(`Delete the budget allocation node "${cat.name}"?`)) {
                                              const updated = budgetCategories.filter(c => c.id !== cat.id);
                                              handleUpdateBudgetCategories(updated);
                                            }
                                          }}
                                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-500 hover:text-white text-gray-400 transition-all"
                                        >
                                          <Trash2 size={11} className="shrink-0" />
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

            </div>
          </motion.div>
        )}

        {subSection === 'transactions' && (
          <motion.div
            key="trans-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Ledger views */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Incomes records list */}
              <div className="bg-[#0f0f12] rounded-3xl border border-gray-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#ececf1] flex items-center gap-1.5 text-emerald-400">
                    <TrendingUp size={16} /> Incomes Ledger
                  </h3>
                  <span className="text-[9px] text-gray-600 uppercase font-bold">{incomes.length} records</span>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {incomes.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-8">No income recorded.</p>
                  ) : (
                    incomes.slice().reverse().map(i => (
                      <div key={i.id} className="p-3 bg-gray-950/20 border border-white/5 rounded-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 rounded-xl bg-white/5 shrink-0">
                            {getIncomeIconLocal(i.sourceCategory)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-gray-200 uppercase tracking-tight truncate">
                              {allIncomeCategories.find(cat => cat.id === i.sourceCategory)?.name || i.sourceCategory}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 text-[8px] font-bold text-gray-500 uppercase tracking-tighter">
                              <span>{i.date}</span>
                              <span>•</span>
                              <span className="text-gray-400">{i.accountType}</span>
                              {i.isSalary && <span className="bg-emerald-500/20 text-emerald-400 px-1 rounded">salary</span>}
                              {i.isShiftAllowance && <span className="bg-blue-500/20 text-blue-400 px-1 rounded">shift</span>}
                            </div>
                            {i.note && <p className="text-[9px] text-gray-400 mt-1 italic shrink-0 truncate max-w-xs">{i.note}</p>}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs font-black text-emerald-400 leading-none block">₹{i.amount.toLocaleString('en-IN')}</span>
                            {i.isSalary && (
                              <span className="text-[7.5px] font-bold text-gray-600 block">Gross ₹{((parseFloat(i.amount as any) || 0) + (i.deductions?.reduce((acc, d) => acc + (parseFloat(d.amount as any) || 0), 0) || 0)).toLocaleString('en-IN')}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => openEditIncomeModal(i)} className="text-gray-600 hover:text-blue-400 transition-colors p-1" title="Edit Income">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => deleteIncome(i.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1" title="Delete Income">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Expenses records list */}
              <div className="bg-[#0f0f12] rounded-3xl border border-gray-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#ececf1] flex items-center gap-1.5 text-red-400">
                    <TrendingDown size={16} /> Outflows Ledger
                  </h3>
                  <span className="text-[9px] text-gray-600 uppercase font-bold">{expenses.length} records</span>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {expenses.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-8">No expenses recorded.</p>
                  ) : (
                    expenses.slice().reverse().map(e => (
                      <div key={e.id} className="p-3 bg-gray-950/20 border border-white/5 rounded-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 rounded-xl bg-white/5 shrink-0">
                            {getExpenseIconLocal(e.category)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-gray-200 uppercase tracking-tight truncate">
                              {allExpenseCategories.find(cat => cat.id === e.category)?.name || e.category}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 text-[8px] font-bold text-gray-500 uppercase tracking-tighter">
                              <span>{e.date}</span>
                              <span>•</span>
                              <span className="text-gray-400">{e.accountType === 'credit_card' ? 'cc' : e.accountType}</span>
                              {e.note && <span className="truncate max-w-xs text-gray-600">({e.note})</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-red-400 leading-none">₹{e.amount.toLocaleString('en-IN')}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => openEditExpenseModal(e)} className="text-gray-600 hover:text-blue-400 transition-colors p-1" title="Edit Expense">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => deleteExpense(e.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1" title="Delete Expense">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {subSection === 'credit' && (
          <motion.div
            key="credit-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            <div className="flex gap-2">
              <button
                onClick={() => setShowCCModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Plus size={14} /> Register New CC
              </button>
              {creditCards.length > 0 && (
                <button
                  onClick={() => setShowPayCCModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <CreditCard size={14} /> Pay Card Bill
                </button>
              )}
            </div>

            {creditCards.length > 0 && (
              <div className="bg-[#0f0f12]/80 border border-gray-800 rounded-3xl p-5 space-y-3">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest block font-bold">Outstanding Debt vs Approved Limit</span>
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={creditCardsChartData} barGap={8} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6e6e73', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatIndianCurrency} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1.5px solid rgba(226, 232, 240, 0.95)', borderRadius: '16px', fontSize: '10px', boxShadow: '0 8px 24px rgba(148, 163, 184, 0.15)', color: '#1e293b' }}
                        labelStyle={{ color: '#475569', fontWeight: 'bold' }}
                        cursor={{ fill: 'rgba(148,163,184,0.06)' }}
                        formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`]}
                      />
                      <Bar dataKey="Limit" fill="#1e3a8a" radius={[6, 6, 0, 0]} name="Approved Limit" barSize={32} />
                      <Bar dataKey="Debt" fill="#ef4444" radius={[6, 6, 0, 0]} name="Outstanding Debt" barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Credit Cards list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {creditCards.length === 0 ? (
                <div className="sm:col-span-2 text-center p-8 bg-[#0f0f12] rounded-3xl border border-gray-800">
                  <p className="text-xs text-gray-500 italic">No credit cards configured.</p>
                </div>
              ) : (
                creditCards.map(cc => {
                  const utilization = cc.cardLimit > 0 ? Math.round((cc.balance / cc.cardLimit) * 100) : 0;
                  return (
                    <div key={cc.id} className="bg-[#0f0f12] border border-gray-800 rounded-3xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="text-yellow-500" size={18} />
                          <h4 className="font-bold text-sm uppercase text-[#ececf1]">{cc.title}</h4>
                        </div>
                        <button 
                          onClick={async () => {
                            if (confirm(`Remove card detail for ${cc.title}?`)) {
                              await db.financeCreditCards.delete(cc.id);
                              loadFinanceData();
                            }
                          }}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[8px] font-black uppercase text-gray-500 tracking-wider">Outstanding Outstanding Debt</span>
                          <p className="text-base font-black text-red-400">₹{cc.balance.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <span className="text-[8px] font-black uppercase text-gray-500 tracking-wider">Available Limit</span>
                          <p className="text-base font-black text-emerald-400">₹{(cc.cardLimit - cc.balance).toLocaleString('en-IN')}</p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[8px] font-black text-gray-500 uppercase tracking-widest">
                          <span>Limit Utilization</span>
                          <span>{utilization}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${utilization > 80 ? 'bg-red-500' : 'bg-yellow-500'}`} 
                            style={{ width: `${utilization}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}

        {subSection === 'lending' && (
          <motion.div
            key="lend-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            <button
              onClick={() => setShowLendingModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <Plus size={14} /> Record Lend Amount
            </button>

            {lending.length > 0 && (
              <div className="bg-[#0f0f12]/80 border border-gray-800 rounded-3xl p-5 space-y-3">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest block font-bold">Lending Recovery Analytics</span>
                <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
                  <div className="w-full max-w-[200px] h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={lendingComparisonData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {lendingComparisonData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1.5px solid rgba(226, 232, 240, 0.95)', borderRadius: '16px', fontSize: '10px', boxShadow: '0 8px 24px rgba(148, 163, 184, 0.15)', color: '#1e293b' }}
                          itemStyle={{ color: '#1e293b', fontSize: '11px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {lendingComparisonData.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-xs font-black text-gray-300 uppercase tracking-tight">{d.name}:</span>
                        <span className="text-xs font-black text-white">₹{d.value.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Lending records directory */}
            <div className="bg-[#0f0f12] rounded-3xl border border-gray-800 p-5 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-yellow-500">Money Lending Register</h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {lending.length === 0 ? (
                  <p className="text-xs text-gray-500 italic text-center py-8">No active loans or credits recorded.</p>
                ) : (
                  lending.map(item => (
                    <div key={item.id} className="p-3 bg-gray-950/20 border border-white/5 rounded-2xl flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-black text-gray-200 uppercase tracking-tight">{item.personName}</h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[8px] font-bold text-gray-500 uppercase tracking-tighter">
                          <span>Given: {item.dateGiven}</span>
                          <span>•</span>
                          <span>Source: {item.accountType}</span>
                          {item.returnedDate && <span className="text-emerald-400">Returned: {item.returnedDate}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-black ${item.returnedStatus === 'Returned' ? 'text-gray-500 line-through' : 'text-red-400'}`}>
                          ₹{item.amount.toLocaleString('en-IN')}
                        </span>
                        
                        <button
                          onClick={() => toggleLendReturned(item)}
                          className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                            item.returnedStatus === 'Returned' 
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-gray-800 border border-emerald-500/15'
                              : 'bg-red-500/10 text-red-400 hover:bg-emerald-500/10 hover:text-emerald-400 border border-red-500/15'
                          }`}
                        >
                          {item.returnedStatus === 'Returned' ? 'Returned ✓' : 'Pending ⏱'}
                        </button>

                        <button 
                          onClick={async () => {
                            if (confirm(`Delete record?`)) {
                              await db.financeLending.delete(item.id);
                              loadFinanceData();
                            }
                          }}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {subSection === 'assets' && (
          <motion.div
            key="assets-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            <div className="flex gap-2">
              <button
                onClick={() => setShowAssetModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Plus size={14} /> Add Asset Value
              </button>
              <button
                onClick={() => setShowInsuranceModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#06b6d4]/10 border border-[#06b6d4]/20 text-[#06b6d4] hover:bg-[#06b6d4]/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Plus size={14} /> Track Insurance
              </button>
            </div>

            {assets.length > 0 && (
              <div className="bg-[#0f0f12]/80 border border-gray-800 rounded-3xl p-5 space-y-3">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest block font-bold">Asset Type Distribution</span>
                <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
                  <div className="w-full max-w-[200px] h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={assetsComparisonData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {assetsComparisonData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1.5px solid rgba(226, 232, 240, 0.95)', borderRadius: '16px', fontSize: '10px', boxShadow: '0 8px 24px rgba(148, 163, 184, 0.15)', color: '#1e293b' }}
                          itemStyle={{ color: '#1e293b', fontSize: '11px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {assetsComparisonData.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-xs font-black text-gray-300 uppercase tracking-tight">{d.name}:</span>
                        <span className="text-xs font-black text-white">₹{d.value.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assets Roster */}
              <div className="bg-[#0f0f12] rounded-3xl border border-gray-800 p-5 space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-[#ececf1] flex items-center gap-1.5">
                  <Scale size={16} className="text-yellow-500" /> Physical Assets Valuation
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {assets.length === 0 ? (
                    <p className="text-xs text-gray-500 italic text-center py-8">No assets recorded.</p>
                  ) : (
                    assets.map(item => (
                      <div key={item.id} className="p-3 bg-gray-950/20 border border-white/5 rounded-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-yellow-500/10 text-yellow-400 rounded-xl">
                            {item.type === 'Bike' ? <Bike size={16} /> : item.type === 'Car' ? <Car size={16} /> : <FileText size={16} />}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-gray-200 uppercase tracking-tight">{item.name}</h4>
                            <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">{item.type}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-yellow-500">₹{item.price.toLocaleString('en-IN')}</span>
                          <button 
                            onClick={async () => {
                              if (confirm(`Remove ${item.name}?`)) {
                                await db.financeAssets.delete(item.id);
                                loadFinanceData();
                              }
                            }}
                            className="text-gray-600 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Insurances roster */}
              <div className="bg-[#0f0f12] rounded-3xl border border-gray-800 p-5 space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-[#ececf1] flex items-center gap-1.5">
                  <Shield size={16} className="text-cyan-400" /> Active Insurance Policies
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {insurances.length === 0 ? (
                    <p className="text-xs text-gray-500 italic text-center py-8">No policies registered.</p>
                  ) : (
                    insurances.map(item => (
                      <div key={item.id} className="p-3 bg-gray-950/20 border border-white/5 rounded-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
                            <Shield size={16} />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-gray-200 uppercase tracking-tight">{item.name}</h4>
                            <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">{item.term} billing</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs font-black text-cyan-400 block">₹{item.premium.toLocaleString('en-IN')}</span>
                            <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-widest">Active</span>
                          </div>
                          <button 
                            onClick={async () => {
                              if (confirm(`Remove policy ${item.name}?`)) {
                                await db.financeInsurance.delete(item.id);
                                loadFinanceData();
                              }
                            }}
                            className="text-gray-600 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- ALL INTERACTIVE MODALS ROSTER --- */}

      {/* Income Modal */}
      <AnimatePresence>
        {showIncomeModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-[#0f0f12] border border-gray-800 rounded-[2rem] p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="font-bold text-base text-emerald-400 uppercase tracking-widest">
                  {editingIncomeId ? 'Edit Income Stream' : 'Add Income Stream'}
                </h3>
                <button onClick={() => setShowIncomeModal(false)} className="text-gray-400 hover:text-gray-200">Cancel</button>
              </div>

              <form onSubmit={handleAddIncome} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Net Amount Deposited (INR)</label>
                    <input
                      type="number"
                      required
                      placeholder="₹ 0"
                      value={incAmount}
                      onChange={e => setIncAmount(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-[#ececf1] focus:border-emerald-500/55 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Account Destination</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setIncAccount('bank')}
                        className={`py-1 rounded-lg text-[9px] font-black uppercase border select-none ${
                          incAccount === 'bank' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-gray-950 border-gray-800 text-gray-400'
                        }`}
                      >
                        Bank Account
                      </button>
                      <button
                        type="button"
                        onClick={() => setIncAccount('cash')}
                        className={`py-1 rounded-lg text-[9px] font-black uppercase border select-none ${
                          incAccount === 'cash' ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400' : 'bg-gray-950 border-gray-800 text-gray-400'
                        }`}
                      >
                        Physical Cash
                      </button>
                    </div>
                  </div>
                </div>

                {incAccount === 'bank' && customBankAccounts.length > 0 && (
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Select Bank Account</label>
                    <select
                      value={incBankAccountId}
                      onChange={e => setIncBankAccountId(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none mt-1"
                    >
                      {customBankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block mb-1">Source Category</label>
                  <button
                    type="button"
                    onClick={() => {
                      setCategorySearchQuery('');
                      setShowSourceCategoryPicker(true);
                    }}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-[#ececf1] focus:border-emerald-500/55 outline-none flex items-center justify-between hover:bg-gray-900 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const matched = allIncomeCategories.find(c => c.id === incCategory);
                        const IconComponent = matched?.icon || HelpCircle;
                        return (
                          <>
                            <span className="p-1 rounded-lg text-[10px]" style={{ backgroundColor: `${matched?.color || '#10b981'}22`, color: matched?.color || '#10b981' }}>
                              <IconComponent size={14} />
                            </span>
                            <span className="font-bold text-gray-200 uppercase tracking-wider">{matched?.name || incCategory}</span>
                          </>
                        );
                      })()}
                    </div>
                    <ChevronDown size={14} className="text-gray-500" />
                  </button>
                </div>

                {/* Salary deductions specifics */}
                <div className="bg-gray-950/40 p-4 border border-white/5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#ececf1]">Is this salary / professional income?</label>
                    <input
                      type="checkbox"
                      checked={incIsSalary}
                      onChange={e => setIncIsSalary(e.target.checked)}
                      className="cursor-pointer"
                    />
                  </div>

                  {incIsSalary && (
                    <div className="space-y-3 pt-2 border-t border-white/5">
                      {incDeductions.map((dec, idx) => (
                        <div key={dec.name} className="flex items-center justify-between gap-3 bg-gray-950/20 px-2 py-1 rounded-lg border border-white/5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => removeDeduction(idx)}
                              className="text-gray-500 hover:text-red-400 transition-colors p-0.5 cursor-pointer"
                              title="Delete deduction"
                            >
                              <Trash2 size={12} />
                            </button>
                            <span className="text-[9.5px] font-bold text-gray-300">{dec.name} Deduct</span>
                          </div>
                          <input
                            type="number"
                            placeholder="Amount"
                            value={dec.amount || ''}
                            onChange={e => {
                              const copy = [...incDeductions];
                              copy[idx].amount = parseFloat(e.target.value) || 0;
                              setIncDeductions(copy);
                            }}
                            className="bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-1 text-xs text-right max-w-[120px] outline-none"
                          />
                        </div>
                      ))}

                      {/* Add Custom Deduction Fields */}
                      <div className="pt-2 border-t border-white/5 space-y-1.5">
                        <label className="text-[8px] font-black uppercase text-gray-500 tracking-wider">Add Custom Deduction</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="e.g. Medical, Gym"
                            value={customDeductName}
                            onChange={e => setCustomDeductName(e.target.value)}
                            className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-300 outline-none"
                          />
                          <input
                            type="number"
                            placeholder="Amount"
                            value={customDeductAmount}
                            onChange={e => setCustomDeductAmount(e.target.value)}
                            className="w-20 bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-300 outline-none text-right"
                          />
                          <button
                            type="button"
                            onClick={addCustomDeduction}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer shrink-0"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      <div className="bg-yellow-500/5 border border-yellow-500/10 p-2.5 rounded-xl flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-yellow-500">Calculated Gross:</span>
                        <span className="text-xs font-black text-[#ececf1]">₹{workingGross.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Shift allowance specific fields */}
                <div className="bg-gray-950/40 p-4 border border-white/5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#ececf1]">Variable Shift Allowance?</label>
                    <input
                      type="checkbox"
                      checked={incIsShift}
                      onChange={e => setIncIsShift(e.target.checked)}
                      className="cursor-pointer"
                    />
                  </div>

                  {incIsShift && (
                    <div className="space-y-3 pt-2 border-t border-white/5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[8px] font-black uppercase text-gray-500 tracking-wider">Per Day Amount (₹)</label>
                          <input
                            type="number"
                            placeholder="e.g. 500"
                            value={incShiftPerDay}
                            onChange={e => setIncShiftPerDay(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-1 text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-black uppercase text-gray-500 tracking-wider">Days Worked</label>
                          <input
                            type="number"
                            placeholder="e.g. 15"
                            value={incShiftActualDays}
                            onChange={e => setIncShiftActualDays(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-1 text-xs outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[8px] font-black uppercase text-gray-500 tracking-wider">Allowance expected in payout</label>
                        <input
                          type="number"
                          placeholder="Claimed expected sum"
                          value={incShiftExpected}
                          onChange={e => setIncShiftExpected(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-1 text-xs outline-none"
                        />
                      </div>

                      {shiftWarningText && (
                        <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-bold flex gap-1.5 items-start">
                          <ShieldAlert size={14} className="shrink-0" />
                          <span>{shiftWarningText}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Additional memos</label>
                  <input
                    type="text"
                    placeholder="Brief outline"
                    value={incNote}
                    onChange={e => setIncNote(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-[#ececf1] outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                >
                  {editingIncomeId ? 'Update Inflow' : 'Confirm Inflow'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Expense Modal */}
      <AnimatePresence>
        {showExpenseModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-[#0f0f12] border border-gray-800 rounded-[2rem] p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="font-bold text-base text-red-500 uppercase tracking-widest">
                  {editingExpenseId ? 'Edit Expense Outflow' : 'Report Expense Outflow'}
                </h3>
                <button onClick={() => setShowExpenseModal(false)} className="text-gray-400 hover:text-gray-200">Cancel</button>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Amount (₹)</label>
                    <input
                      type="number"
                      required
                      placeholder="0.00"
                      value={expAmount}
                      onChange={e => setExpAmount(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-[#ececf1] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Payment Mode</label>
                    <div className="grid grid-cols-3 gap-1.5 mt-1">
                      <button
                        type="button"
                        onClick={() => setExpAccount('bank')}
                        className={`py-1 rounded-lg text-[8px] font-black uppercase border ${
                          expAccount === 'bank' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-gray-950 border-gray-800 text-gray-400'
                        }`}
                      >
                        Bank
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpAccount('cash')}
                        className={`py-1 rounded-lg text-[8px] font-black uppercase border ${
                          expAccount === 'cash' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-gray-950 border-gray-800 text-gray-400'
                        }`}
                      >
                        Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpAccount('credit_card')}
                        className={`py-1 rounded-lg text-[8px] font-black uppercase border ${
                          expAccount === 'credit_card' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400' : 'bg-gray-950 border-gray-800 text-gray-400'
                        }`}
                      >
                        Card
                      </button>
                    </div>
                  </div>
                </div>

                {expAccount === 'bank' && customBankAccounts.length > 0 && (
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Select Bank Account</label>
                    <select
                      value={expBankAccountId}
                      onChange={e => setExpBankAccountId(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none mt-1"
                    >
                      {customBankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                      ))}
                    </select>
                  </div>
                )}

                {expAccount === 'credit_card' && (
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Select Credit Card</label>
                    <select
                      value={expCCId}
                      onChange={e => setExpCCId(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none mt-1"
                    >
                      <option value="">-- Choose Card --</option>
                      {creditCards.map(c => (
                        <option key={c.id} value={c.id}>{c.title} (Debt: ₹{c.balance})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Expense Classification Category</label>
                  <select
                    value={expCategory}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'add_new_custom') {
                        setNewCatType('expense');
                        setShowCategoryManagerModal(true);
                        setExpCategory(allExpenseCategories[0]?.id || 'food');
                        return;
                      }
                      setExpCategory(val);
                      
                      const basicKeys = ['rent', 'water', 'electricity', 'gas', 'internet', 'phone', 'fuel', 'medicine', 'doctor', 'maids', 'groceries'];
                      const investmentKeys = ['epf_contribution', 'invest_outflow'];
                      const savingsKeys = ['insurance', 'loan_emi'];
                      
                      if (basicKeys.includes(val)) {
                        setExpClassification('basic');
                      } else if (investmentKeys.includes(val)) {
                        setExpClassification('investments');
                      } else if (savingsKeys.includes(val)) {
                        setExpClassification('savings');
                      } else {
                        setExpClassification('wants');
                      }
                    }}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-[#ececf1] outline-none mt-1"
                  >
                    <optgroup label="Standard Categories">
                      {allExpenseCategories.filter(cat => !cat.isCustom).map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </optgroup>
                    {allExpenseCategories.some(cat => cat.isCustom) && (
                      <optgroup label="Custom Categories">
                        {allExpenseCategories.filter(cat => cat.isCustom).map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </optgroup>
                    )}
                    <option value="add_new_custom" className="text-yellow-500 font-bold">+ Create Custom Category...</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block mb-1">Split Budget Classification</label>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {[
                      { id: 'basic', label: 'Basic Need', desc: 'Rent/food/bills', activeColor: 'bg-blue-500/10 border-blue-500 text-blue-400' },
                      { id: 'wants', label: 'Want', desc: 'Dine-outs/shopping', activeColor: 'bg-pink-500/10 border-pink-500 text-pink-400' },
                      { id: 'savings', label: 'Saving', desc: 'Reserves/safety', activeColor: 'bg-emerald-500/10 border-emerald-500 text-emerald-400' },
                      { id: 'investments', label: 'Investment', desc: 'Stocks/EPF/MFs', activeColor: 'bg-yellow-500/10 border-yellow-500 text-yellow-400' },
                      { id: 'family', label: 'Family Care', desc: 'Parents/gifts', activeColor: 'bg-violet-500/10 border-violet-500 text-violet-400' },
                      { id: 'extra', label: 'Extra Buffer', desc: 'Unplanned/misc', activeColor: 'bg-cyan-500/10 border-cyan-500 text-cyan-400' },
                    ].map(choice => (
                      <button
                        type="button"
                        key={choice.id}
                        onClick={() => setExpClassification(choice.id as any)}
                        className={`p-2 rounded-xl text-left border flex flex-col justify-between transition-all group ${
                          expClassification === choice.id ? choice.activeColor : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                        }`}
                      >
                        <span className="text-[9px] font-extrabold uppercase leading-none tracking-tight">{choice.label}</span>
                        <span className="text-[7.5px] text-gray-500 group-hover:text-gray-400 mt-1 truncate leading-none">{choice.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Brief memo description</label>
                  <input
                    type="text"
                    placeholder="Details"
                    value={expNote}
                    onChange={e => setExpNote(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-[#ececf1] outline-none mt-1"
                  />
                </div>

                {expError && (
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider bg-red-500/10 border border-red-500/15 p-2 rounded-xl text-center">
                    {expError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-500/20"
                >
                  {editingExpenseId ? 'Update Expenditure' : 'Record Expenditure'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Register Credit Card Modal */}
      <AnimatePresence>
        {showCCModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#0f0f12] border border-gray-800 rounded-[2rem] p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="font-bold text-base text-yellow-500 uppercase tracking-widest">Register Credit Card</h3>
                <button onClick={() => setShowCCModal(false)} className="text-gray-400 hover:text-gray-200">Cancel</button>
              </div>

              <form onSubmit={handleAddCC} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Card Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC Millennia"
                    value={ccTitle}
                    onChange={e => setCcTitle(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-[#ececf1] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Approved Limit (₹)</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 100000"
                      value={ccLimit}
                      onChange={e => setCcLimit(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-[#ececf1] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Current Bill Balance (₹)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={ccBalance}
                      onChange={e => setCcBalance(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-[#ececf1] outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-500 text-black text-xs font-black uppercase tracking-widest shadow-lg"
                >
                  Register Card details
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pay CC Debt Modal */}
      <AnimatePresence>
        {showPayCCModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#0f0f12] border border-gray-800 rounded-[2rem] p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="font-bold text-base text-blue-400 uppercase tracking-widest">Pay Card Bill</h3>
                <button onClick={() => setShowPayCCModal(false)} className="text-gray-400 hover:text-gray-200">Cancel</button>
              </div>

              <form onSubmit={handlePayCC} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Choose Credit Card</label>
                  <select
                    required
                    value={payCCId}
                    onChange={e => {
                      setPayCCId(e.target.value);
                      const sel = creditCards.find(c => c.id === e.target.value);
                      if (sel) setPayCCAmount(sel.balance.toString());
                    }}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none mt-1"
                  >
                    <option value="">-- Select --</option>
                    {creditCards.map(c => (
                      <option key={c.id} value={c.id}>{c.title} (Due: ₹{c.balance})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Amount Paid (₹)</label>
                  <input
                    type="number"
                    required
                    value={payCCAmount}
                    onChange={e => setPayCCAmount(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-100 outline-none mt-1"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Funding Account Payment From</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setPayCCSource('bank')}
                      className={`py-1 rounded-lg text-[9px] font-black uppercase border select-none ${
                        payCCSource === 'bank' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-gray-950 border-gray-800 text-gray-400'
                      }`}
                    >
                      Bank Balance
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayCCSource('cash')}
                      className={`py-1 rounded-lg text-[9px] font-black uppercase border select-none ${
                        payCCSource === 'cash' ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400' : 'bg-gray-950 border-gray-800 text-gray-400'
                      }`}
                    >
                      Physical Cash
                    </button>
                  </div>
                </div>

                {payCCSource === 'bank' && customBankAccounts.length > 0 && (
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Select Bank Account</label>
                    <select
                      value={payCCBankAccountId}
                      onChange={e => setPayCCBankAccountId(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none mt-1"
                    >
                      {customBankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest shadow-lg"
                >
                  Pay Outstanding Bill
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lending Records Modal */}
      <AnimatePresence>
        {showLendingModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#0f0f12] border border-gray-800 rounded-[2rem] p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="font-bold text-base text-yellow-500 uppercase tracking-widest">Borrow / Lend Track</h3>
                <button onClick={() => setShowLendingModal(false)} className="text-gray-400 hover:text-gray-200">Cancel</button>
              </div>

              <form onSubmit={handleAddLending} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Borrower Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Person Name"
                    value={lendPerson}
                    onChange={e => setLendPerson(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-[#ececf1] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Amount Given (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={lendAmount}
                    onChange={e => setLendAmount(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-100 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Lended From Account</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setLendAccount('bank')}
                      className={`py-1 rounded-lg text-[9px] font-black uppercase border select-none ${
                        lendAccount === 'bank' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-gray-950 border-gray-800 text-gray-400'
                      }`}
                    >
                      Bank Account
                    </button>
                    <button
                      type="button"
                      onClick={() => setLendAccount('cash')}
                      className={`py-1 rounded-lg text-[9px] font-black uppercase border select-none ${
                        lendAccount === 'cash' ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400' : 'bg-gray-950 border-gray-800 text-gray-400'
                      }`}
                    >
                      Physical Cash
                    </button>
                  </div>
                </div>

                {lendAccount === 'bank' && customBankAccounts.length > 0 && (
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Select Bank Account</label>
                    <select
                      value={lendBankAccountId}
                      onChange={e => setLendBankAccountId(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none mt-1"
                    >
                      {customBankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-500 text-black text-xs font-black uppercase tracking-widest shadow-lg"
                >
                  Save Lending Record
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Asset Valuation Modal */}
      <AnimatePresence>
        {showAssetModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#0f0f12] border border-gray-800 rounded-[2rem] p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="font-bold text-base text-yellow-500 uppercase tracking-widest">Add Asset Entry</h3>
                <button onClick={() => setShowAssetModal(false)} className="text-gray-400 hover:text-gray-200">Cancel</button>
              </div>

              <form onSubmit={handleAddAsset} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Asset Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Enfield, Harrier Car"
                    value={assetName}
                    onChange={e => setAssetName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-[#ececf1] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Asset Type</label>
                    <select
                      value={assetType}
                      onChange={e => setAssetType(e.target.value as any)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none"
                    >
                      <option value="Bike">Bike</option>
                      <option value="Car">Car</option>
                      <option value="Other">Other Asset</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Current Market Value (₹)</label>
                    <input
                      type="number"
                      required
                      placeholder="0.00"
                      value={assetPrice}
                      onChange={e => setAssetPrice(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-[#ececf1] outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-500 text-black text-xs font-black uppercase tracking-widest"
                >
                  Record Evaluation
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Track Insurance Modal */}
      <AnimatePresence>
        {showInsuranceModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#0f0f12] border border-gray-800 rounded-[2rem] p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="font-bold text-base text-cyan-400 uppercase tracking-widest">Connect Insurance Policy</h3>
                <button onClick={() => setShowInsuranceModal(false)} className="text-gray-400 hover:text-gray-200">Cancel</button>
              </div>

              <form onSubmit={handleAddInsurance} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Provider / Plan Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Life Term / Health Gold"
                    value={insName}
                    onChange={e => setInsName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-[#ececf1] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Premium Cost (₹)</label>
                    <input
                      type="number"
                      required
                      placeholder="0.00"
                      value={insPremium}
                      onChange={e => setInsPremium(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-100 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Premium Billing Interval</label>
                    <select
                      value={insTerm}
                      onChange={e => setInsTerm(e.target.value as any)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half-Yearly">Half-Yearly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-widest"
                >
                  Track policy
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Self Account Transfer Modal */}
      <AnimatePresence>
        {showTransferModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#0f0f12] border border-gray-800 rounded-[2rem] p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="font-bold text-base text-blue-400 uppercase tracking-widest">Self funds transfer</h3>
                <button onClick={() => setShowTransferModal(false)} className="text-gray-400 hover:text-gray-200">Cancel</button>
              </div>

              <form onSubmit={handleTransfer} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Amount self-transfer (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={transAmount}
                    onChange={e => setTransAmount(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-[#ececf1] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[8px] font-black uppercase text-gray-500 tracking-wider">Source Out</label>
                    <select
                      value={transFrom}
                      onChange={e => setTransFrom(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-1.5 text-xs text-gray-300 outline-none"
                    >
                      <option value="cash">Physical Cash</option>
                      {customBankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] font-black uppercase text-gray-500 tracking-wider">Destination In</label>
                    <select
                      value={transTo}
                      onChange={e => setTransTo(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-1.5 text-xs text-gray-300 outline-none"
                    >
                      {customBankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type})
                        </option>
                      ))}
                      <option value="cash">Physical Cash</option>
                    </select>
                  </div>
                </div>

                {transFrom === transTo && (
                  <p className="text-[9px] text-red-400 font-bold uppercase tracking-wider">From and To Accounts must differ.</p>
                )}

                <button
                  type="submit"
                  disabled={transFrom === transTo}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest shadow-lg"
                >
                  Verify and Transfer funds
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EPF Current Accumulated Balance Modal */}
      <AnimatePresence>
        {showEPFBalanceModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-[#0f0f12] border border-gray-800 rounded-[2.5rem] p-6 space-y-4 max-h-[90vh] overflow-y-auto select-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-[#ececf1] text-[13px] uppercase tracking-widest flex items-center gap-1.5">
                    <PiggyBank size={16} className="text-yellow-500" /> EPF Ledger & Breakdown
                  </h3>
                  <p className="text-[9px] text-gray-500 uppercase font-black">Employee Provident Fund real-time monitoring</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEPFBalanceModal(false)}
                  className="text-xs bg-gray-900 border border-gray-800 hover:border-gray-700 hover:text-gray-200 px-2.5 py-1 rounded-lg text-gray-400 font-bold uppercase tracking-tight"
                >
                  Close
                </button>
              </div>

              {/* Total Accumulated Card */}
              <div className="bg-yellow-500/10 border border-yellow-500/20 p-5 rounded-3xl text-center space-y-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/5 rounded-full blur-xl pointer-events-none" />
                <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500/80 block">Total EPF Fund Valuation</span>
                <span className="text-3xl font-black text-white block">₹{epfBalance.toLocaleString('en-IN')}</span>
              </div>

              {/* Share Breakdown Blocks */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-gray-950/40 border border-gray-800/60 space-y-0.5">
                  <span className="text-[8px] font-black uppercase text-gray-400 tracking-wider block">Employee Share</span>
                  <span className="text-xs font-black text-[#ececf1] block">₹{totalSalariedEPFDeductions.toLocaleString('en-IN')}</span>
                  <span className="text-[7.5px] text-gray-600 block">(1x deducted from Income)</span>
                </div>
                <div className="p-4 rounded-2xl bg-gray-950/40 border border-gray-800/60 space-y-0.5">
                  <span className="text-[8px] font-black uppercase text-gray-400 tracking-wider block">Employer Share</span>
                  <span className="text-xs font-black text-[#ececf1] block">₹{totalSalariedEPFDeductions.toLocaleString('en-IN')}</span>
                  <span className="text-[7.5px] text-gray-600 block">(1x matching contribution)</span>
                </div>
              </div>

              {/* Initial configure formula */}
              <div className="bg-gray-950/60 border border-gray-800/60 p-4 rounded-3xl space-y-3">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-gray-400 border-b border-gray-900 pb-2">
                  <span>Ledger Equation</span>
                  <span className="text-gray-500 font-black">Opening + 2x Deductions</span>
                </div>
                <div className="space-y-2 text-[11px] text-gray-300">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-semibold uppercase text-[9px] tracking-wide">Pre-existing opening EPF:</span>
                    <span className="font-bold">₹{initialEpfBalance.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-900/45 pt-1.5">
                    <span className="text-gray-500 font-semibold uppercase text-[9px] tracking-wide">Total Income contributions:</span>
                    <span className="font-bold text-yellow-500">+ ₹{(totalSalariedEPFDeductions * 2).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Adjust Opening Balance Form */}
              <form onSubmit={handleSetEPFBalance} className="space-y-3 bg-[#131316] border border-gray-800/85 p-4 rounded-3xl">
                <div className="space-y-1">
                  <label className="text-[8.5px] font-black uppercase text-gray-400 tracking-wider block">Adjust pre-existing opening EPF amount</label>
                  <input
                    type="number"
                    required
                    placeholder="Enter pre-existing EPF balance"
                    value={epfInput}
                    onChange={e => setEpfInput(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-100 outline-none focus:border-yellow-500/40 font-bold"
                  />
                  <p className="text-[7.5px] text-gray-500 uppercase leading-normal mt-1.5 block">
                    Define the manual starting balance of your EPF account. Income contributions will dynamically multiply by 2 and add on top of this.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-colors"
                >
                  Save Opening Balance
                </button>
              </form>

              {/* List of Contributions from Incomes */}
              <div className="space-y-2">
                <h4 className="text-[9.5px] font-black uppercase text-gray-500 tracking-wider">Salary Contribution Ledger</h4>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 select-scrollbar">
                  {(() => {
                    const contributionIncomes = incomes.filter(inc => {
                      if (!inc.isSalary || !inc.deductions) return false;
                      const epf = parseFloat(inc.deductions.find(d => d.name === 'EPF')?.amount as any) || 0;
                      return epf > 0;
                    });

                    if (contributionIncomes.length === 0) {
                      return (
                        <p className="text-[10px] text-gray-500 italic text-center py-4 bg-gray-950/20 border border-gray-800/40 rounded-xl">
                          No logged salary income entries detected with EPF deductions.
                        </p>
                      );
                    }

                    return contributionIncomes.map(inc => {
                      const epf = parseFloat(inc.deductions?.find(d => d.name === 'EPF')?.amount as any) || 0;
                      const doubled = epf * 2;
                      return (
                        <div key={inc.id} className="flex items-center justify-between text-[10px] py-2 px-3 border border-gray-900 rounded-xl bg-gray-950/30">
                          <div>
                            <span className="font-bold text-gray-300 block">{inc.note || 'Salary Credit'}</span>
                            <span className="text-[8px] text-gray-500 uppercase tracking-wider">{new Date(inc.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </div>
                          <div className="text-right space-y-0.5">
                            <span className="font-black text-emerald-400 block">+ ₹{doubled.toLocaleString('en-IN')}</span>
                            <span className="text-[8px] text-gray-500 uppercase tracking-widest block leading-none">EE: ₹{epf} • ER: ₹{epf}</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Source Category Picker Modal */}
      <AnimatePresence>
        {showSourceCategoryPicker && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#0f0f12] border border-gray-800 rounded-[2rem] p-5 space-y-4 flex flex-col max-h-[85vh] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-[#ececf1] text-xs uppercase tracking-widest flex items-center gap-1.5">
                    Select Income Source
                  </h3>
                  <p className="text-[9px] text-gray-500 uppercase font-bold">Choose a category for tracking your income stream</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSourceCategoryPicker(false)}
                  className="text-xs bg-gray-900 border border-gray-800 hover:border-gray-700 hover:text-gray-200 px-2.5 py-1 rounded-lg text-gray-400 font-bold uppercase tracking-tight"
                >
                  Close
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Income Sources..."
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800/80 rounded-xl px-3 py-2 text-xs text-gray-200 outline-none placeholder-gray-600 focus:border-emerald-500/35 uppercase tracking-wider font-semibold"
                />
              </div>

              {/* Categories Scrollable List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 select-scrollbar">
                {(() => {
                  const filtered = allIncomeCategories.filter(cat =>
                    cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <p className="text-xs text-gray-500 italic text-center py-6">
                        No categories found matching "{categorySearchQuery}"
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-1.5 pb-2">
                      {filtered.map(cat => {
                        const IconComp = cat.icon || HelpCircle;
                        const isSelected = incCategory === cat.id;

                        return (
                          <button
                            type="button"
                            key={cat.id}
                            onClick={() => {
                              setIncCategory(cat.id);
                              if (cat.id === 'salary') setIncIsSalary(true);
                              else setIncIsSalary(false);
                              if (cat.id === 'shift_allowance') setIncIsShift(true);
                              else setIncIsShift(false);
                              setShowSourceCategoryPicker(false);
                            }}
                            className={`w-full flex items-center justify-between text-left px-3.5 py-2.5 border rounded-xl transition-all ${
                              isSelected
                                ? 'bg-emerald-500/5 border-emerald-500/50'
                                : 'bg-gray-950/25 border-gray-800/40 hover:bg-[#131316] hover:border-gray-700/60'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className="p-2 rounded-xl text-xs flex items-center justify-center shrink-0"
                                style={{
                                  backgroundColor: `${cat.color || '#10b981'}22`,
                                  color: cat.color || '#10b981'
                                }}
                              >
                                <IconComp size={14} />
                              </span>
                              <span className="text-xs font-bold text-gray-200 uppercase tracking-wide leading-none">{cat.name}</span>
                            </div>
                            
                            {/* Blue radio button indicator matching mobile interface */}
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-blue-500' : 'border-gray-700'
                            }`}>
                              {isSelected && (
                                <div className="w-2 rounded-full h-2 bg-blue-500" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Option to create a new custom category */}
              <div className="border-t border-gray-800/60 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowSourceCategoryPicker(false);
                    setNewCatType('income');
                    setShowCategoryManagerModal(true);
                  }}
                  className="w-full py-2.5 bg-gray-950 hover:bg-gray-900 border border-gray-800/80 hover:border-gray-700 text-yellow-500 hover:text-yellow-400 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Create Custom Category...
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Adjust Opening starting balance popup */}
      <AnimatePresence>
        {showAdjustOpenModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#0f0f12] border border-gray-800 rounded-[2rem] p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="font-bold text-sm text-yellow-500 uppercase tracking-widest">
                  Adjust Starting Balance
                </h3>
                <button onClick={() => setShowAdjustOpenModal(false)} className="text-gray-400 hover:text-gray-200 text-xs">Cancel</button>
              </div>

              <form onSubmit={handleAdjustOpenSubmit} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block mb-1">
                    {adjustOpenAccount === 'bank' ? 'Bank Initial Balance (₹)' : 'Physical Cash Initial Balance (₹)'}
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="₹ 0"
                    value={adjustOpenValue}
                    onChange={e => setAdjustOpenValue(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-100 outline-none focus:border-yellow-500/50"
                  />
                  <p className="text-[8px] text-gray-500 uppercase mt-2.5 leading-normal">
                    Setting the opening starting balance allows the system to accurately backcompute net holdings dynamically against custom outflows and inflows.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-colors"
                >
                  Adjust Balance
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Manager Modal */}
      <AnimatePresence>
        {showCategoryManagerModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#0f0f12] border border-gray-800 rounded-[2rem] p-6 space-y-5 my-8"
            >
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="font-bold text-sm text-yellow-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles size={16} /> SETUP CUSTOM CATEGORIES
                </h3>
                <button 
                  onClick={() => setShowCategoryManagerModal(false)} 
                  className="text-xs bg-gray-900 border border-gray-800 hover:border-gray-700 hover:text-gray-200 px-2.5 py-1 rounded-lg text-gray-400 font-bold uppercase tracking-tight"
                >
                  Close
                </button>
              </div>

              {/* Current Categories List */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Your Custom Categories</h4>
                
                {customCategories.length === 0 ? (
                  <p className="text-[10px] text-gray-600 uppercase font-black py-4 text-center bg-gray-950/20 border border-gray-800/40 rounded-xl">
                    No custom categories created yet. Adding categories allows customized grouping for your transfers and inflows.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 select-scrollbar">
                    {customCategories.map(cat => {
                      const IconComponent = getCustomIconComponent(cat.iconName);
                      return (
                        <div 
                          key={cat.id} 
                          className="flex items-center justify-between p-2.5 bg-gray-950/50 border border-gray-800/60 rounded-xl"
                        >
                          <div className="flex items-center gap-2">
                            <span 
                              className="p-1.5 rounded-lg text-xs" 
                              style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                            >
                              <IconComponent size={14} />
                            </span>
                            <span className="text-xs font-bold text-gray-200">{cat.name}</span>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                              cat.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {cat.type}
                            </span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1 hover:text-red-400 text-gray-500 transition-colors"
                            title="Delete category"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-800/60 pt-4 space-y-3">
                <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Create Custom Category</h4>
                
                <form onSubmit={handleCreateCategory} className="space-y-4">
                  {catError && (
                    <div className="text-[10px] text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
                      {catError}
                    </div>
                  )}

                  {/* Category Name */}
                  <div>
                    <label className="text-[8.5px] font-black uppercase text-gray-500 tracking-wider block mb-1">Category Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Gaming Setup, Fuel Extra" 
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-100 outline-none focus:border-yellow-500/50"
                    />
                  </div>

                  {/* Flow Type */}
                  <div>
                    <label className="text-[8.5px] font-black uppercase text-gray-500 tracking-wider block mb-1.5">Flow Type Classification</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewCatType('expense')}
                        className={`py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                          newCatType === 'expense' 
                            ? 'bg-red-500/10 text-red-400 border-red-500/30' 
                            : 'bg-black/20 text-gray-500 border-transparent hover:text-gray-800'
                        }`}
                      >
                        Expense / Out
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCatType('income')}
                        className={`py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                          newCatType === 'income' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                            : 'bg-black/20 text-gray-500 border-transparent hover:text-gray-800'
                        }`}
                      >
                        Income / In
                      </button>
                    </div>
                  </div>

                  {/* Preset Colors Selection */}
                  <div>
                    <label className="text-[8.5px] font-black uppercase text-gray-500 tracking-wider block mb-1.5">Accent Color Badge</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        '#f87171', // Red
                        '#fb923c', // Orange
                        '#fbbf24', // Yellow/Amber
                        '#34d399', // Emerald
                        '#2dd4bf', // Teal
                        '#60a5fa', // Sky Blue
                        '#a78bfa', // Purple
                        '#f472b6', // Pink
                        '#94a3b8', // Slate
                        '#fb7185'  // Rose
                      ].map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewCatColor(color)}
                          className="w-5 h-5 rounded-full relative transition-transform hover:scale-110 focus:outline-none"
                          style={{ backgroundColor: color }}
                        >
                          {newCatColor === color && (
                            <span className="absolute inset-0 flex items-center justify-center text-black font-bold text-[8px]">
                              ✓
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Icon Selection */}
                  <div>
                    <label className="text-[8.5px] font-black uppercase text-gray-500 tracking-wider block mb-1.5">Lucide Vector Icon</label>
                    <div className="grid grid-cols-6 gap-2 bg-black/30 border border-gray-800/80 p-2.5 rounded-xl">
                      {[
                        'Sparkles', 'Coins', 'Briefcase', 'Gift', 'Heart', 'Trophy',
                        'HelpCircle', 'DollarSign', 'Wallet', 'Utensils', 'Home', 'Car',
                        'Gamepad', 'Laptop', 'Dumbbell', 'Coffee', 'BookOpen'
                      ].map(iconName => {
                        const IconComponent = getCustomIconComponent(iconName);
                        const isSelected = newCatIcon === iconName;
                        return (
                          <button
                            key={iconName}
                            type="button"
                            onClick={() => setNewCatIcon(iconName)}
                            className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30' 
                                : 'text-gray-500 border border-transparent hover:text-gray-800'
                            }`}
                            title={iconName}
                          >
                            <IconComponent size={14} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submit Build */}
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-colors shrink-0"
                  >
                    Create Custom Category
                  </button>
                </form>
              </div>

              {/* Show All Categories (For Reference / Lookup) */}
              <div className="border-t border-gray-800/60 pt-4 space-y-2">
                <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-wider">All Categories List ({allExpenseCategories.length + allIncomeCategories.length})</h4>
                <div className="max-h-[140px] overflow-y-auto space-y-3 pr-1 select-scrollbar">
                  <div>
                    <h5 className="text-[9px] font-black text-red-400 uppercase tracking-wider mb-1.5">Expenses ({allExpenseCategories.length})</h5>
                    <div className="grid grid-cols-2 gap-1.5">
                      {allExpenseCategories.map(cat => (
                        <div key={cat.id} className="flex items-center gap-1.5 text-[10px] p-1.5 bg-gray-950/40 border border-gray-800/40 rounded-lg text-gray-400">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="truncate">{cat.name}</span>
                          {cat.id.startsWith('custom_') && <span className="text-[7px] text-yellow-500 font-extrabold ml-auto">Custom</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="text-[9px] font-black text-emerald-400 uppercase tracking-wider mb-1.5">Incomes ({allIncomeCategories.length})</h5>
                    <div className="grid grid-cols-2 gap-1.5">
                      {allIncomeCategories.map(cat => (
                        <div key={cat.id} className="flex items-center gap-1.5 text-[10px] p-1.5 bg-gray-950/40 border border-gray-800/40 rounded-lg text-gray-400">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="truncate">{cat.name}</span>
                          {cat.id.startsWith('custom_') && <span className="text-[7px] text-yellow-500 font-extrabold ml-auto">Custom</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bank Account Manager Modal */}
      <AnimatePresence>
        {showBankAccountsModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#0f0f12] border border-gray-800 rounded-[2rem] p-6 space-y-5 my-8"
            >
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="font-bold text-sm text-yellow-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Landmark size={16} /> MY BANK ACCOUNTS
                </h3>
                <button 
                  onClick={() => {
                    setShowBankAccountsModal(false);
                    setEditingBankAccountId(null);
                    setNewBankName('');
                    setNewBankType('savings');
                    setNewBankInitialBalance('');
                    setBankError('');
                  }} 
                  className="text-xs bg-gray-900 border border-gray-800 hover:border-gray-700 hover:text-gray-200 px-2.5 py-1 rounded-lg text-gray-400 font-bold uppercase tracking-tight"
                >
                  Close
                </button>
              </div>

              {/* Refined Bank Accounts List (Compact, matching SPECIFIC BANK ACCOUNT LIST) */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Your Active Bank Accounts</h4>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1 select-scrollbar">
                  {customBankAccounts.map(acc => {
                    const currentBalance = calculatedBalances.banks[acc.id] !== undefined 
                      ? calculatedBalances.banks[acc.id] 
                      : acc.initialBalance;

                    return (
                      <div 
                        key={acc.id} 
                        className={`flex items-center justify-between text-[10px] py-2 px-3 border border-gray-800/40 rounded-xl bg-gray-950/30 hover:bg-gray-950/60 transition-colors ${
                          editingBankAccountId === acc.id ? 'border-yellow-500/50 bg-yellow-500/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                          <div className="space-y-0.5">
                            <span className="font-bold text-gray-200 uppercase tracking-wide block leading-tight">{acc.name}</span>
                            <span className="text-[8px] font-black text-gray-500 uppercase tracking-wider block">
                              {acc.type} • Opening: ₹{acc.initialBalance.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-gray-100 text-xs">₹{currentBalance.toLocaleString('en-IN')}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBankAccountId(acc.id);
                                setNewBankName(acc.name);
                                setNewBankType(acc.type);
                                setNewBankInitialBalance(acc.initialBalance.toString());
                                setBankError('');
                              }}
                              className="p-1 hover:text-yellow-500 hover:bg-gray-800/80 rounded transition-colors text-gray-500"
                              title="Edit Bank Account"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDeleteBankAccount(acc.id)}
                              className="p-1 hover:text-red-400 hover:bg-gray-800/80 rounded transition-colors text-gray-500"
                              title="Delete Bank Account"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-gray-800/60 pt-4 space-y-3">
                <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                  {editingBankAccountId ? 'Edit Bank Account details' : 'Register New Bank Account'}
                </h4>
                
                <form onSubmit={handleCreateBankAccount} className="space-y-4">
                  {bankError && (
                    <div className="text-[10px] text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
                      {bankError}
                    </div>
                  )}

                  {/* Account Name */}
                  <div>
                    <label className="text-[8.5px] font-black uppercase text-gray-500 tracking-wider block mb-1">Account Name / Bank</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. HDFC Salary, SBI Savings" 
                      value={newBankName}
                      onChange={e => setNewBankName(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-100 outline-none focus:border-yellow-500/50"
                    />
                  </div>

                  {/* Account Type selection */}
                  <div>
                    <label className="text-[8.5px] font-black uppercase text-gray-500 tracking-wider block mb-1">Account Classification Type</label>
                    <select
                      value={newBankType}
                      onChange={e => setNewBankType(e.target.value as any)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-150 outline-none focus:border-yellow-500/50"
                    >
                      <option value="savings">Savings Account</option>
                      <option value="salaried">Salaried Account</option>
                      <option value="current">Current / business Account</option>
                      <option value="other">Other Account</option>
                    </select>
                  </div>

                  {/* Initial Balance */}
                  <div>
                    <label className="text-[8.5px] font-black uppercase text-gray-500 tracking-wider block mb-1">Opening starting balance (INR)</label>
                    <input 
                      type="number" 
                      required
                      placeholder="e.g. 50000" 
                      value={newBankInitialBalance}
                      onChange={e => setNewBankInitialBalance(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-100 outline-none focus:border-yellow-500/50"
                    />
                  </div>

                  {/* Submit buttons */}
                  <div className="flex gap-2">
                    {editingBankAccountId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBankAccountId(null);
                          setNewBankName('');
                          setNewBankType('savings');
                          setNewBankInitialBalance('');
                          setBankError('');
                        }}
                        className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-black uppercase tracking-widest rounded-xl transition-colors whitespace-nowrap"
                      >
                        Cancel Edit
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-colors shrink-0"
                    >
                      {editingBankAccountId ? 'Save changes' : 'Register Bank Account'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- BUDGET CATEGORY EDIT/MAP OVERLAY MODAL ----------------- */}
      <AnimatePresence>
        {showBudgetCategoryModal && editingBudgetCategory && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f0f12] border border-gray-800 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-yellow-500 flex items-center gap-2">
                  <Sliders size={14} className="text-yellow-500" />
                  {editingBudgetCategory.id ? 'Configure Allocation Node' : 'Add Allocation Node'}
                </h3>
                <button
                  onClick={() => {
                    setShowBudgetCategoryModal(false);
                    setEditingBudgetCategory(null);
                  }}
                  className="text-gray-400 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest bg-gray-800 border border-gray-700/60 px-3 py-1 rounded"
                >
                  Close
                </button>
              </div>

              <div className="p-5 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                {/* Node Name */}
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase font-black tracking-widest text-[#ececf1] block">Category Label</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Water Bill, Skincare, Grossories"
                    className="w-full bg-[#121215] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 outline-none font-bold focus:border-yellow-500 transition-all"
                    value={editingBudgetCategory.name}
                    onChange={(e) => setEditingBudgetCategory({ ...editingBudgetCategory, name: e.target.value })}
                  />
                </div>

                {/* Group selection */}
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase font-black tracking-widest text-[#ececf1] block">Distribution Target Group</span>
                  <select
                    className="w-full bg-[#121215] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none font-bold focus:border-yellow-500 transition-all"
                    value={editingBudgetCategory.groupId}
                    onChange={(e) => setEditingBudgetCategory({ ...editingBudgetCategory, groupId: e.target.value })}
                  >
                    <option value="basic">Basic Needs</option>
                    <option value="wants">Wants (Shared Cap Mode)</option>
                    <option value="savings">Savings / Long Term</option>
                    <option value="investments">Investments</option>
                    <option value="family">Family Care</option>
                    <option value="extra">Extra Buffer</option>
                  </select>
                </div>

                {/* Spend Cap */}
                {editingBudgetCategory.groupId !== 'wants' && editingBudgetCategory.groupId !== 'investments' && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] uppercase font-black tracking-widest text-[#ececf1] block">Local Spend Cap (₹)</span>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      className="w-full bg-[#121215] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 outline-none font-bold focus:border-yellow-500 transition-all"
                      value={editingBudgetCategory.spendCap || ''}
                      onChange={(e) => setEditingBudgetCategory({ ...editingBudgetCategory, spendCap: Math.max(0, parseFloat(e.target.value) || 0) })}
                    />
                    <span className="text-[8.5px] text-gray-500 block">Leaves you safe with warning logs if expenditures exceed this limit.</span>
                  </div>
                )}

                {/* Mapped standard categories multi selector checklist */}
                <div className="space-y-2">
                  <span className="text-[9px] uppercase font-black tracking-widest text-[#ececf1] block">Map live Transaction Categories</span>
                  <div className="bg-[#121215] border border-gray-800 rounded-xl p-3.5 max-h-40 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[...EXPENSE_CATEGORIES, ...customCategories].map(cat => {
                        const isChecked = editingBudgetCategory.mappedCategories.includes(cat.id);
                        return (
                          <label key={cat.id} className="flex items-center gap-2 text-xs text-gray-300 font-medium cursor-pointer hover:text-white transition-all">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                let copy = [...editingBudgetCategory.mappedCategories];
                                if (isChecked) {
                                  copy = copy.filter(id => id !== cat.id);
                                } else {
                                  copy.push(cat.id);
                                }
                                setEditingBudgetCategory({ ...editingBudgetCategory, mappedCategories: copy });
                              }}
                              className="accent-yellow-500 rounded border-gray-700 shrink-0"
                            />
                            <span>{cat.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <span className="text-[8.5px] text-gray-500 block">Select the ledger categories whose totals will feed into this allocation node.</span>
                </div>

                {/* Note keywords match filter */}
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase font-black tracking-widest text-[#ececf1] block md:flex md:items-center md:justify-between">
                    <span>Match description text keyword (Optional)</span>
                    <span className="text-gray-500 text-[8px] lowercase font-normal">Case-Insensitive match</span>
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. rent, parents, wifi, sbi"
                    className="w-full bg-[#121215] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 outline-none font-bold focus:border-yellow-500 transition-all"
                    value={editingBudgetCategory.noteFilter || ''}
                    onChange={(e) => setEditingBudgetCategory({ ...editingBudgetCategory, noteFilter: e.target.value })}
                  />
                  <span className="text-[8.5px] text-gray-500 block">Matches transactions with this specific word in descriptions (e.g. description "parents allowance" matches "parents"). Great to isolate specific lines!</span>
                </div>
              </div>

              {/* Modal actions */}
              <div className="p-5 border-t border-gray-800 flex gap-3 justify-end bg-gray-950/20">
                <button
                  onClick={() => {
                    setShowBudgetCategoryModal(false);
                    setEditingBudgetCategory(null);
                  }}
                  className="px-4 py-2 rounded-xl text-[10px] bg-gray-800 text-gray-300 font-bold uppercase tracking-widest hover:bg-gray-755 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!editingBudgetCategory.name.trim()) {
                      alert('Please enter a category label.');
                      return;
                    }
                    
                    let copy = [...budgetCategories];
                    if (editingBudgetCategory.id) {
                      copy = copy.map(c => c.id === editingBudgetCategory.id ? {
                        ...c,
                        name: editingBudgetCategory.name,
                        groupId: editingBudgetCategory.groupId,
                        spendCap: editingBudgetCategory.spendCap,
                        mappedCategories: editingBudgetCategory.mappedCategories,
                        noteFilter: editingBudgetCategory.noteFilter
                      } : c);
                    } else {
                      const newNode = {
                        id: 'node_' + crypto.randomUUID(),
                        groupId: editingBudgetCategory.groupId,
                        name: editingBudgetCategory.name,
                        spendCap: editingBudgetCategory.spendCap,
                        mappedCategories: editingBudgetCategory.mappedCategories,
                        noteFilter: editingBudgetCategory.noteFilter
                      };
                      copy.push(newNode);
                    }
                    
                    handleUpdateBudgetCategories(copy);
                    setShowBudgetCategoryModal(false);
                    setEditingBudgetCategory(null);
                  }}
                  className="px-5 py-2 rounded-xl text-[10px] bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest transition"
                >
                  Save allocation Node
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
