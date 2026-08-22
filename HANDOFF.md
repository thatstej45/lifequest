# LifeQuest RPG + Personal Finance Ledger: System Architecture & Handoff Report

Welcome to the unified Handoff file for **LifeQuest RPG & Finance Engine**. This document serves as the absolute single source of truth detailing the technical layout, complete operational state, database structure, logical side effects, and precautions for the entire application.

---

## 🎯 Project Overview & Concept

**LifeQuest RPG** is a gamified productivity application built to transform self-improvement and financial health into a fantasy role-playing adventure. The application uses customizable **skill tiers**, **repeatable quests**, **mentor personalities**, and a **robust personal finance ledger (INR ₹)** to incentivize positive habits, structural spending controls, and long-term asset accumulation.

The user interface uses a high-contrast futuristic slate design with fluid animations, micro-interactions, responsive grids, and instant audio feedback.

---

## 💻 Technic Stack & Libraries

1.  **Frontend Core**: React 19 + TypeScript + Vite.
2.  **State Management & Database**: Dexie.js (IndexedDB wrapper) for durable, client-side, offline-first offline storage.
3.  **UI & Styling**: Tailwind CSS (Tailwind v4 theme extensions) inside `src/index.css` paired with a dark slate motif.
4.  **Icons**: Lucide React.
5.  **Motion & Transitions**: Framer Motion for modal overlays, state slide transitions, and interactive button hover weights.
6.  **Audio Engine**: Howler.js for crisp sound effects (`bling`, `minimal`, `crystal`, `achievement`).
7.  **AI Integration**: `@google/genai` TypeScript SDK referencing model `gemini-3-flash-preview` for progressive task generation, mentor mocks, and customized guidance.

---

## 📂 Code Module Architecture & File Directory

-   `package.json`: Holds dependencies. Do not configure custom server run paths unless port 3000 mapping is preserved.
-   `src/main.tsx` & `src/index.html`: Entrypoint loaders.
-   `src/index.css`: Hosts the main custom scrollbars, root typography imports, and styling declarations.
-   `src/types.ts`: Root level type descriptions (goals, categories, stats, and complete finance type declarations).
-   `src/db.ts`: Initializer class for the Dexie.js Database. Upgraded to **Version 5** to accommodate the finance tables.
-   `src/constants.ts`: Static initial state definitions.
-   `src/services/geminiService.ts`: Integration layer for API prompts, rate limit detections, and model fallback states.
-   `src/components/FinanceTracker.tsx`: Main finance page rendering ledger cards, dual balances systems, and modal transaction sheets.
-   `src/App.tsx`: Main hub controller wrapping tabs (`Home`, `Stats`, `Quests`, `Finance`), XP formulas, sound actions, and the background notification engine.

---

## 🛡️ Functional Walkthrough & What is Working

### 📈 Module A: Gamified RPG Experience (Home, Stats, Quests)
1.  **Home - Category & Skill Trees**:
    *   Six core domains: **Physical**, **Financial**, **Social**, **Mental**, **Career**, and **Personality**.
    *   Skills can be leveled up by completing quests. Each level up grants XP and triggers a gorgeous level-up prompt that drops Skill Points (SP).
    *   SP is used to unlock highly customized advanced sub-skills or specializations (`Expert`, `Master`).
2.  **Stats - Analytics Dashboard**:
    *   Tracks level distribution across different skills.
    *   Features local **Consistency Metrics** detailing how reliably a student works on each category over consecutive days.
    *   Witty Mentor Personalities: Choose between **Supportive**, **Sarcastic**, and **Stoic** to get highly customized prompts, advice text, and mock descriptions.
3.  **Quests - Active Quests Logs**:
    *   Quests can be standard (one-off) or repeatable (daily / weekly checkboxes).
    *   **Midnight Reset Cycle**: Daily habit check loops running in `App.tsx` evaluate unfinished quests, apply consistency level penalties, and reset checklist targets instantly at local midnight.
    *   **Sounds & Selection**: Multiple customizable audio options triggered upon check-off metrics.

### 💰 Module B: Personal Finance Ledger (INR ₹ - 100% Working)
1.  **Dynamic Dual Balances Engine**:
    *   Calculates **Net Bank Holdings** and **Physical Cash** dynamically to represent real liquidity, without relying on stale static fields:
        $$\text{Bank Holdings} = \text{Initial Bank} + \text{Incomes(Bank)} + \text{Transfers(In)} + \text{Lend Returns(Bank)} - \text{Expenses(Bank)} - \text{Investments} - \text{CC Bill Payments}$$
        $$\text{Physical Cash} = \text{Initial Cash} + \text{Incomes(Cash)} + \text{Transfers(In)} + \text{Lend Returns(Cash)} - \text{Expenses(Cash)} - \text{CC Bill Payments(Cash)}$$
    *   Supports dynamic adjustments to starting balances through the **Adjust Open** action sheets.
2.  **Flexible Range-Statistical Filters**:
    *   Toggles between **Today / Week / Month / Year** filters instantly.
    *   Sums income, expenditures (outflows), active investments, and calculates real-time net **Cash Flow**.
    *   Dynamic bar progress indicators visualize expenditures across over 50 specific categories.
3.  **Gross Salary Deductions Ledger**:
    *   Records actual *Net Payout* received inside the bank account.
    *   Collects customizable deductions (Tax, EPF, Canteen Recovery, Transport) to back-calculate and document **Total Gross Income**.
    *   **EPF Automated Loop**: If a salary deduction name matches "EPF", the system automatically logs this under EPF investments and increments the saved `epf_balance` registry setting.
4.  **Variable Shift Allowance Monitor**:
    *   Tracks expected daily shift rates multiplied by actual shifts worked.
    *   Detects if the expected amount differs from actual received funds, alerting the user with an intuitive warning banner in the ledger if discrepancies occur.
5.  **Multi-Channel Transaction Categories**:
    *   Over **50 Expense** and **20 Income** categories with pre-assigned Lucide-React icons.
6.  **Credit Card Debt Manager**:
    *   Tracks outstanding card debt and absolute card limits.
    *   **Pay Card Bill Integration**: Deducts outstanding card balances while executing a ledger layout out-flow from Bank or Cash accounts, categorizing it under EMI payments.
7.  **Mutual Lending Registry**:
    *   Tracks borrower names, dates, amounts, and source funds (Bank or Cash).
    *   Marking an entry as **Returned** sets the return date to today, reconciles state balances, and logs an inlet transaction under `lending_return` to offset the asset.
8.  **Physical Valuations & Actives**:
    *   Tracks premium payment lifespans for Insurance policies (Term filters) and valuations of tangible assets (Bike, Car, etc.) to calculate comprehensive net-worth profiles.

---

## 🗄️ Durable IndexedDB Database Schemas (Dexie.js)

The Dexie instance `LifeQuestDB` runs on **Version 5**. Keep this database store configuration intact:

```typescript
this.version(5).stores({
  categories: 'id',
  userStats: 'id',
  goals: 'id, skillId',
  categoryConsistencies: 'categoryId',
  settings: 'id', // Handles persistent configuration parameters (initial bank holdings, EPF balances)
  history: 'date',
  questHistory: 'id, goalId, skillId, completedAt',
  
  // Finance Module Tables:
  financeIncomes: 'id, date, sourceCategory',
  financeExpenses: 'id, date, category',
  financeInvestments: 'id, date, type',
  financeLending: 'id, personName, returnedStatus',
  financeInsurance: 'id',
  financeAssets: 'id',
  financeTransfers: 'id, date',
  financeCreditCards: 'id'
});
```

---

## 📡 Messaging and Service Worker Pipelines

*   **BroadcastChannel Integration**:
    *   Uses channel `'lifequest_channel'` to communicate between background tasks and the UI layer.
    *   Enables automated check-ins via local OS notification action buttons (Service Worker backgrounds) through deep-link redirection parameters:
        ```typescript
        const urlParams = new URLSearchParams(window.location.search);
        const completeId = urlParams.get('completeId');
        if (completeId) {
          toggleGoalCompletion(completeId);
        }
        ```

---

## 🚫 Dev Rules & Precautions (Crucial Logical Lines)

1.  **State Rebuild Warning**:
    *   Never read or save balances directly as physical static props without querying other transaction types. Always run live balance calculators using the `useMemo` hooks configured in `FinanceTracker.tsx`.
2.  **No Unrequested Theme Selectors**:
    *   Do not implement visual toggles for themed backgrounds. Stick exclusively to the slate dark-canvas aesthetic.
3.  **Deduction Matching side-effects**:
    *   Do not alter the string match condition `'EPF'` in the salary deduction compiler. Changing this string will disrupt automated calculations for EPF retirement investments.
4.  **No HMR (Hot Module Replacement) Support**:
    *   The browser dev frame runs with `DISABLE_HMR=true`. Ensure state dependencies are clean to prevent page flashes during data refreshes.
5.  **TypeScript Verification**:
    *   Always run `npm run lint` (`tsc --noEmit`) to verify that the application compiles without warnings. Keep imports grouped at the top level and avoid mock imports.
