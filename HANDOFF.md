# LifeQuest — project handoff

This is the working source of truth for the next person (or agent) picking up the repo. It reflects the code on `main` as of 2026-09-25, not the older “slate-only / Dexie v5 / App tabs only” description.

**Product:** local-first life RPG. Skills, quests/habits, routines, Atomic Habits coaching, INR finance ledger, and optional Gemini quest generation. Data lives in IndexedDB (`LifeQuestDB`). There is no app backend except the optional Cloudflare Web Push worker.

**Live web:** [https://thatstej45.github.io/lifequest/](https://thatstej45.github.io/lifequest/)  
**Repo:** [thatstej45/lifequest](https://github.com/thatstej45/lifequest)

---

## What to run

Prerequisites: Node.js 22 (CI uses 22). Gemini is optional.

```bash
npm install
# optional: GEMINI_API_KEY in .env.local
npm run dev          # Vite, port 3000, host 0.0.0.0
npm run lint         # tsc --noEmit (no ESLint)
npm run build        # PWA icons + SW version + Vite
```

Habit math tests are assert scripts, not wired into `package.json`:

```bash
npx tsx src/habits/phaseA.test.ts
npx tsx src/habits/phaseB.test.ts
npx tsx src/habits/phaseC.test.ts
npx tsx src/habits/dayBoundary.test.ts
```

Android (same web app in a WebView, not a second React tree): JDK **21** (not 26), SDK at `~/Library/Android/sdk`. See `README.md` for `android:sync`, `android:open`, `android:apk`.

---

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19, Vite 6, TypeScript ~5.8 |
| CSS | Tailwind v4 via `@tailwindcss/vite`; theme tokens in `src/index.css` |
| Motion | `motion` (Framer Motion successor) |
| Charts | Recharts |
| Audio | Howler.js, Mixkit CDN clips |
| Persistence | Dexie 4 / IndexedDB |
| Native | Capacitor 8 Android only (`com.lifequest.app`) |
| OTA | `@capgo/capacitor-updater` + `gh-pages` `update.json` |
| AI | `@google/genai`, model `gemini-3-flash-preview` |
| Push (iOS PWA / web) | Cloudflare Worker + D1 in `push-worker/` |

`GEMINI_API_KEY` is inlined at build time in `vite.config.ts` (`process.env.GEMINI_API_KEY`). Keep it out of public commits. Settings also allow a custom key at runtime.

Vite `base` is `'./'` so GitHub Pages `/lifequest/` works. `DISABLE_HMR=true` turns HMR off (AI Studio / agent-edit flicker).

---

## Architecture in one paragraph

`src/main.tsx` applies theme + platform flags, starts live-update polling, then mounts `App`. Almost all RPG/habit state lives in **`src/App.tsx`** (~5.8k lines): load/save Dexie, day rollover, XP, reminders, export/import, claymorphic UI. If `localStorage.lifequest_theme === 'terminal'`, `App` returns `TerminalShell` instead and the clay tree is not mounted. Finance is a lazy `FinanceTracker` (clay) or `terminal/FinanceView`; both should use `useFinanceLedger()` so balances stay identical.

```
src/
  App.tsx                 # god module: state + clay UI
  db.ts                   # LifeQuestDB, versions 5–11
  types.ts                # domain types
  progression.ts          # Habitica-like XP curve
  theme.ts                # claymorphic | terminal
  platform.ts             # Capacitor / touch / reduced motion
  liveUpdate.ts           # OTA + web SW refresh
  habits/                 # pure habit engine + coaching
  analytics/              # history + per-habit metrics
  finance/                # ledger hook + INR categories
  terminal/               # second UI, same callbacks
  services/               # Gemini, reminders, web push
  components/             # clay charts, coaching panels, finance
push-worker/              # Web Push scheduler
android/                  # Capacitor native project
```

---

## Dual UI (do not assume clay-only)

| Theme | Storage | Root | Tabs |
| --- | --- | --- | --- |
| Claymorphic (default) | `lifequest_theme` | rest of `App.tsx` | `home` · `stats` · `goals` · `routines` · `finance` |
| Terminal | same key `=== 'terminal'` | `src/terminal/TerminalShell.tsx` | `quests` · `routines` · `skills` · `stats` · `finance` · `settings` |

Swipe between tabs: `useSwipeTabs`. Density (`compact` / `cozy` / `relaxed`) is on `UserStats.appearanceDensity`. Native/touch devices get lighter backgrounds via `wantsLightweightBackground()`.

**Rule:** domain logic belongs in `habits/`, `progression.ts`, `analytics/`, `finance/useFinanceLedger.ts`. Both themes must call the same functions. If you change XP, completion, or balances in one UI only, the other theme will drift.

---

## Data: Dexie `LifeQuestDB` (current version **11**)

Schema shape (indexes) is stable from v6 onward; later versions add fields and one extra goal index.

**Tables owned by `App` React state** (cleared + bulkPut on every save after load):

- `userStats` — single row `id: 'main'`
- `categories` — skill trees
- `goals` — quests/habits (`skillId`, `routineId`, `trackingMode`, `habitKind`)
- `routines`
- `goalDailyProgress` — per day (`[goalId+date]`)
- `categoryConsistencies`

**Tables mutated directly** (not in the App bulk-save transaction):

- `history` — daily completion records (`date` key). Written in day-rollover / daily-goal code.
- `questHistory` — individual completions
- Finance tables + `settings` — via `useFinanceLedger` / `FinanceTracker`

**`settings` keys (finance):** `initial_bank_balance`, `initial_cash_balance`, `initial_epf_balance` (legacy `epf_balance`), `custom_bank_accounts`, `custom_finance_categories`.

### Version upgrades (do not skip or rewrite casually)

| Ver | Why |
| --- | --- |
| 5 | Original finance tables |
| 6 | `routines`, `goalDailyProgress`; tracking fields on goals; habit stats |
| 7 | Identity statements, recovery counters; cap identity index |
| 8 | `habitKind` default `build` |
| 9 | Mentor `Sarcastic` → `Snarky` |
| 10 | Sanitize `stackAfterGoalId` (same routine, no self) |
| 11 | Index `habitKind`; default `breakInversions` for break/replace |

Constants: `PROGRESSION_VERSION = 2`, `HABIT_DATA_VERSION = 4`. On load, App migrates XP curves if `progressionVersion` differs, and backfills missing habit fields.

**Dates:** a habit day runs **03:00 → 03:00 local** (`src/dayBoundary.ts`, `DAY_START_HOUR = 3`). `dateKey()` in `habitDomain.ts` is the only thing that should name a habit day; it returns the previous date until the cutoff passes, so work logged at 01:00 still counts for the evening the user is finishing. `habitDayDate()` gives the same shift as a `Date` (used wherever a weekday matters) and `msUntilNextDayStart()` schedules the reset. Analytics defaults use `habitDayDate()` so windows agree with the stored progress keys. Do not use `toISOString().slice(0,10)` or raw `getDay()` for habit days. Finance rows deliberately stay on the real calendar date.

---

## RPG / skill trees

Seed trees: Physical, Financial, Social, Mental, Career, Personality (`src/constants.ts`). Skills unlock with **skill points** (SP) from player level-ups; Expert/Master specializations gate some quests (`requiredSpecialization`).

XP (`src/progression.ts`):

- Level threshold: Habitica-style (`xpRequiredForLevel`).
- Quest base = `10 × difficulty × cadence` (daily 1×, weekly 2×, one-off 3×).
- Streak multipliers 1.0 → 1.5 at 90 days; Expert 1.2×, Master 1.5×.
- Two-minute log awards **25%** of full XP (`TWO_MINUTE_XP_RATIO`).
- Daily check-in in clay home grants +10 XP (localStorage `daily_checkin_claimed_date`).

Gemini (`src/services/geminiService.ts`) generates quest packs / guides; failures should stay user-visible, not crash load.

---

## Habit engine (`src/habits/`)

Source of truth for completion is **`goalDailyProgress`**, not only `Goal.completed`. `applyHabitAction` is the reducer.

**Tracking modes:** `checkbox` | `counter` | `numeric` | `timer` | `health` (health never completes / never reminds).

**Repeat:** `none` / daily (`isRepeatable` treated as daily) / weekly `repeatDays` (0 = Sunday).

**Day rollover** (`checkDayChange` in `App.tsx`): when `lastLoginDate !== dateKey()`, i.e. once 03:00 passes:

1. If the key moved *backwards*, adopt it and stop — that is a cutoff/clock shift, not a finished day.
2. Resolve player streak vs daily goal %, pause, streak shields.
3. Reset `completed` on daily habits; weekly if the new habit day is a scheduled weekday.
4. Optional consecutive-miss XP penalty (`consecutiveMissPenaltyXp`).
5. Write `history` for the previous day.

It is driven by the 15-second reminder loop plus a `visibilitychange` / `focus` listener, because phones freeze timers in the background. A separate effect fires at the next 03:00 and clears any repeatable `completed` flag whose `completionDayKey(lastCompletedAt)` is no longer today; it defers to the rollover so streak handling is never pre-empted.

**Pause:** `pauseMode` `none` | `vacation` | `sick` (+ `pauseUntil`). Pause skips streak damage and push reminders.

### Atomic Habits features (phased; keep user-approved)

Phase 1 — identity (max 3 statements), implementation intention (`I will {title} at {time} in {place}`), habit stacking (`stackAfterGoalId` same routine, cycle-checked), two-minute mode, never-miss-twice recovery, trajectory analytics.

Phase 2 — scorecard `+` / `−` / `=`, Goldilocks easier/harder **suggestions only** (14-day dismiss), temptation bundling, skip-and-save, mentor copy, earliest complete time.

Phase 3 — quarterly review, accountability share (`@capacitor/share`), break/replace habits + 4-law inversions.

Supporting files: `goldilocks.ts`, `scorecard.ts`, `commitment.ts`, `breakMode.ts`, `quarterlyReview.ts`, `accountability.ts`, `mentorCopy.ts`, `mentorPersonality.ts` (`Supportive` | `Snarky` | `Stoic`), `financeHonor.ts`.

**Skip-and-save:** `logSkipAndSave` writes a **cash** `financeExpenses` row, category `savings`. It does not move bank money; it is an honor log. Clay and terminal both call this.

Analytics for Stats: `src/analytics/` (`buildHistoryAnalytics`, `buildHabitAnalytics`). Charts live in `src/components/charts/`.

---

## Finance (INR)

Ledger math is **derived**, never a stored running balance. Use `useFinanceLedger()` (`src/finance/useFinanceLedger.ts`). Clay `FinanceTracker.tsx` still contains a lot of UI; keep its formulae aligned with the hook.

Approximate live balances:

- **Cash** = initial cash + cash incomes − cash expenses − cash pending loans ± cash legs of transfers.
- **Each bank** = that account’s opening + bank incomes − bank expenses − non-EPF investments ± transfers − pending bank loans.
- **EPF** = `initial_epf_balance` + **2 ×** salary deductions whose **name is exactly `"EPF"`** (employee + employer). Do not rename that match string.
- Non-EPF investments drain the bank; EPF type on `financeInvestments` does not.
- **Net worth** ≈ bank + cash + invested (incl. EPF) + assets + pending lending − card debt.

Range filters: today / week / month / year. Categories: `src/finance/categories.ts`. Credit cards, lending return (income `lending_return`), insurance, physical assets are first-class tables.

---

## Notifications (three backends)

| Surface | Backend | Code |
| --- | --- | --- |
| Android APK | Capacitor Local Notifications | `src/services/habitReminders.ts` |
| Desktop / Android Chrome PWA | Notification API + `public/sw.js` while the client can run | same + SW |
| iOS Home Screen PWA | Web Push via Cloudflare Worker | `src/services/webPush.ts`, `push-worker/` |

- BroadcastChannel `'lifequest_channel'`: SW `COMPLETE_QUEST` → `completeHabitFromExternalAction`.
- Deep link `?completeId=` same path.
- Native actions: Done / Dismiss; channel `lifequest-reminders-v2`.
- iOS cannot schedule local future wakes for a closed PWA; without the worker, reminders only fire while the app is open.
- Deploy worker: `push-worker/README.md`. GitHub Actions var `VITE_PUSH_API_URL`. Never rotate VAPID keys after users subscribe.
- Pause mode sends an empty reminder list (worker / native sync).

CI: `verify-push-worker` typechecks and `wrangler deploy --dry-run`.

---

## Release, PWA, Android OTA

`.github/workflows/release-mobile.yml` on push to `main`:

1. `BUNDLE_VERSION=1.0.${{ github.run_number }}` web build.
2. `scripts/package-ota.mjs` → `update.json` + zip on `gh-pages`.
3. Pages site = `dist` + OTA files (`force_orphan`).
4. Capacitor sync + debug APK artifact.

Phone OTA: `src/liveUpdate.ts` reads  
`https://raw.githubusercontent.com/thatstej45/lifequest/gh-pages/update.json`.  
Native plugin autoUpdate is **off** in `capacitor.config.ts`; JS drives download/apply. Native plugin/permission/icon changes still need a new APK.

PWA: `public/manifest.json`, `public/sw.js` (network-first, version stamped by `scripts/sync-sw-version.mjs`). iOS: Safari → Add to Home Screen; enable notifications in Profile.

---

## Import / export / reset

Clay settings and terminal settings expose JSON export/import and full reset. Import writes RPG + history + finance tables. Treat export as the backup story; there is no cloud user account.

---

## Guardrails for the next change

1. **Do not store bank/cash as the only source of truth.** Recompute from openings + transactions.
2. **Keep EPF deduction name `'EPF'`.**
3. **Habit completion goes through `applyHabitAction` / `handleHabitAction`.** Don’t toggle `goal.completed` in isolation or XP and progress will desync.
4. **Stacking is routine-scoped.** Use `validStackAnchors` / `wouldCreateStackCycle`; Dexie v10 already strips invalid anchors.
5. **Goldilocks never auto-applies.**
6. **`App.tsx` save clears tables then bulkPuts.** Avoid extra Dexie writes on those tables from other components or you will race the bulk save.
7. **`history` / `questHistory` / finance are not in that bulk save.** Persist them at the mutation site.
8. **Both themes.** Touch clay and terminal (or shared domain only).
9. **Lint = `tsc --noEmit`.** Run it before considering a feature done.
10. **Port 3000** is the documented dev port; keep it unless the user asks otherwise.

---

## Known shape / debt (intentional context, not a punch list)

- `App.tsx` is oversized: clay UI, persistence, rollover, and notification loops in one file. Splitting hooks (`useLifeQuestState`) would be the highest-leverage refactor; do it only with tests around rollover and `handleHabitAction`.
- Clay `FinanceTracker.tsx` is still large; terminal already uses the shared ledger hook—prefer migrating clay fully onto it rather than duplicating formulae.
- God-object `UserStats` mixes RPG, habits, mentor, pause, and review fields.
- Howler Mixkit URLs require network for SFX.
- `package.json` name is still `"react-example"`.
- Existing `HANDOFF.md` previously claimed Dexie v5, no theme switcher, and a single dark-slate UI. Those statements are false now.

---

## Recent `main` history (why the repo looks like this)

Sideload Android + OTA → terminal UI + routines + swipe → Atomic Habits Phases 1–3 → GitHub Pages as the real app → Web Push instead of native iOS → reminder polish (quest title, no duplicate bodies).

Latest commits around notifications: `fb9596b`, `b8f13f3`, `b6f6472`.

---

## Suggested next work (only if asked)

Highest value, lowest philosophy:

1. Extract habit persistence + rollover from `App.tsx` with the existing phase tests as a harness.
2. Finish clay finance on `useFinanceLedger` only.
3. Add `npm test` that runs the three habit scripts (and a ledger unit test for EPF × 2).
4. Document `VITE_PUSH_API_URL` / VAPID status in README if the worker is already live.

When implementing UI, verify clay **and** terminal, plus day change (set `lastLoginDate` to yesterday in IndexedDB) and one reminder path for the platform you care about.
