import { ChangeEvent, useState } from 'react';
import { Category, CompletedQuest, Goal, GoalDailyProgress, HistoryRecord, Routine, ScorecardRating, UserStats } from '../types';
import { HabitAction } from '../habits/habitDomain';
import { ThemeId } from '../theme';
import StatsView from './StatsView';
import ProfileView from './ProfileView';
import SkillsView from './SkillsView';
import QuestsView from './QuestsView';
import RoutinesView from './RoutinesView';
import FinanceView from './FinanceView';
import { useSwipeTabs } from '../hooks/useSwipeTabs';

type TerminalTab = 'quests' | 'routines' | 'skills' | 'stats' | 'finance' | 'settings';

const TABS: TerminalTab[] = ['quests', 'routines', 'skills', 'stats', 'finance', 'settings'];

interface TerminalShellProps {
  isLoaded: boolean;
  userStats: UserStats;
  categories: Category[];
  goals: Goal[];
  history: HistoryRecord[];
  questHistory: CompletedQuest[];
  routines: Routine[];
  goalDailyProgress: GoalDailyProgress[];
  theme: ThemeId;
  onToggleGoal: (goalId: string) => void;
  onHabitAction: (goalId: string, action: HabitAction) => void;
  onThemeChange: (theme: ThemeId) => void;
  onSaveIdentity: (name: string, title: string) => void;
  onSelectMentor: (mentor: NonNullable<UserStats['mentorPersonality']>) => void;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  onAddCategory: (name: string, icon: string, color: string) => void;
  onEditCategory: (id: string, name: string, icon: string, color: string) => void;
  onDeleteCategory: (id: string) => void;
  onAddSkill: (categoryId: string, name: string, description: string, xpReward: number, icon: string) => void;
  onEditSkill: (id: string, name: string, description: string, icon?: string) => void;
  onDeleteSkill: (id: string) => void;
  onUnlockSkill: (categoryId: string, skillId: string) => void;
  onSaveGoal: (goal: Goal) => void;
  onDeleteGoal: (id: string) => void;
  onSaveRoutine: (routine: Routine) => void;
  onDeleteRoutine: (id: string) => void;
  onMoveRoutine: (id: string, direction: -1 | 1) => void;
  onUpdateHabitSettings: (settings: Partial<UserStats>) => void;
  onRateScorecard: (goalId: string, rating: ScorecardRating | undefined) => void;
  onAddScorecardQuests: (created: Goal[]) => void;
  onApplyGoldilocks: (goalId: string, kind: 'easier' | 'harder') => void;
  onDismissGoldilocks: (goalId: string) => void;
  onSkipAndSave: (goal: Goal) => void | Promise<void>;
  onNotificationSound: (sound: string) => void;
  onEnableNotifications: () => void;
  onInstall: () => void;
  canInstall: boolean;
  onTestSound: () => void;
  onRefresh: () => void;
  notification: { title?: string; message: string; xp: number } | null;
}

export default function TerminalShell({
  isLoaded,
  userStats,
  categories,
  goals,
  history,
  questHistory,
  routines,
  goalDailyProgress,
  theme,
  onToggleGoal,
  onHabitAction,
  onThemeChange,
  onSaveIdentity,
  onSelectMentor,
  onExport,
  onImport,
  onReset,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onAddSkill,
  onEditSkill,
  onDeleteSkill,
  onUnlockSkill,
  onSaveGoal,
  onDeleteGoal,
  onSaveRoutine,
  onDeleteRoutine,
  onMoveRoutine,
  onUpdateHabitSettings,
  onRateScorecard,
  onAddScorecardQuests,
  onApplyGoldilocks,
  onDismissGoldilocks,
  onSkipAndSave,
  onNotificationSound,
  onEnableNotifications,
  onInstall,
  canInstall,
  onTestSound,
  onRefresh,
  notification,
}: TerminalShellProps) {
  const [tab, setTab] = useState<TerminalTab>('quests');
  const swipeTabs = useSwipeTabs<TerminalTab>(TABS, tab, setTab);

  return (
    <div className="term-root" {...swipeTabs}>
      <nav className="term-tabs" role="tablist" aria-label="Terminal sections">
        {TABS.map(entry => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={tab === entry}
            className={`term-tab${tab === entry ? ' is-active' : ''}`}
            onClick={() => setTab(entry)}
          >
            {entry === 'quests' ? 'habits' : entry === 'settings' ? 'profile' : entry}
          </button>
        ))}
      </nav>

      <main className="term-body">
        {!isLoaded ? (
          <p className="term-comment">{'// loading local database...'}</p>
        ) : tab === 'skills' ? (
          <SkillsView
            userStats={userStats}
            categories={categories}
            onAddCategory={onAddCategory}
            onEditCategory={onEditCategory}
            onDeleteCategory={onDeleteCategory}
            onAddSkill={onAddSkill}
            onEditSkill={onEditSkill}
            onDeleteSkill={onDeleteSkill}
            onUnlockSkill={onUnlockSkill}
          />
        ) : tab === 'stats' ? (
          <StatsView
            userStats={userStats}
            categories={categories}
            goals={goals}
            history={history}
            questHistory={questHistory}
            goalDailyProgress={goalDailyProgress}
          />
        ) : tab === 'quests' ? (
          <QuestsView
            userStats={userStats}
            categories={categories}
            goals={goals}
            history={history}
            routines={routines}
            goalDailyProgress={goalDailyProgress}
            onToggleGoal={onToggleGoal}
            onHabitAction={onHabitAction}
            onSaveGoal={onSaveGoal}
            onDeleteGoal={onDeleteGoal}
            onApplyGoldilocks={onApplyGoldilocks}
            onDismissGoldilocks={onDismissGoldilocks}
            onSkipAndSave={onSkipAndSave}
          />
        ) : tab === 'routines' ? (
          <RoutinesView
            userStats={userStats}
            routines={routines}
            goals={goals}
            goalDailyProgress={goalDailyProgress}
            onHabitAction={onHabitAction}
            onSaveRoutine={onSaveRoutine}
            onDeleteRoutine={onDeleteRoutine}
            onMoveRoutine={onMoveRoutine}
            onSaveGoal={onSaveGoal}
          />
        ) : tab === 'finance' ? (
          <FinanceView userStats={userStats} />
        ) : (
          <ProfileView
            userStats={userStats}
            theme={theme}
            onThemeChange={onThemeChange}
            onSaveIdentity={onSaveIdentity}
            onSelectMentor={onSelectMentor}
            onExport={onExport}
            onImport={onImport}
            onReset={onReset}
            onNotificationSound={onNotificationSound}
            onEnableNotifications={onEnableNotifications}
            onInstall={onInstall}
            canInstall={canInstall}
            onTestSound={onTestSound}
            onRefresh={onRefresh}
            routines={routines}
            goals={goals}
            onUpdateHabitSettings={onUpdateHabitSettings}
            onRateScorecard={onRateScorecard}
            onAddScorecardQuests={onAddScorecardQuests}
          />
        )}
      </main>
      {notification && (
        <aside className="term-toast" role="status">
          <p><span className="term-state-on">[ok]</span> {notification.title ?? 'habit completed'}</p>
          <p className="term-comment">{`// ${notification.message}${notification.xp > 0 ? ` · +${notification.xp}xp` : ''}`}</p>
        </aside>
      )}
    </div>
  );
}
