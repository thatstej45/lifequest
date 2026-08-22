/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Activity, 
  Wallet, 
  Users, 
  Brain, 
  Briefcase, 
  User, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Plus, 
  Heart, 
  Zap, 
  Trophy,
  Home,
  BarChart3,
  Settings,
  CheckCircle2,
  Circle,
  Lock,
  X,
  Target,
  Trash2,
  Download,
  Upload,
  Edit2,
  AlertCircle,
  Star,
  Flame,
  Book,
  Code,
  Music,
  Camera,
  Dumbbell,
  Coffee,
  Gamepad2,
  Palette,
  Languages,
  Globe,
  GraduationCap,
  Clock,
  Calendar,
  TrendingUp,
  DollarSign,
  Sparkles,
  Ban,
  Skull,
  Ghost,
  Bell,
  Volume2,
  Sun,
  Sunset,
  Moon,
  Check,
  CalendarCheck,
  Copy
} from 'lucide-react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import {
  Category, UserStats, Goal, Skill, CategoryId, CategoryConsistency, HistoryRecord,
  CompletedQuest, QuestDifficulty, Routine, GoalDailyProgress,
} from './types';
import { INITIAL_CATEGORIES } from './constants';
import DynamicBackground from './components/layout/DynamicBackground';
import NavButton from './components/layout/NavButton';
import { HabitIcon, IconPicker } from './components/icons';
import { ContributionHeatmap, MonthCalendar, TrendBars, WeekdayBars, WeeklyHabitMatrix } from './components/charts';
import TerminalShell from './terminal/TerminalShell';
import { applyTheme, getStoredTheme, THEME_OPTIONS, ThemeId } from './theme';
import {
  applyXp,
  calculateQuestReward,
  inferDifficulty,
  migrateLevelProgress,
  PROGRESSION_VERSION,
  QUEST_DIFFICULTIES,
  questBaseReward,
  streakMultiplier,
  xpRequiredForLevel,
} from './progression';
import {
  applyHabitAction,
  dateKey,
  dailyGoalSummary,
  emptyProgress,
  effectiveProgressValue,
  HABIT_DATA_VERSION,
  habitProgressPercent,
  HabitAction,
  isHabitComplete,
  isGoalScheduled,
  resolveDailyStreak,
  trackingMode,
} from './habits/habitDomain';

import { Howl } from 'howler';

const FinanceTracker = lazy(() => import('./components/FinanceTracker'));

// --- Audio Manager ---
const NOTIF_SOUNDS = {
  'bling': 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  'minimal': 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  'crystal': 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  'achievement': 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3'
};

const sounds: Record<string, Howl> = {
  levelUp: new Howl({ src: [NOTIF_SOUNDS.achievement] }),
  questComplete: new Howl({ src: [NOTIF_SOUNDS.bling] }),
  skillUnlock: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'] }),
  click: new Howl({ src: [NOTIF_SOUNDS.minimal], volume: 0.5 }),
  // Variants for selection
  bling: new Howl({ src: [NOTIF_SOUNDS.bling] }),
  minimal: new Howl({ src: [NOTIF_SOUNDS.minimal] }),
  crystal: new Howl({ src: [NOTIF_SOUNDS.crystal] }),
};

const playSound = (soundName: string) => {
  try {
    let soundKey = soundName;
    if (soundName === 'notification') {
      soundKey = localStorage.getItem('quest_rpg_notif_sound') || 'bling';
    }

    const sound = sounds[soundKey];
    if (sound) {
      if (sound.playing()) {
        sound.stop();
      } else {
        // Stop all other sounds in the same category if needed
        if (['bling', 'minimal', 'crystal'].includes(soundKey)) {
          ['bling', 'minimal', 'crystal'].forEach(k => {
            if (k !== soundKey) sounds[k].stop();
          });
        }
        sound.play();
      }
    }
  } catch (e) {
    console.warn('Audio playback failed', e);
  }
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getQuestMultiplier = streakMultiplier;

// --- Components ---

const STREAK_MILESTONES = [3, 7, 21, 30, 90, 180, 365];

const StreakProgress = ({ streak, isRepeatable }: { streak: number, isRepeatable?: boolean }) => {
  if (streak === 0 && !isRepeatable) return null;
  
  const nextMilestone = STREAK_MILESTONES.find(m => m > streak) || STREAK_MILESTONES[STREAK_MILESTONES.length - 1];
  const prevMilestone = [...STREAK_MILESTONES].reverse().find(m => m <= streak) || 0;
  
  const progress = ((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100;
  
  return (
    <div className="mt-1.5 space-y-1 max-w-[150px]">
      <div className="flex justify-between text-[7px] font-black uppercase text-gray-500 tracking-wider">
        <span>{streak}D / {nextMilestone}D</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-gradient-to-r from-orange-600 to-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.3)]"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
    </div>
  );
};

const ProgressBar = ({ value, max, color, className }: { value: number, max: number, color: string, className?: string }) => {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn("w-full bg-slate-205/70 rounded-full h-2.5 p-[1px] border border-white/50 shadow-[inset_1px_1.5px_3px_rgba(148,163,184,0.3)] overflow-hidden", className)}>
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        className="h-full rounded-full"
        style={{ 
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          boxShadow: `inset 1.5px 1.5px 2px rgba(255, 255, 255, 0.45), inset -1px -1px 2px rgba(0, 0, 0, 0.15), 0px 1px 3px ${color}35`
        }}
      />
    </div>
  );
};

const getIcon = (name: string, size = 20, color = "currentColor") => {
  return <HabitIcon name={name} size={size} color={color} />;
};

const CategoryCard = React.memo(({ cat, onSelect, onEdit, onDelete, deletingId, setDeletingId }: { 
  cat: Category, 
  onSelect: (id: string) => void,
  onEdit: (cat: Category) => void,
  onDelete: (id: string) => void,
  deletingId: string | null,
  setDeletingId: (id: string | null) => void
}) => (
  <motion.div
    key={`cat-grid-${cat.id}`}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={() => onSelect(cat.id)}
    className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col gap-3 text-left hover:border-gray-600 transition-all group cursor-pointer"
    role="button"
    tabIndex={0}
  >
    <div className="flex items-center justify-between">
      <div 
        className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/80 active:scale-95 transition-transform shrink-0" 
        style={{ 
          background: `linear-gradient(135deg, ${cat.color}da, ${cat.color}ff)`,
          boxShadow: `
            0px 6px 14px ${cat.color}40, 
            inset 2.5px 2.5px 5px rgba(255, 255, 255, 0.55), 
            inset -2.5px -2.5px 5px rgba(0, 0, 0, 0.22)
          `
        }}
      >
        {getIcon(cat.icon, 18, "#ffffff")}
      </div>
      <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
        {deletingId === cat.id ? (
          <div className="flex gap-1">
            <button 
              onClick={() => onDelete(cat.id)}
              className="px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-black uppercase"
            >
              Delete
            </button>
            <button 
              onClick={() => setDeletingId(null)}
              className="p-2 rounded-xl bg-gray-800 text-gray-400 border border-gray-700"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onEdit(cat)}
              className="p-2 clay-edit-btn shadow-md"
            >
              <Edit2 size={12} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setDeletingId(cat.id)}
              className="p-2 clay-delete-btn shadow-md"
            >
              <Trash2 size={12} />
            </motion.button>
          </>
        )}
      </div>
    </div>
    <div>
      <h3 className="font-bold text-sm">{cat.name}</h3>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
          {cat.skills.length} Skills Active
        </p>
        {cat.skills.some(s => s.isUnlocked && s.perks?.some(p => s.level < p.level)) && (
          <div className="flex items-center gap-0.5 bg-blue-500/10 px-1 rounded text-[7px] font-black text-blue-400 uppercase">
            <Star size={7} /> Perks
          </div>
        )}
      </div>
    </div>
    <div className="mt-1">
      <ProgressBar 
        value={cat.skills.length > 0 ? cat.skills.reduce((acc, s) => acc + s.level, 0) : 0} 
        max={Math.max(1, cat.skills.length) * 10} 
        color={cat.color} 
      />
    </div>
  </motion.div>
));

const SkillItem = React.memo(({ 
  skill, 
  userStats, 
  categories, 
  editingId, 
  deletingId, 
  onUnlock, 
  onEdit, 
  onDelete, 
  setEditingId, 
  setDeletingId, 
  editingValue, 
  setEditingValue, 
  editingDescription, 
  setEditingDescription,
  handleEditSkill,
  handleDeleteSkill,
  userLevel,
  xpMultiplier,
  color
}: { 
  skill: Skill, 
  userStats: any, 
  categories: Category[], 
  editingId: string | null,
  deletingId: string | null,
  onUnlock: (id: string, cost: number) => void,
  onEdit: (id: string) => void,
  onDelete: (id: string) => void,
  setEditingId: (id: string | null) => void,
  setDeletingId: (id: string | null) => void,
  editingValue: string,
  setEditingValue: (v: string) => void,
  editingDescription: string,
  setEditingDescription: (v: string) => void,
  handleEditSkill: (id: string, name: string, desc: string) => void,
  handleDeleteSkill: (id: string) => void,
  userLevel: number,
  xpMultiplier: number,
  color: string
}) => {
  const isLocked = skill.prerequisites?.some(preId => {
    const preSkill = categories.flatMap(c => c.skills).find(s => s.id === preId);
    return !preSkill || preSkill.level < 1;
  });

  const canUnlock = !skill.isUnlocked && !isLocked && userStats.skillPoints >= skill.spCost;

  return (
    <div 
      className={cn(
        "p-3 sm:p-4 rounded-2xl border space-y-3 transition-all",
        !skill.isUnlocked ? "bg-gray-900/20 border-gray-800/50 opacity-80" : "bg-gray-900/40 border-gray-800"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-h-[2rem]">
            {editingId === skill.id ? (
              <div className="flex-1 flex flex-col gap-2 py-1">
                <input 
                  autoFocus
                  className="w-full bg-gray-800 border border-blue-500/50 rounded-lg px-2 py-1.5 text-sm font-bold text-white outline-none"
                  value={editingValue}
                  onChange={e => setEditingValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleEditSkill(skill.id, editingValue, editingDescription);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
                <textarea
                  className="w-full bg-gray-800 border border-blue-500/50 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none resize-none h-16"
                  value={editingDescription}
                  onChange={e => setEditingDescription(e.target.value)}
                  placeholder="Skill description..."
                />
              </div>
            ) : (
              <>
                <h4 className="font-bold text-sm leading-none">{skill.name}</h4>
                {skill.specialization && (
                  <span className="text-[8px] font-black bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase shrink-0">
                    {skill.specialization}
                  </span>
                )}
              </>
            )}
          </div>
          {editingId !== skill.id && (
            <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1 text-wrap break-words">
              {!skill.isUnlocked && isLocked ? `Requires: ${skill.prerequisites?.join(', ')}` : skill.description}
            </p>
          )}
          {skill.isUnlocked && (
            <div className="space-y-2 mt-1">
              <div className="flex items-center gap-1.5 ">
                <Trophy size={10} className="text-blue-400" />
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">
                  Reward: +{Math.round(skill.xpReward * xpMultiplier)} XP
                </span>
              </div>
              {skill.perks && skill.perks.length > 0 && (
                <div className="pt-2 border-t border-gray-800/50">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-1">
                    <Star size={8} /> Skill Perks
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {skill.perks.map((perk, pIdx) => (
                      <div 
                        key={pIdx}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all",
                          skill.level >= perk.level 
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
                            : "bg-gray-800/20 text-gray-600 border-gray-800/50"
                        )}
                      >
                        LVL {perk.level}: {perk.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 min-h-[2rem]">
          {editingId === skill.id ? (
            <div className="flex gap-1">
              <button 
                onClick={() => handleEditSkill(skill.id, editingValue, editingDescription)}
                className="p-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/20"
              >
                <CheckCircle2 size={14} />
              </button>
              <button 
                onClick={() => setEditingId(null)}
                className="p-1.5 rounded-lg bg-gray-800 text-gray-400 border border-gray-700"
              >
                <X size={14} />
              </button>
            </div>
          ) : deletingId === skill.id ? (
            <div className="flex gap-1">
              <button 
                onClick={() => handleDeleteSkill(skill.id)}
                className="px-2 py-1.5 bg-red-600 text-white text-[10px] font-black rounded-lg uppercase"
              >
                Confirm
              </button>
              <button 
                onClick={() => setDeletingId(null)}
                className="p-1.5 rounded-lg bg-gray-800 text-gray-400 border border-gray-700"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              {skill.isUnlocked ? (
                <div className="flex items-center gap-1.5">
                  <div className="text-right">
                    <span className="text-[10px] font-black block text-white">LVL {skill.level}</span>
                    <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">
                      {skill.xp}/{skill.maxXp} XP · {Math.round((skill.xp / skill.maxXp) * 100)}% · {skill.maxXp - skill.xp} left
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setEditingValue(skill.name);
                        setEditingDescription(skill.description);
                        setEditingId(skill.id);
                      }}
                      className="p-1.5 rounded-lg clay-edit-btn shadow-sm"
                    >
                      <Edit2 size={12} />
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setDeletingId(skill.id);
                      }}
                      className="p-1.5 rounded-lg clay-delete-btn shadow-sm"
                    >
                      <Trash2 size={12} />
                    </motion.button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => onUnlock(skill.id, skill.spCost)}
                  disabled={!canUnlock}
                  className={cn(
                    "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                    canUnlock ? "bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20 active:scale-95" : "bg-gray-800 text-gray-600 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <Lock size={12} className={canUnlock ? "text-blue-200" : "text-gray-700"} />
                    <span>Unlock {skill.spCost} SP</span>
                  </div>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {skill.isUnlocked && (
        <ProgressBar value={skill.xp} max={skill.maxXp} color={color} className="h-1.5" />
      )}
    </div>
  );
});

const StatBadge = ({ icon: Icon, value, max, color, label }: { icon: any, value: number, max: number, color: string, label: string }) => (
  <div className="flex flex-col gap-1 flex-1">
    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
      <div className="flex items-center gap-1">
        <Icon size={12} style={{ color }} />
        <span className="truncate max-w-[80px]">{label}</span>
      </div>
      <span>{value}/{max} · {Math.round((value / max) * 100)}%</span>
    </div>
    <ProgressBar value={value} max={max} color={color} />
    {label === 'Level XP' && (
      <span className="text-[8px] font-bold text-gray-500 text-right">{max - value} XP to next level</span>
    )}
  </div>
);

const ConsistencyHistoryChart = ({ history }: { history: HistoryRecord[] }) => {
  const [range, setRange] = useState<'7D' | '21D' | '1M' | '3M' | '6M' | '1Y' | 'ALL'>('1M');

  const filteredData = useMemo(() => {
    if (history.length === 0) return [];
    const now = new Date();
    let days = 30;
    if (range === '7D') days = 7;
    else if (range === '21D') days = 21;
    else if (range === '1M') days = 30;
    else if (range === '3M') days = 90;
    else if (range === '6M') days = 180;
    else if (range === '1Y') days = 365;
    else if (range === 'ALL') return history;

    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const cutoff = dateKey(cutoffDate);
    return history.filter(r => r.date >= cutoff);
  }, [history, range]);

  return (
    <div className="space-y-4">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filteredData}>
            <defs>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} opacity={0.2} />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#4b5563', fontSize: 8 }}
              minTickGap={30}
              tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#4b5563', fontSize: 8 }}
              domain={[0, 'dataMax + 2']} 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1.5px solid rgba(226, 232, 240, 0.95)', borderRadius: '16px', fontSize: '10px', boxShadow: '0 8px 24px rgba(148, 163, 184, 0.15)', color: '#1e293b' }}
              labelStyle={{ color: '#475569', fontWeight: 'bold', marginBottom: '4px' }}
              itemStyle={{ padding: '2px 0', color: '#1e293b' }}
              labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            />
            <Legend 
              verticalAlign="top" 
              align="right" 
              height={36}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            />
            <Area 
              type="monotone" 
              dataKey="completedCount" 
              stroke="#3b82f6" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorCompleted)" 
              name="Completed"
              animationDuration={1000}
            />
            <Line 
              type="stepAfter" 
              dataKey="totalCount" 
              stroke="#4b5563" 
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              name="Total Quests"
              animationDuration={1000}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-2 no-scrollbar">
        {['7D', '21D', '1M', '3M', '6M', '1Y', 'ALL'].map((r) => (
          <button
            key={r}
            onClick={() => setRange(r as any)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
              range === r 
                ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                : "bg-gray-100 hover:bg-gray-200 text-slate-500 border-gray-200 hover:border-gray-300 hover:text-slate-800"
            )}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
};

const ClayHabitControls = ({
  goal,
  progress,
  onAction,
}: {
  goal: Goal;
  progress?: GoalDailyProgress;
  onAction: (action: HabitAction) => void;
}) => {
  const [, setTick] = useState(0);
  const mode = trackingMode(goal);
  useEffect(() => {
    if (!progress?.timerStartedAt) return;
    const timer = window.setInterval(() => setTick(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [progress?.timerStartedAt]);
  const now = new Date();
  const value = mode === 'timer'
    ? Math.floor((progress ? effectiveProgressValue(progress, now) : 0) / 60)
    : progress?.value ?? 0;
  const target = goal.targetValue ?? 1;
  const percent = habitProgressPercent(goal, progress, now);

  if (mode === 'checkbox') return null;
  if (mode === 'health') {
    return <p className="text-[9px] text-amber-500 font-bold">Native health sync unavailable on web · non-scoring</p>;
  }
  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
        {mode === 'counter' && (
          <>
            <button type="button" className="px-2 py-1 rounded-lg bg-slate-200" onClick={() => onAction({ type: 'decrement' })}>−</button>
            <span>{value}/{target} {goal.unit}</span>
            <button type="button" className="px-2 py-1 rounded-lg bg-blue-600 text-white" onClick={() => onAction({ type: 'increment' })}>+</button>
          </>
        )}
        {mode === 'numeric' && (
          <>
            <input type="number" min="0" defaultValue={value} className="w-20 rounded-lg bg-slate-100 px-2 py-1" onBlur={event => onAction({ type: 'set', value: Number(event.target.value) })} />
            <span>/ {target} {goal.unit}</span>
          </>
        )}
        {mode === 'timer' && (
          <>
            <span>{value}/{target} min</span>
            <button type="button" className="px-2 py-1 rounded-lg bg-blue-600 text-white" onClick={() => onAction({ type: progress?.timerStartedAt ? 'timer-pause' : 'timer-start' })}>
              {progress?.timerStartedAt ? 'Pause' : 'Start'}
            </button>
            <button type="button" className="px-2 py-1 rounded-lg bg-slate-200" onClick={() => onAction({ type: 'reset' })}>Reset</button>
          </>
        )}
      </div>
      <ProgressBar value={percent} max={100} color="#10b981" className="h-1.5" />
    </div>
  );
};

const QuestItem = ({ 
  goal, 
  toggleGoalCompletion, 
  deletingId, 
  handleDeleteGoal, 
  setDeletingId, 
  setEditingQuest, 
  setNewQuestTitle, 
  setNewQuestXp, 
  setNewQuestRepeatType, 
  setNewQuestRepeatDays, 
  setManualQuestSkillId, 
  setNewQuestReminders,
  setNewQuestReminderFreq,
  setIsAddingQuest,
  categories,
  progress,
  onHabitAction,
}: { 
  goal: Goal, 
  toggleGoalCompletion: (id: string) => void,
  deletingId: string | null,
  handleDeleteGoal: (id: string) => void,
  setDeletingId: (id: string | null) => void,
  setEditingQuest: (goal: Goal) => void,
  setNewQuestTitle: (title: string) => void,
  setNewQuestXp: (xp: number) => void,
  setNewQuestRepeatType: (type: 'none' | 'daily' | 'weekly') => void,
  setNewQuestRepeatDays: (days: number[]) => void,
  setManualQuestSkillId: (id: string) => void,
  setNewQuestReminders: (times: string[]) => void,
  setNewQuestReminderFreq: (freq: 'once' | 'multiple') => void,
  setIsAddingQuest: (open: boolean) => void,
  categories: Category[],
  progress?: GoalDailyProgress,
  onHabitAction: (goalId: string, action: HabitAction) => void,
}) => (
  <motion.div
    key={`quest-log-item-${goal.id}`}
    layout
    className="p-4 rounded-2xl border transition-all flex items-center gap-4 bg-gray-900/60 border-gray-800 hover:border-blue-500/50"
  >
    <button 
      onClick={() => trackingMode(goal) === 'checkbox' && onHabitAction(goal.id, { type: 'toggle' })}
      className="transition-colors relative text-gray-600 hover:text-blue-400"
      disabled={trackingMode(goal) !== 'checkbox'}
    >
      <Circle size={24} />
    </button>
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-sm text-gray-200">
              <span className="inline-flex items-center gap-1.5"><HabitIcon name={goal.icon ?? 'Target'} size={14} />{goal.title}</span>
            </h3>
            {(goal.repeatType === 'daily' || (!goal.repeatType && goal.isRepeatable)) && (
              <span className="text-[8px] font-black bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase shrink-0">
                Daily
              </span>
            )}
            {goal.repeatType === 'weekly' && (
              <span className="text-[8px] font-black bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase shrink-0">
                Weekly ({goal.repeatDays?.map(d => DAYS_OF_WEEK[d][0]).join(',')})
              </span>
            )}
            {(!goal.repeatType || goal.repeatType === 'none') && (
              <span className="text-[8px] font-black bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded uppercase shrink-0">
                One-Time
              </span>
            )}
            <span className="text-[8px] font-black bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded uppercase shrink-0">
              {goal.difficulty ?? 'easy'}
            </span>
            {goal.reminderTimes && goal.reminderTimes.length > 0 && goal.reminderTimes.some(t => formatTimeForDisplay(t) !== 'Invalid Time') && (
                <div className="flex items-center gap-1.5 mt-1 bg-blue-500/5 px-2 py-1 rounded-lg border border-blue-500/10 self-start">
                  <Bell size={10} className="text-blue-500/70 shadow-sm" />
                  <span className="text-[7px] font-black text-blue-500/60 uppercase tracking-widest mr-0.5">Remind</span>
                  <div className="flex flex-wrap gap-1">
                    {(goal.reminderTimes || []).filter(t => t && t.includes(':') && formatTimeForDisplay(t) !== 'Invalid Time').map((time, idx, arr) => (
                      <span key={idx} className="text-[9px] font-bold text-blue-400/90 flex items-center">
                        {formatTimeForDisplay(time)}
                        {idx < arr.length - 1 && <span className="mx-1 opacity-30 leading-none">•</span>}
                      </span>
                    ))}
                  </div>
                </div>
            )}
            {goal.streak > 1 && (
              <div className="flex items-center gap-1 text-[8px] font-black bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded uppercase shrink-0">
                <Flame size={10} />
                {goal.streak}D Streak
                {getQuestMultiplier(goal.streak) > 1 && (
                  <span className="ml-1 text-orange-300">({getQuestMultiplier(goal.streak)}x)</span>
                )}
              </div>
            )}
          </div>
          <StreakProgress 
            streak={goal.streak || 0} 
            isRepeatable={goal.repeatType === 'daily' || goal.repeatType === 'weekly' || goal.isRepeatable} 
          />
          {goal.note && <p className="text-[9px] text-gray-500">{goal.note}</p>}
          <ClayHabitControls goal={goal} progress={progress} onAction={action => onHabitAction(goal.id, action)} />
        </div>
        
        <div className="flex items-center gap-3 shrink-0 py-1">
          <div className="flex items-center gap-1 text-blue-400 font-black text-[10px] uppercase tracking-widest">
            <Zap size={12} />
            {calculateQuestReward(
              goal,
              goal.streak || 0,
              categories.flatMap(category => category.skills).find(skill => skill.id === goal.skillId)?.specialization,
            )} XP
          </div>
          {deletingId === goal.id ? (
            <div className="flex gap-1">
              <button 
                onClick={() => handleDeleteGoal(goal.id)}
                className="px-2 py-1.5 rounded-lg bg-red-600 text-white text-[10px] font-black uppercase"
              >
                Delete
              </button>
              <button 
                onClick={() => setDeletingId(null)}
                className="p-1.5 rounded-xl bg-gray-800 text-gray-400 border border-gray-700"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex gap-1.5">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setEditingQuest(goal);
                  setNewQuestTitle(goal.title);
                  setNewQuestXp(goal.xpReward);
                  setNewQuestRepeatType(goal.repeatType || (goal.isRepeatable ? 'daily' : 'none'));
                  setNewQuestRepeatDays(goal.repeatDays || []);
                  setManualQuestSkillId(goal.skillId);
                  setNewQuestReminders((goal.reminderTimes || []).filter(t => t && t.includes(':') && t.length >= 4));
                  setNewQuestReminderFreq(goal.reminderFrequency || 'once');
                  setIsAddingQuest(true);
                }}
                className="p-1.5 rounded-xl clay-edit-btn shadow-md"
              >
                <Edit2 size={14} />
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setDeletingId(goal.id);
                }}
                className="p-1.5 rounded-xl clay-delete-btn shadow-md"
              >
                <Trash2 size={14} />
              </motion.button>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] font-bold text-violet-400 uppercase tracking-tighter">
          {goal.difficulty ?? 'easy'} difficulty
        </span>
        <span className="text-[10px] text-gray-600">•</span>
        <span className="text-[10px] text-gray-500 uppercase font-bold truncate">
          {categories.flatMap(c => c.skills).find(s => s.id === goal.skillId)?.name || goal.skillId}
        </span>
      </div>
    </div>
  </motion.div>
);

const AddSkillForm = ({ category, onAdd }: { category: Category, onAdd: (name: string, desc: string, xpReward: number, icon: string) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [xpReward, setXpReward] = useState('50');
  const [icon, setIcon] = useState(category.icon);

  if (!isExpanded) {
    return (
      <motion.button
        layoutId="add-skill-btn"
        onClick={() => setIsExpanded(true)}
        className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
        style={{ backgroundColor: category.color, color: '#000' }}
      >
        <Plus size={20} strokeWidth={3} />
        <span>ADD NEW SKILL</span>
      </motion.button>
    );
  }

  return (
    <motion.div
      layoutId="add-skill-btn"
      className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 space-y-4"
    >
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Skill Name</label>
        <input 
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Advanced Investing"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Description</label>
        <textarea 
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="What does this skill represent?"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none h-20"
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Base XP Reward</label>
        <input 
          type="number"
          value={xpReward}
          onChange={e => setXpReward(e.target.value)}
          placeholder="XP per quest"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>
      <IconPicker value={icon} onChange={setIcon} color={category.color} label="Skill icon" />
      <div className="flex gap-2 pb-10">
        <button 
          onClick={() => setIsExpanded(false)}
          className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-bold text-sm hover:bg-gray-700"
        >
          CANCEL
        </button>
        <button 
          onClick={() => {
            if (name.trim()) {
              onAdd(name, desc, parseInt(xpReward) || 50, icon);
              setName('');
              setDesc('');
              setXpReward('50');
              setIcon(category.icon);
              setIsExpanded(false);
            }
          }}
          className="flex-[2] py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
          style={{ backgroundColor: category.color, color: '#000' }}
        >
          CREATE SKILL
        </button>
      </div>
    </motion.div>
  );
};

const formatTimeForDisplay = (timeStr: string) => {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return 'Invalid Time';
  try {
    const parts = timeStr.split(':');
    if (parts.length < 2) return 'Invalid Time';
    const hoursPart = parseInt(parts[0], 10);
    const minutesPart = parts[1].substring(0, 2).padStart(2, '0');
    
    if (isNaN(hoursPart) || isNaN(parseInt(minutesPart, 10))) return 'Invalid Time';
    
    const ampm = hoursPart >= 12 ? 'PM' : 'AM';
    const h12 = hoursPart % 12 || 12;
    return `${h12}:${minutesPart} ${ampm}`;
  } catch (e) {
    return 'Invalid Time';
  }
};

const CategoryForm = ({ onSave, onClose, initialData }: { onSave: (name: string, icon: string, color: string) => void, onClose: () => void, initialData?: { name: string, icon: string, color: string } }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [selectedIcon, setSelectedIcon] = useState(initialData?.icon || 'Activity');
  const [selectedColor, setSelectedColor] = useState(initialData?.color || '#3b82f6');

  const icons = [
    'Activity', 'Wallet', 'Users', 'Brain', 'Briefcase', 'User', 'Heart', 'Zap', 'Trophy', 'Star', 
    'Flame', 'Target', 'Book', 'Code', 'Music', 'Camera', 'Dumbbell', 'Coffee', 'Gamepad2', 'Palette', 
    'Languages', 'Globe', 'GraduationCap', 'Clock', 'Calendar', 'TrendingUp', 'DollarSign', 'Sparkles', 
    'Ban', 'Skull', 'Ghost'
  ];
  
  const colors = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#22c55e', // Green
    '#eab308', // Yellow
    '#a855f7', // Purple
    '#f97316', // Orange
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#8b5cf6', // Violet
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#14b8a6', // Teal
    '#6366f1', // Indigo
    '#84cc16', // Lime
    '#0ea5e9', // Sky
    '#d946ef', // Fuchsia
    '#f43f5e', // Rose
    '#64748b', // Slate
    '#78350f', // Brown
    '#475569'  // Dark Gray
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="bg-[#0f0f12] border border-gray-800 rounded-[2rem] p-6 space-y-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black italic uppercase">{initialData ? 'Edit Category' : 'New Category'}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>
      
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Category Name</label>
        <input 
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Hobbies"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Select Icon</label>
        <IconPicker value={selectedIcon} onChange={setSelectedIcon} color={selectedColor} label="Category icon" />
        <div className="hidden">
          {icons.map(icon => (
            <button
              key={`icon-select-${icon}`}
              onClick={() => setSelectedIcon(icon)}
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center border transition-all",
                selectedIcon === icon ? "bg-blue-600 border-blue-400" : "bg-gray-900 border-gray-800 hover:border-gray-600"
              )}
            >
              <div className="text-white opacity-80">
                {icon === 'Activity' && <Activity size={16} />}
                {icon === 'Wallet' && <Wallet size={16} />}
                {icon === 'Users' && <Users size={16} />}
                {icon === 'Brain' && <Brain size={16} />}
                {icon === 'Briefcase' && <Briefcase size={16} />}
                {icon === 'User' && <User size={16} />}
                {icon === 'Heart' && <Heart size={16} />}
                {icon === 'Zap' && <Zap size={16} />}
                {icon === 'Trophy' && <Trophy size={16} />}
                {icon === 'Star' && <Star size={16} />}
                {icon === 'Flame' && <Flame size={16} />}
                {icon === 'Target' && <Target size={16} />}
                {icon === 'Book' && <Book size={16} />}
                {icon === 'Code' && <Code size={16} />}
                {icon === 'Music' && <Music size={16} />}
                {icon === 'Camera' && <Camera size={16} />}
                {icon === 'Dumbbell' && <Dumbbell size={16} />}
                {icon === 'Coffee' && <Coffee size={16} />}
                {icon === 'Gamepad2' && <Gamepad2 size={16} />}
                {icon === 'Palette' && <Palette size={16} />}
                {icon === 'Languages' && <Languages size={16} />}
                {icon === 'Globe' && <Globe size={16} />}
                {icon === 'GraduationCap' && <GraduationCap size={16} />}
                {icon === 'Clock' && <Clock size={16} />}
                {icon === 'Calendar' && <Calendar size={16} />}
                {icon === 'TrendingUp' && <TrendingUp size={16} />}
                {icon === 'DollarSign' && <DollarSign size={16} />}
                {icon === 'Sparkles' && <Sparkles size={16} />}
                {icon === 'Ban' && <Ban size={16} />}
                {icon === 'Skull' && <Skull size={16} />}
                {icon === 'Ghost' && <Ghost size={16} />}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Select Color</label>
        <div className="grid grid-cols-5 gap-2">
          {colors.map(color => (
            <button
              key={`color-select-${color}`}
              onClick={() => setSelectedColor(color)}
              className={cn(
                "w-10 h-10 rounded-full border-2 transition-all",
                selectedColor === color ? "border-white scale-110" : "border-transparent"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2 pb-32">
        <button 
          onClick={onClose}
          className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-bold text-sm hover:bg-gray-700"
        >
          CANCEL
        </button>
        <button 
          onClick={() => {
            if (name.trim()) {
              onSave(name, selectedIcon, selectedColor);
              onClose();
            }
          }}
          className="flex-[2] py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all bg-blue-600 text-white"
        >
          {initialData ? 'SAVE CHANGES' : 'CREATE CATEGORY'}
        </button>
      </div>
    </motion.div>
  );
};

interface DailyCheckInProps {
  userStats: UserStats;
  setUserStats: React.Dispatch<React.SetStateAction<UserStats>>;
  goals: Goal[];
  toggleGoalCompletion: (id: string) => void;
  categories: Category[];
}

const DailyCheckIn = ({ userStats, setUserStats, goals, toggleGoalCompletion, categories }: DailyCheckInProps) => {
  const [checkedInDate, setCheckedInDate] = useState<string>(() => {
    return localStorage.getItem('daily_checkin_claimed_date') || '';
  });
  const [claimedAnimation, setClaimedAnimation] = useState(false);

  const todayStr = dateKey();
  const isCheckedInToday = checkedInDate === todayStr;

  // Personalized Greeting
  const getGreeting = () => {
    const hours = new Date().getHours();
    const name = userStats.name || 'Player One';
    if (hours < 12) return { text: `Good morning, ${name}!`, sub: "Smash your morning routine and level up!", icon: Sun, color: "text-amber-500" };
    if (hours < 18) return { text: `Good afternoon, ${name}!`, sub: "Keep the momentum going strong!", icon: Sunset, color: "text-orange-500" };
    return { text: `Good evening, ${name}!`, sub: "Wrap up your quests and rest well!", icon: Moon, color: "text-indigo-400" };
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // Claim Daily Check-in Bonus
  const handleClaim = () => {
    if (isCheckedInToday) return;

    playSound('questComplete');
    setCheckedInDate(todayStr);
    localStorage.setItem('daily_checkin_claimed_date', todayStr);
    setClaimedAnimation(true);

    // Reward a small daily bonus and use the shared progression curve.
    setUserStats(curr => {
      let newStreak = curr.streak;

      // Handle login streak increment visually
      const lastLogin = curr.lastLoginDate;
      const today = todayStr;
      if (lastLogin && lastLogin !== today) {
        const lastDate = new Date(lastLogin);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          newStreak += 1;
        } else if (diffDays > 1) {
          newStreak = 1;
        }
      }

      const progress = applyXp(curr.level, curr.xp, 10);
      if (progress.levelsChanged > 0) {
        playSound('levelUp');
      }

      return {
        ...curr,
        xp: progress.xp,
        level: progress.level,
        maxXp: progress.maxXp,
        skillPoints: curr.skillPoints + Math.max(0, progress.levelsChanged),
        streak: newStreak,
        xpMultiplier: streakMultiplier(newStreak),
        lastLoginDate: today,
        progressionVersion: PROGRESSION_VERSION,
      };
    });

    setTimeout(() => {
      setClaimedAnimation(false);
    }, 2500);
  };

  // 3 Suggested Quests for today to improve engagement
  const priorityQuests = useMemo(() => {
    // 1st Priority: Uncompleted repeatable (daily/weekly) quests
    const uncompletedRepeatables = goals.filter(g => !g.completed && (g.repeatType === 'daily' || g.repeatType === 'weekly' || g.isRepeatable));
    // 2nd Priority: Other uncompleted quests
    const otherUncompleted = goals.filter(g => !g.completed && !uncompletedRepeatables.some(ur => ur.id === g.id));
    // 3rd Priority: Completed Repeatables
    const completedRepeatables = goals.filter(g => g.completed && (g.repeatType === 'daily' || g.repeatType === 'weekly' || g.isRepeatable));

    const combined = [...uncompletedRepeatables, ...otherUncompleted, ...completedRepeatables];
    // Return unique top 3
    const result: Goal[] = [];
    const seen = new Set<string>();
    for (const g of combined) {
      if (!seen.has(g.id)) {
        seen.add(g.id);
        result.push(g);
      }
      if (result.length === 3) break;
    }

    // Fallback static quests if the user has no registered quests yet
    while (result.length < 3) {
      const idx = result.length + 1;
      result.push({
        id: `mock-suggested-quest-${idx}`,
        skillId: 'none',
        title: idx === 1 ? "Complete 1 Daily Habit" : idx === 2 ? "Log your main expense" : "Do a 5-minute workspace stretch",
        completed: false,
        xpReward: 10,
        difficulty: 'easy',
        repeatType: 'daily'
      });
    }

    return result;
  }, [goals]);

  // Render a lovely weekly streak visual (represented by 7 cute light clay bubbles)
  const currentDayOfWeek = new Date().getDay(); // 0 is Sunday, 1 is Monday, etc.
  const daysAbbr = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div 
      className="bg-white/92 p-5 rounded-3xl border border-slate-200/90 relative overflow-hidden space-y-4"
      style={{
        boxShadow: "0px 10px 30px rgba(100, 116, 139, 0.12), inset 2px 2px 4px rgba(255, 255, 255, 0.95)"
      }}
    >
      {/* Decorative top corner background details */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-300/10 to-transparent rounded-full -mr-6 -mt-6 pointer-events-none" />
      
      {/* Greeting and Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <GreetingIcon className={cn("w-5 h-5 animate-spin-slow", greeting.color)} />
            <h2 className="text-base font-black uppercase tracking-tight text-slate-850 leading-none">
              {greeting.text}
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-semibold leading-tight">
            {greeting.sub}
          </p>
        </div>
        <div 
          className="flex items-center gap-1 select-none text-white text-[9px] font-black px-2.5 py-1 rounded-full border border-white/60 shrink-0"
          style={{
            background: "linear-gradient(135deg, #f97316 da, #ea580c ff)",
            boxShadow: `
              0px 4px 8px rgba(234, 88, 12, 0.25),
              inset 1.5px 1.5px 3px rgba(255, 255, 255, 0.6),
              inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.22)
            `
          }}
        >
          <Flame size={12} className="fill-white shrink-0" />
          <span>{userStats.streak}D STREAK</span>
        </div>
      </div>

      {/* Week Day Progress Indicator Bubbles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Weekly Check-in Status</span>
          <span className="text-[10px] font-bold text-blue-650">Streak Multiplier: {userStats.xpMultiplier.toFixed(1)}x</span>
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {daysAbbr.map((day, dIdx) => {
            const isToday = dIdx === currentDayOfWeek;
            const isCompletedOffset = dIdx < currentDayOfWeek || (isToday && isCheckedInToday);
            
            return (
              <div 
                key={`checkin-bubble-${dIdx}`}
                className={cn(
                  "flex flex-col items-center justify-center py-2 px-1 rounded-2xl border text-center transition-all duration-300 relative select-none",
                  isToday 
                    ? "border-blue-200 bg-blue-50/50" 
                    : isCompletedOffset 
                      ? "border-emerald-200 bg-emerald-50/35" 
                      : "border-slate-200/60 bg-slate-50/40"
                )}
                style={{
                  boxShadow: isToday
                    ? "0px 4px 10px rgba(59, 130, 246, 0.12), inset 1.5px 1.5px 3px rgba(255, 255, 255, 0.8), inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.05)"
                    : isCompletedOffset
                      ? "0px 4px 8px rgba(16, 185, 129, 0.08), inset 1px 1px 2px rgba(255, 255, 255, 0.9), inset -1px -1px 2px rgba(0, 0, 0, 0.02)"
                      : "inset 1px 1.5px 3px rgba(148, 163, 184, 0.1)"
                }}
              >
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-tight",
                  isToday ? "text-blue-600" : isCompletedOffset ? "text-emerald-600" : "text-slate-400"
                )}>
                  {day}
                </span>
                
                <div className="mt-1">
                  {isCompletedOffset ? (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-4.5 h-4.5 rounded-full border border-white flex items-center justify-center shadow-sm"
                      style={{
                        background: "linear-gradient(135deg, #10b981, #059669)",
                        boxShadow: "inset 1px 1px 2px rgba(255, 255, 255, 0.5), inset -1px -1px 2px rgba(0, 0, 0, 0.2)"
                      }}
                    >
                      <Check size={8} strokeWidth={4} className="text-white" />
                    </motion.div>
                  ) : isToday ? (
                    <div className="w-4.5 h-4.5 rounded-full bg-blue-100/50 border border-blue-400/80 flex items-center justify-center animate-pulse">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    </div>
                  ) : (
                    <div className="w-4.5 h-4.5 rounded-full bg-slate-200/50 border border-dashed border-slate-300" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Check-In Button / Claim Success message */}
      <div className="pt-1">
        {isCheckedInToday ? (
          <div 
            className="w-full bg-emerald-50/50 border border-emerald-200/80 p-3 rounded-2xl flex items-center justify-between text-emerald-800"
            style={{
              boxShadow: "0px 6px 14px rgba(16, 185, 129, 0.08), inset 2px 2px 4px rgba(255, 255, 255, 0.95)"
            }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500 animate-bounce" />
              <div className="text-left">
                <p className="text-xs font-black uppercase tracking-wide">Checked-In for Today</p>
                <p className="text-[9px] font-bold text-emerald-600">Streak retained! Reward claimed successfully.</p>
              </div>
            </div>
            <span 
              className="text-xs font-extrabold text-white px-2 py-0.5 rounded-lg border border-white/80 shadow-sm"
              style={{
                background: "linear-gradient(135deg, #34d399, #059669)",
                boxShadow: "0px 3px 6px rgba(5, 150, 105, 0.2), inset 1px 1px 2px rgba(255, 255, 255, 0.4)"
              }}
            >
              +25 XP
            </span>
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleClaim}
            className="w-full py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-white font-extrabold uppercase text-xs tracking-wider border border-white/60 select-none cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              boxShadow: `
                0px 6px 16px rgba(37, 99, 235, 0.35), 
                inset 3px 3px 6px rgba(255, 255, 255, 0.45), 
                inset -3px -3px 6px rgba(0, 0, 0, 0.25)
              `
            }}
          >
            <CalendarCheck className="w-4 h-4 text-white shrink-0" />
            <span>Mark Today's Check-In (+25 XP)</span>
          </motion.button>
        )}
      </div>

      {/* Suggested priority quests for today */}
      <div className="space-y-2">
        <div className="flex items-center justify-between pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">🔥 Suggestions for Today</span>
          <span className="text-[9px] font-extrabold uppercase text-indigo-500 tracking-wider">Priority Quests</span>
        </div>

        <div className="space-y-2.5">
          {priorityQuests.map((quest) => {
            // Find category to paint correct custom accent line
            const category = categories.find(c => c.skills.some(s => s.id === quest.skillId));
            const categoryColor = category ? category.color : "#6366f1";
            
            const isMock = quest.id.startsWith('mock-');
            
            return (
              <div 
                key={`suggested-q-${quest.id}`}
                className={cn(
                  "p-3 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 text-left",
                  quest.completed 
                    ? "bg-slate-50/40 border-slate-200/50 opacity-60" 
                    : "bg-white/90 border-slate-200/80 hover:border-blue-200"
                )}
                style={{
                  boxShadow: quest.completed
                    ? "inset 1px 1.5px 3px rgba(100, 116, 139, 0.05)"
                    : "0px 4px 10px rgba(148, 163, 184, 0.06), inset 1.5px 1.5px 3px rgba(255, 255, 255, 0.95)"
                }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Category Accent Indicator */}
                  <div 
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-white" 
                    style={{ 
                      backgroundColor: categoryColor,
                      boxShadow: `0px 2px 4px ${categoryColor}40`
                    }}
                  />
                  <div className="min-w-0">
                    <p className={cn(
                      "text-xs font-bold text-slate-750 leading-snug truncate", 
                      quest.completed && "line-through text-slate-400 font-medium"
                    )}>
                      {quest.title}
                    </p>
                    <p className="text-[8px] font-bold uppercase text-slate-400 tracking-wider">
                      {isMock ? "Suggested Daily" : category ? category.name : "Skill Upgrade"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-0.5 text-blue-500 font-black text-[9px]">
                    <Zap size={10} className="fill-blue-500" />
                    <span>{quest.xpReward}XP</span>
                  </div>
                  
                  {isMock ? (
                    <div className="w-5 h-5 rounded-full border border-slate-300/60 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 select-none text-center">
                      ✓
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleGoalCompletion(quest.id)}
                      className={cn(
                        "w-5.5 h-5.5 rounded-lg flex items-center justify-center border transition-all active:scale-90 cursor-pointer",
                        quest.completed 
                          ? "bg-emerald-500 border-emerald-600 text-white" 
                          : "border-slate-300 bg-slate-50 text-transparent hover:border-blue-500"
                      )}
                      style={quest.completed ? {
                        background: "linear-gradient(135deg, #10b981, #059669)",
                        boxShadow: "0px 2px 5px rgba(16, 185, 129, 0.3), inset 1px 1px 2px rgba(255, 255, 255, 0.4)"
                      } : {
                        boxShadow: "inset 1px 1px 2px rgba(0, 0, 0, 0.05)"
                      }}
                    >
                      <Check size={10} strokeWidth={4} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

import { db } from './db';

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(getStoredTheme);
  const [categories, setCategories] = useState<Category[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    level: 1,
    xp: 0,
    maxXp: xpRequiredForLevel(1),
    consistency: 0,
    maxConsistency: 100,
    stamina: 100,
    maxStamina: 100,
    streak: 1,
    lastLoginDate: dateKey(),
    xpMultiplier: 1.0,
    skillPoints: 0,
    name: 'Player One',
    title: 'Master of Life Skills',
    mentorPersonality: 'Sarcastic',
    progressionVersion: PROGRESSION_VERSION,
    habitDataVersion: HABIT_DATA_VERSION,
    dailyGoalTarget: 60,
    streakShields: 0,
    shieldProgress: 0,
    pauseMode: 'none',
    appearanceDensity: 'cozy',
  });
  const [goals, setGoals] = useState<Goal[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [goalDailyProgress, setGoalDailyProgress] = useState<GoalDailyProgress[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [questHistory, setQuestHistory] = useState<CompletedQuest[]>([]);
  const [categoryConsistencies, setCategoryConsistencies] = useState<CategoryConsistency[]>([]);

  // Load from DB on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedStats = await db.userStats.get('main');
        const savedCategories = await db.categories.toArray();
        const savedGoals = await db.goals.toArray();
        const savedConsistencies = await db.categoryConsistencies.toArray();
        const savedHistory = await db.history.toArray();
        const savedQuestHistory = await db.questHistory.toArray();
        const savedRoutines = await db.routines.toArray();
        const savedGoalProgress = await db.goalDailyProgress.toArray();
        let normalizedHistory = savedHistory;
        const utcToday = new Date().toISOString().slice(0, 10);
        const localToday = dateKey();
        if (utcToday !== localToday) {
          const utcRecord = savedHistory.find(record => record.date === utcToday);
          const localRecord = savedHistory.find(record => record.date === localToday);
          if (utcRecord && !localRecord) {
            const migratedRecord = { ...utcRecord, date: localToday };
            normalizedHistory = [...savedHistory.filter(record => record.date !== utcToday), migratedRecord];
            await db.history.delete(utcToday);
            await db.history.put(migratedRecord);
          }
        }

        if (savedStats) {
          // Deduplicate categories and goals on load
          const uniqueCategories = Array.from(new Map(savedCategories.map(c => [c.id, c])).values());
          const uniqueGoals = Array.from(new Map(savedGoals.map(g => [g.id, g])).values());
          const uniqueConsistencies = Array.from(new Map(savedConsistencies.map(c => [c.categoryId, c])).values());
          const needsProgressionMigration = savedStats.progressionVersion !== PROGRESSION_VERSION;

          if (needsProgressionMigration) {
            const playerProgress = migrateLevelProgress(savedStats.level, savedStats.xp, savedStats.maxXp);
            setUserStats({
              ...savedStats,
              level: playerProgress.level,
              xp: playerProgress.xp,
              maxXp: playerProgress.maxXp,
              xpMultiplier: streakMultiplier(savedStats.streak),
              progressionVersion: PROGRESSION_VERSION,
              lastLoginDate: savedStats.lastLoginDate === new Date().toISOString().slice(0, 10)
                ? dateKey()
                : savedStats.lastLoginDate,
              habitDataVersion: HABIT_DATA_VERSION,
              dailyGoalTarget: savedStats.dailyGoalTarget ?? 60,
              streakShields: savedStats.streakShields ?? 0,
              shieldProgress: savedStats.shieldProgress ?? 0,
              pauseMode: savedStats.pauseMode ?? 'none',
              appearanceDensity: savedStats.appearanceDensity ?? 'cozy',
            });
            setCategories(uniqueCategories.map(category => ({
              ...category,
              skills: category.skills.map(skill => {
                const progress = migrateLevelProgress(skill.level, skill.xp, skill.maxXp);
                return { ...skill, level: progress.level, xp: progress.xp, maxXp: progress.maxXp };
              }),
            })));
            setGoals(uniqueGoals.map((goal, index) => {
              const difficulty = goal.difficulty ?? inferDifficulty(goal.xpReward);
              return {
                ...goal,
                difficulty,
                xpReward: questBaseReward(difficulty, goal),
                trackingMode: goal.trackingMode ?? 'checkbox',
                targetValue: goal.targetValue ?? 1,
                unit: goal.unit ?? 'times',
                sortOrder: goal.sortOrder ?? index,
              };
            }));
          } else {
            setUserStats({
              ...savedStats,
              lastLoginDate: savedStats.lastLoginDate === new Date().toISOString().slice(0, 10)
                ? dateKey()
                : savedStats.lastLoginDate,
              habitDataVersion: HABIT_DATA_VERSION,
              dailyGoalTarget: savedStats.dailyGoalTarget ?? 60,
              streakShields: savedStats.streakShields ?? 0,
              shieldProgress: savedStats.shieldProgress ?? 0,
              pauseMode: savedStats.pauseMode ?? 'none',
              appearanceDensity: savedStats.appearanceDensity ?? 'cozy',
            });
            setCategories(uniqueCategories);
            setGoals(uniqueGoals.map((goal, index) => ({
              ...goal,
              trackingMode: goal.trackingMode ?? 'checkbox',
              targetValue: goal.targetValue ?? 1,
              unit: goal.unit ?? 'times',
              sortOrder: goal.sortOrder ?? index,
            })));
          }
          setRoutines(savedRoutines);
          setGoalDailyProgress(savedGoalProgress);
          setCategoryConsistencies(uniqueConsistencies);
          if (normalizedHistory.length > 0) setHistory(normalizedHistory.sort((a, b) => a.date.localeCompare(b.date)));
          if (savedQuestHistory.length > 0) setQuestHistory(savedQuestHistory.sort((a, b) => b.completedAt.localeCompare(a.completedAt)));
        } else {
          // First run: load defaults
          setCategories(INITIAL_CATEGORIES.map(category => ({
            ...category,
            skills: category.skills.map(skill => ({
              ...skill,
              maxXp: xpRequiredForLevel(skill.level),
            })),
          })));
          setRoutines([
            { id: 'routine-morning', name: 'Morning routine', description: 'start the day with intention', icon: 'Sun', color: '#f59e0b', sortOrder: 0 },
          ]);
          setGoals([
            { id: '1', skillId: 'gym', title: 'Complete 30 min workout', completed: false, xpReward: 10, difficulty: 'easy', isRepeatable: true, trackingMode: 'timer', targetValue: 30, unit: 'minutes', icon: 'Dumbbell', routineId: 'routine-morning', sortOrder: 2 },
            { id: '2', skillId: 'money-mgmt', title: 'Track today\'s expenses', completed: false, xpReward: 10, difficulty: 'easy', isRepeatable: true, trackingMode: 'checkbox', targetValue: 1, unit: 'times', icon: 'Wallet', sortOrder: 0 },
            { id: '3', skillId: 'meditation', title: '10 min mindfulness', completed: false, xpReward: 10, difficulty: 'easy', isRepeatable: true, trackingMode: 'timer', targetValue: 10, unit: 'minutes', icon: 'Brain', routineId: 'routine-morning', sortOrder: 1 },
            { id: 'master-1', skillId: 'money-mgmt', title: 'Master: Financial Audit', completed: false, xpReward: 60, difficulty: 'hard', requiredSpecialization: 'Master', trackingMode: 'checkbox', targetValue: 1, unit: 'times', icon: 'Target', sortOrder: 3 },
            { id: 'expert-1', skillId: 'gym', title: 'Expert: PR Attempt', completed: false, xpReward: 60, difficulty: 'hard', requiredSpecialization: 'Expert', trackingMode: 'numeric', targetValue: 1, unit: 'reps', icon: 'Trophy', sortOrder: 4 },
          ]);
        }
      } catch (err) {
        console.error("Failed to load from local DB:", err);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  // Save to DB whenever state changes
  useEffect(() => {
    if (!isLoaded) return;
    
    const saveData = async () => {
      try {
        await db.transaction('rw', [db.userStats, db.categories, db.goals, db.routines, db.goalDailyProgress, db.categoryConsistencies], async () => {
          await db.userStats.put({ ...userStats, id: 'main' });
          
          await db.categories.clear();
          if (categories.length > 0) await db.categories.bulkPut(categories);
          
          await db.goals.clear();
          if (goals.length > 0) await db.goals.bulkPut(goals);

          await db.routines.clear();
          if (routines.length > 0) await db.routines.bulkPut(routines);

          await db.goalDailyProgress.clear();
          if (goalDailyProgress.length > 0) await db.goalDailyProgress.bulkPut(goalDailyProgress);
          
          await db.categoryConsistencies.clear();
          if (categoryConsistencies.length > 0) await db.categoryConsistencies.bulkPut(categoryConsistencies);
        });
      } catch (err) {
        console.error("Failed to save to local DB:", err);
      }
    };
    saveData();
  }, [isLoaded, userStats, categories, goals, routines, goalDailyProgress, categoryConsistencies]);

  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

  const currentDay = new Date().getDay();
  const dayChangeProcessingRef = useRef<string | null>(null);

  const checkDayChange = useCallback(() => {
    if (!isLoaded) return;
    const today = dateKey();
    const lastLogin = userStats.lastLoginDate;
    
    if (lastLogin !== today) {
      const rolloverKey = `${lastLogin}->${today}`;
      if (dayChangeProcessingRef.current === rolloverKey) return;
      dayChangeProcessingRef.current = rolloverKey;
      const previousRecord = history.find(record => record.date === lastLogin);
      const previousSummary = dailyGoalSummary(
        goals,
        goalDailyProgress,
        userStats.dailyGoalTarget ?? 60,
        new Date(`${lastLogin}T12:00:00`),
      );
      const paused = userStats.pauseMode !== 'none' &&
        (!userStats.pauseUntil || userStats.pauseUntil >= lastLogin);
      const goalMet = previousRecord?.goalMet ?? previousSummary.met;
      const shieldProtects = !goalMet && !paused && (userStats.streakShields ?? 0) > 0;

      setUserStats(curr => {
        const resolved = resolveDailyStreak(curr, { goalMet, paused });
        return {
          ...resolved,
          lastLoginDate: today,
          lastDailyGoalDate: lastLogin,
          xpMultiplier: getQuestMultiplier(resolved.streak),
        };
      });

      setGoals(prev => {
        const updatedGoals = prev.map(goal => {
          const isDaily = goal.repeatType === 'daily' || goal.isRepeatable;
          const isWeekly = goal.repeatType === 'weekly';
          
          if (isDaily) {
            let newStreak = goal.streak || 0;
            if (!goal.completed && !shieldProtects && !paused) {
              newStreak = 0;
            }
            return { ...goal, completed: false, streak: newStreak };
          }
          
          if (isWeekly && goal.repeatDays?.includes(new Date().getDay())) {
            return { ...goal, completed: false };
          }
          
          return goal;
        });
        return updatedGoals;
      });
    }
  }, [
    goalDailyProgress,
    goals,
    history,
    isLoaded,
    userStats.dailyGoalTarget,
    userStats.lastLoginDate,
    userStats.pauseMode,
    userStats.pauseUntil,
    userStats.streakShields,
  ]);

  useEffect(() => {
    checkDayChange();
  }, [checkDayChange]);

  const [activeTab, setActiveTab] = useState<'home' | 'stats' | 'goals' | 'finance'>('home');
  const [financeBalances, setFinanceBalances] = useState({
    bank: 0,
    cash: 0,
    debt: 0,
    investments: 0,
    epfBalance: 0
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const selectedCategory = useMemo(() => 
    categories.find(c => c.id === selectedCategoryId) || null, 
    [categories, selectedCategoryId]
  );
  const [notification, setNotification] = useState<{ title?: string, message: string, xp: number } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsTitle, setSettingsTitle] = useState('');
  const [settingsPersonality, setSettingsPersonality] = useState<'Supportive' | 'Sarcastic' | 'Stoic'>('Sarcastic');
  const [settingsTheme, setSettingsTheme] = useState<ThemeId>(theme);
  const [loadingQuestSkillId, setLoadingQuestSkillId] = useState<string | null>(null);
  const [selectedQuestForGuide, setSelectedQuestForGuide] = useState<Goal | null>(null);
  const [loadingGuideSkillId, setLoadingGuideSkillId] = useState<string | null>(null);
  const [isAddingQuest, setIsAddingQuest] = useState(false);
  const [newQuestTitle, setNewQuestTitle] = useState('');
  const [newQuestXp, setNewQuestXp] = useState(50);
  const [newQuestDifficulty, setNewQuestDifficulty] = useState<QuestDifficulty>('easy');
  const [newQuestTrackingMode, setNewQuestTrackingMode] = useState<NonNullable<Goal['trackingMode']>>('checkbox');
  const [newQuestTarget, setNewQuestTarget] = useState(1);
  const [newQuestUnit, setNewQuestUnit] = useState('times');
  const [newQuestIcon, setNewQuestIcon] = useState('Target');
  const [newQuestNote, setNewQuestNote] = useState('');
  const [newQuestRoutineId, setNewQuestRoutineId] = useState('');
  const [newQuestRepeatType, setNewQuestRepeatType] = useState<'none' | 'daily' | 'weekly'>('none');
  const [newQuestRepeatDays, setNewQuestRepeatDays] = useState<number[]>([]);
  const [skillGuide, setSkillGuide] = useState<{ skillId: string, text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingIcon, setEditingIcon] = useState('Target');
  const [editingRepeatType, setEditingRepeatType] = useState<'none' | 'daily' | 'weekly'>('none');
  const [editingRepeatDays, setEditingRepeatDays] = useState<number[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [manualQuestSkillId, setManualQuestSkillId] = useState<string>('');
  const [editingQuest, setEditingQuest] = useState<Goal | null>(null);
  const [newQuestReminders, setNewQuestReminders] = useState<string[]>([]);
  const [newQuestReminderFreq, setNewQuestReminderFreq] = useState<'once' | 'multiple'>('once');
  const lastReminderRef = useRef<Record<string, string>>({}); // goalId -> HH:mm to avoid duplicate triggers
  const lastCheckedMinute = useRef<string>("");
  const [isSkillDropdownOpen, setIsSkillDropdownOpen] = useState(false);
  const [isRadarChartCollapsed, setIsRadarChartCollapsed] = useState(true);
  const [isCategoryStatsCollapsed, setIsCategoryStatsCollapsed] = useState(true);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [questFilter, setQuestFilter] = useState<'all' | 'daily' | 'weekly' | 'once' | 'completed'>('all');
  const [isCompletedQuestsExpanded, setIsCompletedQuestsExpanded] = useState(false);
  const [isDailyQuestsExpanded, setIsDailyQuestsExpanded] = useState(true);
  const [isWeeklyQuestsExpanded, setIsWeeklyQuestsExpanded] = useState(true);
  const [isOneTimeQuestsExpanded, setIsOneTimeQuestsExpanded] = useState(true);

  useEffect(() => {
    if (!editingQuest) return;
    setNewQuestDifficulty(editingQuest.difficulty ?? inferDifficulty(editingQuest.xpReward));
    setNewQuestTrackingMode(editingQuest.trackingMode ?? 'checkbox');
    setNewQuestTarget(editingQuest.targetValue ?? 1);
    setNewQuestUnit(editingQuest.unit ?? 'times');
    setNewQuestIcon(editingQuest.icon ?? 'Target');
    setNewQuestNote(editingQuest.note ?? '');
    setNewQuestRoutineId(editingQuest.routineId ?? '');
  }, [editingQuest]);

  useEffect(() => {
    if (!isAddingQuest || editingQuest) return;
    setNewQuestTrackingMode('checkbox');
    setNewQuestTarget(1);
    setNewQuestUnit('times');
    setNewQuestIcon('Target');
    setNewQuestNote('');
    setNewQuestRoutineId('');
  }, [editingQuest, isAddingQuest]);

  // Request notification permissions
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.density = userStats.appearanceDensity ?? 'cozy';
  }, [userStats.appearanceDensity]);

  const consistencyStats = useMemo(() => {
    const now = new Date();
    const today = dateKey(now);
    const progressMap = new Map(
      goalDailyProgress.filter(item => item.date === today).map(item => [item.goalId, item]),
    );
    const todaysQuests = goals.filter(goal => trackingMode(goal) !== 'health' && isGoalScheduled(goal, now));
    const completedCount = todaysQuests.filter(goal => isHabitComplete(goal, progressMap.get(goal.id), now)).length;
    const totalCount = todaysQuests.length;

    // Category specific consistency
    const categoryStats = categories.map(cat => {
      const catQuests = todaysQuests.filter(g => cat.skills.some(s => s.id === g.skillId));
      const catCompleted = catQuests.filter(goal => isHabitComplete(goal, progressMap.get(goal.id), now)).length;
      const catTotal = catQuests.length;
      return {
        categoryId: cat.id,
        name: cat.name,
        consistency: catCompleted,
        maxConsistency: catTotal
      };
    });

    return {
      total: {
        consistency: completedCount,
        maxConsistency: totalCount
      },
      categories: categoryStats
    };
  }, [goals, goalDailyProgress, categories]);

  // Sync consistency to history
  useEffect(() => {
    if (!isLoaded) return;
    const updateHistory = async () => {
      const today = dateKey();
      const record = {
        date: today,
        completedCount: consistencyStats.total.consistency,
        totalCount: consistencyStats.total.maxConsistency,
        goalMet: consistencyStats.total.maxConsistency > 0 &&
          (consistencyStats.total.consistency / consistencyStats.total.maxConsistency) * 100 >= (userStats.dailyGoalTarget ?? 60),
        paused: userStats.pauseMode !== 'none',
      };
      await db.history.put(record);
      setHistory(prev => {
        const existingIndex = prev.findIndex(r => r.date === today);
        if (existingIndex >= 0) {
          const newHistory = [...prev];
          newHistory[existingIndex] = record;
          return newHistory;
        }
        return [...prev, record].sort((a, b) => a.date.localeCompare(b.date));
      });
    };
    updateHistory();
  }, [
    consistencyStats.total.consistency,
    consistencyStats.total.maxConsistency,
    isLoaded,
    userStats.dailyGoalTarget,
    userStats.pauseMode,
  ]);

  useEffect(() => {
    if (questFilter === 'completed') {
      setIsCompletedQuestsExpanded(true);
    }
  }, [questFilter]);

  const visibleGoals = useMemo(() => {
    let filtered = goals.filter(goal => {
      // If 'completed' filter is active, only show completed quests
      if (questFilter === 'completed') {
        return goal.completed;
      }

      // Type filtering
      if (questFilter === 'daily') {
        // Explicitly exclude weekly quests
        if (goal.repeatType === 'weekly') return false;
        return goal.repeatType === 'daily' || goal.isRepeatable;
      }
      if (questFilter === 'weekly') {
        // Show all weekly goals when filtered specifically to weekly
        return goal.repeatType === 'weekly';
      }
      if (questFilter === 'once') {
        return !goal.repeatType || goal.repeatType === 'none';
      }
      
      // 'all' filter: show all quests (completed or not)
      return true;
    });

    // Sort: Daily first, then Weekly, then others
    return filtered.sort((a, b) => {
      const getPriority = (g: Goal) => {
        if (g.repeatType === 'daily') return 0;
        if (g.repeatType === 'weekly') return 1;
        if (g.isRepeatable) return 0; // fallback for legacy daily quests
        return 2; // One-time
      };
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);
      
      if (priorityA !== priorityB) return priorityA - priorityB;
      
      // Secondary sort by title
      return a.title.localeCompare(b.title);
    });
  }, [goals, currentDay, questFilter]);

  // Initialize settings local state when modal opens
  useEffect(() => {
    if (isSettingsOpen) {
      setSettingsName(userStats.name || 'Player One');
      setSettingsTitle(userStats.title || 'Master of Life Skills');
      setSettingsPersonality(userStats.mentorPersonality || 'Sarcastic');
      setSettingsTheme(theme);
    }
  }, [isSettingsOpen, userStats, theme]);

  const handleResetData = async () => {
    if (window.confirm("Are you sure you want to reset all data? This cannot be undone.")) {
      try {
        await db.delete();
        window.location.reload();
      } catch (err) {
        console.error("Failed to reset data:", err);
      }
    }
  };

  const handleExportData = () => {
    const data = {
      exportVersion: 2,
      userStats,
      categories,
      goals,
      routines,
      goalDailyProgress,
      categoryConsistencies,
      history,
      questHistory,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifequest-backup-${dateKey()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (confirm('Importing data will overwrite your current progress. Are you sure?')) {
          // Clear existing data
          await db.userStats.clear();
          await db.categories.clear();
          await db.goals.clear();
          await db.routines.clear();
          await db.goalDailyProgress.clear();
          await db.categoryConsistencies.clear();
          await db.history.clear();
          await db.questHistory.clear();

          // Import new data
          if (data.userStats) await db.userStats.put({ ...data.userStats, id: 'main' });
          if (data.categories) await db.categories.bulkPut(data.categories);
          if (data.goals) await db.goals.bulkPut(data.goals);
          if (data.routines) await db.routines.bulkPut(data.routines);
          if (data.goalDailyProgress) await db.goalDailyProgress.bulkPut(data.goalDailyProgress);
          if (data.categoryConsistencies) await db.categoryConsistencies.bulkPut(data.categoryConsistencies);
          if (data.history) await db.history.bulkPut(data.history);
          if (data.questHistory) await db.questHistory.bulkPut(data.questHistory);

          window.location.reload();
        }
      } catch (err) {
        console.error("Failed to import data:", err);
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  const handleSaveSettings = async () => {
    setUserStats(prev => ({
      ...prev,
      name: settingsName,
      title: settingsTitle,
      mentorPersonality: settingsPersonality
    }));
    setTheme(settingsTheme);
    
    setIsSettingsOpen(false);
    setNotification({ 
      title: "Settings Updated",
      message: "Your profile has been saved successfully!", 
      xp: 0 
    });
  };

  // Auto-clear notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const processingCategories = React.useRef<Set<string>>(new Set());

  // Sync Category Consistencies based on daily quests
  useEffect(() => {
    if (!isLoaded) return;

    const syncConsistencies = async () => {
      const categoriesWithDailies = Array.from(new Set(
        goals.filter(g => g.isRepeatable).map(g => {
          return categories.find(c => c.skills.some(s => s.id === g.skillId))?.id;
        }).filter(Boolean)
      )) as string[];

      // 1. Remove consistencies for categories that no longer have dailies
      // and deduplicate by categoryId
      setCategoryConsistencies(prev => {
        const filtered = prev.filter(c => categoriesWithDailies.includes(c.categoryId));
        const unique = Array.from(new Map(filtered.map(c => [c.categoryId, c])).values());
        return unique;
      });

      // 2. Identify which categories need a new consistency record
      const existingIds = categoryConsistencies.map(c => c.categoryId);
      const missingIds = categoriesWithDailies.filter(id => !existingIds.includes(id) && !processingCategories.current.has(id));

      if (missingIds.length === 0) return;

      // 3. Add missing consistencies
      for (const catId of missingIds) {
        const category = categories.find(c => c.id === catId);
        if (!category) continue;

        processingCategories.current.add(catId);
        setCategoryConsistencies(current => {
          // Final check to prevent duplicates
          if (current.some(c => c.categoryId === catId)) return current;
          return [...current, { categoryId: catId, name: `${category.name} Habits`, consistency: 0, maxConsistency: 100 }];
        });
      }
    };

    syncConsistencies();
  }, [isLoaded, goals, categories]);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleAddCategory = (name: string, icon: string, color: string) => {
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      setNotification({ message: "A category with this name already exists!", xp: 0 });
      return;
    }
    const newCategory: Category = {
      id: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name,
      icon,
      color,
      skills: []
    };
    setCategories(prev => [...prev, newCategory]);
  };

  const handleDeleteCategory = (catId: string) => {
    const categoryToDelete = categories.find(c => c.id === catId);
    if (categoryToDelete) {
      const skillIds = categoryToDelete.skills.map(s => s.id);
      setGoals(prev => prev.filter(g => !skillIds.includes(g.skillId)));
    }
    setCategories(prev => prev.filter(c => c.id !== catId));
    if (selectedCategoryId === catId) setSelectedCategoryId(null);
    setDeletingId(null);
  };

  const handleEditCategory = (catId: string, newName: string, newIcon: string, newColor: string) => {
    if (newName.trim()) {
      const trimmedName = newName.trim();
      // Prevent duplicate names which can cause issues in radar chart
      if (categories.some(c => c.id !== catId && c.name.toLowerCase() === trimmedName.toLowerCase())) {
        setNotification({ message: "A category with this name already exists!", xp: 0 });
        return;
      }
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, name: trimmedName, icon: newIcon, color: newColor } : c));
    }
    setCategoryToEdit(null);
  };

  const handleDeleteSkill = (skillId: string) => {
    setCategories(prev => prev.map(cat => ({
      ...cat,
      skills: cat.skills.filter(s => s.id !== skillId)
    })));
    setGoals(prev => prev.filter(g => g.skillId !== skillId));
    if (selectedCategory) {
    }
    setDeletingId(null);
  };

  const handleEditSkill = (skillId: string, newName: string, newDescription?: string, newIcon?: string) => {
    if (newName.trim()) {
      setCategories(prev => prev.map(cat => ({
        ...cat,
        skills: cat.skills.map(s => s.id === skillId ? { 
          ...s, 
          name: newName.trim(),
          description: newDescription !== undefined ? newDescription.trim() : s.description,
          icon: newIcon ?? s.icon
        } : s)
      })));
    }
    setEditingId(null);
  };

  const handleDeleteGoal = (goalId: string) => {
    setGoals(prev => prev.filter(g => g.id !== goalId));
    setGoalDailyProgress(prev => prev.filter(item => item.goalId !== goalId));
    setQuestHistory(prev => {
      const removed = prev.filter(item => item.goalId === goalId);
      removed.forEach(item => void db.questHistory.delete(item.id));
      return prev.filter(item => item.goalId !== goalId);
    });
    setDeletingId(null);
  };

  const handleEditGoal = (goalId: string, newTitle: string, repeatType: 'none' | 'daily' | 'weekly', repeatDays: number[]) => {
    if (newTitle.trim()) {
      setGoals(prev => prev.map(g => g.id === goalId ? { 
        ...g, 
        title: newTitle.trim(), 
        repeatType, 
        repeatDays,
        isRepeatable: repeatType !== 'none'
      } : g));
    }
    setEditingId(null);
  };

  // Prepare data for Radar Chart
  const radarData = useMemo(() => {
    return categories.map(cat => {
      const avgLevel = cat.skills.length > 0 
        ? cat.skills.reduce((acc, s) => acc + s.level, 0) / cat.skills.length
        : 0;
      return {
        subject: cat.id, // Use ID as subject for unique keys
        name: cat.name,
        A: avgLevel,
        fullMark: 10,
      };
    });
  }, [categories]);

  const toggleGoalCompletion = useCallback((goalId: string) => {
    const goal = goals.find(item => item.id === goalId);
    if (!goal) return;
    const isCompleting = !goal.completed;
    const now = new Date();
    const today = dateKey(now);
    let newStreak = goal.streak ?? 0;

    if (isCompleting) {
      if (!goal.lastCompletedAt) newStreak = 1;
      else {
        const diffDays = Math.floor(
          (new Date(`${today}T12:00:00`).getTime() - new Date(`${goal.lastCompletedAt.slice(0, 10)}T12:00:00`).getTime()) / 86_400_000,
        );
        if (diffDays === 1) newStreak += 1;
        else if (diffDays > 1) newStreak = 1;
      }
    } else if (newStreak > 0) {
      newStreak -= 1;
    }

    const skill = categories.flatMap(category => category.skills).find(item => item.id === goal.skillId);
    const appliedXp = isCompleting
      ? calculateQuestReward(goal, newStreak, skill?.specialization)
      : goal.appliedXp ?? 0;
    const xpChange = isCompleting ? appliedXp : -appliedXp;
    const playerProgress = applyXp(userStats.level, userStats.xp, xpChange);

    setGoals(prev => prev.map(item => item.id === goalId ? {
      ...item,
      completed: isCompleting,
      lastCompletedAt: isCompleting ? today : item.lastCompletedAt,
      streak: newStreak,
      appliedXp: isCompleting ? appliedXp : 0,
    } : item));
    setUserStats({
      ...userStats,
      xp: playerProgress.xp,
      level: playerProgress.level,
      maxXp: playerProgress.maxXp,
      skillPoints: Math.max(0, userStats.skillPoints + playerProgress.levelsChanged),
      xpMultiplier: streakMultiplier(userStats.streak),
      progressionVersion: PROGRESSION_VERSION,
    });
    setCategories(categories.map(category => ({
      ...category,
      skills: category.skills.map(item => {
        if (item.id !== goal.skillId) return item;
        const progress = applyXp(item.level, item.xp, xpChange);
        return { ...item, xp: progress.xp, level: progress.level, maxXp: progress.maxXp };
      }),
    })));

    if (isCompleting) {
      playSound('questComplete');
      const historyEntry: CompletedQuest = {
        id: `${goalId}-${Date.now()}`,
        goalId,
        title: goal.title,
        skillId: goal.skillId,
        xpEarned: appliedXp,
        completedAt: now.toISOString(),
        scheduledTime: goal.reminderTimes?.[0],
      };
      void db.questHistory.add(historyEntry);
      setQuestHistory(prev => [historyEntry, ...prev]);
      setGoalDailyProgress(prev => {
        const current = prev.find(item => item.id === `${goalId}:${today}`) ?? emptyProgress(goalId, today);
        const next = {
          ...current,
          value: trackingMode(goal) === 'checkbox' ? 1 : current.value,
          completed: true,
          appliedXp,
          completedAt: historyEntry.completedAt,
          historyEntryId: historyEntry.id,
        };
        return [...prev.filter(item => item.id !== next.id), next];
      });
      setNotification({ message: goal.title, xp: appliedXp });
      if (playerProgress.levelsChanged > 0) {
        playSound('levelUp');
        setNotification({
          title: `Level ${playerProgress.level}! +${playerProgress.levelsChanged} SP`,
          message: `${playerProgress.xp}/${playerProgress.maxXp} XP · ${playerProgress.maxXp - playerProgress.xp} to next level`,
          xp: appliedXp,
        });
      }
    } else {
      const entry = questHistory.find(item => item.goalId === goalId && item.completedAt.startsWith(today));
      if (entry) {
        void db.questHistory.delete(entry.id);
        setQuestHistory(prev => prev.filter(item => item.id !== entry.id));
      }
      setGoalDailyProgress(prev => prev.map(item => item.id === `${goalId}:${today}` ? {
        ...item,
        value: trackingMode(goal) === 'checkbox' ? 0 : item.value,
        completed: false,
        appliedXp: undefined,
        completedAt: undefined,
        historyEntryId: undefined,
      } : item));
    }
  }, [categories, goals, questHistory, userStats]);

  const handleHabitAction = useCallback((goalId: string, action: HabitAction) => {
    const goal = goals.find(item => item.id === goalId);
    if (!goal || trackingMode(goal) === 'health') return;
    const now = new Date();
    const today = dateKey(now);
    const current = goalDailyProgress.find(item => item.id === `${goalId}:${today}`);
    const wasComplete = isHabitComplete(goal, current, now);
    const next = applyHabitAction(goal, current, action, now);
    const isComplete = isHabitComplete(goal, next, now);
    setGoalDailyProgress(prev => [...prev.filter(item => item.id !== next.id), next]);
    if (wasComplete !== isComplete) toggleGoalCompletion(goalId);
  }, [goalDailyProgress, goals, toggleGoalCompletion]);

  useEffect(() => {
    if (!isLoaded || !goalDailyProgress.some(item => item.timerStartedAt && !item.completed)) return;
    const interval = window.setInterval(() => {
      const now = new Date();
      goalDailyProgress.forEach(progress => {
        if (!progress.timerStartedAt || progress.completed) return;
        const goal = goals.find(item => item.id === progress.goalId);
        if (!goal || trackingMode(goal) !== 'timer') return;
        if (isHabitComplete(goal, progress, now)) {
          handleHabitAction(goal.id, { type: 'timer-pause' });
        }
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [goalDailyProgress, goals, handleHabitAction, isLoaded]);

  const completeHabitFromExternalAction = useCallback((goalId: string) => {
    const goal = goals.find(item => item.id === goalId);
    if (!goal || trackingMode(goal) === 'health') return;
    const mode = trackingMode(goal);
    if (mode === 'checkbox') handleHabitAction(goalId, { type: 'toggle' });
    else if (mode === 'counter') handleHabitAction(goalId, { type: 'increment' });
    else handleHabitAction(goalId, {
      type: 'set',
      value: mode === 'timer' ? (goal.targetValue ?? 1) * 60 : goal.targetValue ?? 1,
    });
  }, [goals, handleHabitAction]);

  // Notification engine
  useEffect(() => {
    const channel = new BroadcastChannel('lifequest_channel');
    channel.onmessage = (event) => {
      if (event.data.type === 'COMPLETE_QUEST') {
        const goalId = event.data.goalId;
        if (goalId) {
          completeHabitFromExternalAction(goalId);
        }
      }
    };

    // Check for URL parameters (deep link from notification)
    const urlParams = new URLSearchParams(window.location.search);
    const completeId = urlParams.get('completeId');
    if (completeId && isLoaded) {
      completeHabitFromExternalAction(completeId);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => channel.close();
  }, [completeHabitFromExternalAction, isLoaded]);

  useEffect(() => {
    const checkReminders = async () => {
      checkDayChange();
      const now = new Date();
      const currentHHmm = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      // Avoid re-checking the same minute multiple times for the same goals 
      if (currentHHmm === lastCheckedMinute.current) return;
      lastCheckedMinute.current = currentHHmm;
      const today = now.getDay();
      
      // Get service worker registration for better background handling
      let swRegistration: ServiceWorkerRegistration | null = null;
      if ('serviceWorker' in navigator) {
        swRegistration = await navigator.serviceWorker.ready;
      }
      
      goals.forEach(goal => {
        // Only remind for incomplete goals
        if (goal.completed) return;
        
        // Check if goal is scheduled for today
        const isDaily = goal.repeatType === 'daily' || (goal.isRepeatable && goal.repeatType !== 'weekly');
        const isWeekly = goal.repeatType === 'weekly' && goal.repeatDays?.includes(today);
        const isOneTime = (!goal.repeatType || goal.repeatType === 'none') && !goal.isRepeatable;
        
        if (!isDaily && !isWeekly && !isOneTime) return;

        const scheduledTimes = goal.reminderTimes || [];
        if (scheduledTimes.length === 0) return;

        // Frequency check
        const todayStr = dateKey(now);
        const dayKey = `reminded-${goal.id}-${todayStr}`;
        
        if (scheduledTimes.includes(currentHHmm)) {
          if (goal.reminderFrequency === 'once' && lastReminderRef.current[dayKey]) {
            return;
          }

          const timeKey = `${goal.id}-${todayStr}-${currentHHmm}`;
          if (lastReminderRef.current[timeKey] !== currentHHmm) {
            // App-level notification (Toast)
            setNotification({ 
              title: "Quest Reminder",
              message: goal.title,
              xp: 0 
            });
            playSound('notification');

            lastReminderRef.current[timeKey] = currentHHmm;
            lastReminderRef.current[dayKey] = currentHHmm;
            
            // System-level notification (Lock screen / Background)
            if ("Notification" in window && Notification.permission === "granted") {
              if (swRegistration) {
                (swRegistration as any).showNotification("Quest Reminder", {
                  body: goal.title,
                  icon: '/favicon.ico',
                  tag: `quest-${goal.id}`, // Single tag per quest to avoid notification clutter
                  renotify: true,
                  vibrate: [200, 100, 200],
                  data: { goalId: goal.id },
                  actions: [
                    { action: 'complete', title: 'Complete ✓' },
                    { action: 'snooze', title: 'Snooze ⏱' }
                  ]
                } as any).catch((err: any) => console.error("SW notification error:", err));
              } else {
                try {
                  new Notification("Quest Reminder", { body: goal.title, icon: '/favicon.ico' });
                } catch (e) {
                  console.error("System notification error:", e);
                }
              }
            }
          }
        }
      });
    };

    const interval = setInterval(checkReminders, 15000); // Check every 15 seconds to ensure we don't miss a minute
    checkReminders(); // Initial check
    return () => clearInterval(interval);
  }, [goals, checkDayChange]);

  // Reset repeatable quests daily and apply penalties
  useEffect(() => {
    const checkDailyReset = () => {
      const now = new Date();
      const today = dateKey(now);
      
      setGoals(prev => {
        let consistencyPenalty = 0;
        const categoryPenalties: Record<string, number> = {};

        const updatedGoals = prev.map(g => {
          if (g.isRepeatable && g.lastCompletedAt) {
            const lastDate = g.lastCompletedAt.split('T')[0];
            if (lastDate !== today) {
              return { ...g, completed: false };
            }
          }
          return g;
        });

        return updatedGoals;
      });
    };

    checkDailyReset();
    const interval = setInterval(checkDailyReset, 1000 * 60 * 60); // Check every hour
    return () => clearInterval(interval);
  }, []);


  if (theme === 'terminal') {
    return (
      <TerminalShell
        isLoaded={isLoaded}
        userStats={userStats}
        categories={categories}
        goals={goals}
        history={history}
        questHistory={questHistory}
        routines={routines}
        goalDailyProgress={goalDailyProgress}
        theme={theme}
        onToggleGoal={toggleGoalCompletion}
        onHabitAction={handleHabitAction}
        onThemeChange={setTheme}
        onSaveIdentity={(name, title) => {
          setUserStats(prev => ({ ...prev, name, title }));
          setNotification({ title: 'Profile saved', message: `${name} · ${title}`, xp: 0 });
        }}
        onSelectMentor={mentor => setUserStats(prev => ({ ...prev, mentorPersonality: mentor }))}
        onExport={handleExportData}
        onImport={handleImportData}
        onReset={handleResetData}
        onAddCategory={handleAddCategory}
        onEditCategory={handleEditCategory}
        onDeleteCategory={handleDeleteCategory}
        onAddSkill={(categoryId, name, description, xpReward, icon) => {
          setCategories(prev => prev.map(category => {
            if (category.id !== categoryId) return category;
            const firstSkill = !category.skills.some(skill => skill.isUnlocked);
            const skill: Skill = {
              id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name,
              icon: icon || category.icon,
              description,
              level: 1,
              xp: 0,
              maxXp: xpRequiredForLevel(1),
              xpReward,
              isUnlocked: firstSkill,
              spCost: firstSkill ? 0 : 1,
            };
            return { ...category, skills: [...category.skills, skill] };
          }));
          setNotification({ title: 'Skill created', message: name, xp: 0 });
        }}
        onEditSkill={handleEditSkill}
        onDeleteSkill={handleDeleteSkill}
        onUnlockSkill={(categoryId, skillId) => {
          const skill = categories.find(category => category.id === categoryId)?.skills.find(item => item.id === skillId);
          if (!skill || skill.isUnlocked || userStats.skillPoints < skill.spCost) return;
          setCategories(prev => prev.map(category => category.id === categoryId ? {
            ...category,
            skills: category.skills.map(item => item.id === skillId ? { ...item, isUnlocked: true } : item),
          } : category));
          setUserStats(prev => ({ ...prev, skillPoints: prev.skillPoints - skill.spCost }));
          setNotification({ title: 'Skill unlocked', message: skill.name, xp: 0 });
        }}
        onSaveGoal={goal => {
          const normalizedGoal: Goal = {
            ...goal,
            trackingMode: goal.trackingMode ?? 'checkbox',
            targetValue: goal.targetValue ?? 1,
            unit: goal.unit ?? 'times',
            sortOrder: goal.sortOrder ?? goals.length,
          };
          setGoals(prev => prev.some(item => item.id === goal.id)
            ? prev.map(item => item.id === goal.id ? normalizedGoal : item)
            : [normalizedGoal, ...prev]);
          setNotification({
            title: goals.some(item => item.id === goal.id) ? 'Quest updated' : 'Quest created',
            message: goal.title,
            xp: 0,
          });
        }}
        onDeleteGoal={handleDeleteGoal}
        onSaveRoutine={routine => {
          setRoutines(prev => prev.some(item => item.id === routine.id)
            ? prev.map(item => item.id === routine.id ? routine : item)
            : [...prev, routine]);
          setNotification({ title: 'Routine saved', message: routine.name, xp: 0 });
        }}
        onDeleteRoutine={id => {
          setRoutines(prev => prev.filter(item => item.id !== id));
          setGoals(prev => prev.map(goal => goal.routineId === id ? { ...goal, routineId: undefined } : goal));
        }}
        onMoveRoutine={(id, direction) => {
          setRoutines(prev => {
            const sorted = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
            const index = sorted.findIndex(item => item.id === id);
            const target = index + direction;
            if (index < 0 || target < 0 || target >= sorted.length) return prev;
            [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
            return sorted.map((item, sortOrder) => ({ ...item, sortOrder }));
          });
        }}
        onUpdateHabitSettings={settings => setUserStats(prev => ({ ...prev, ...settings }))}
        onNotificationSound={sound => {
          localStorage.setItem('quest_rpg_notif_sound', sound);
          setUserStats(prev => ({ ...prev, notificationSound: sound }));
          playSound(sound);
        }}
        onEnableNotifications={async () => {
          if (!('Notification' in window)) return;
          const permission = await Notification.requestPermission();
          setUserStats(prev => ({ ...prev }));
          setNotification({
            title: 'Notifications',
            message: permission === 'granted' ? 'Notifications authorized' : `Permission ${permission}`,
            xp: 0,
          });
        }}
        onInstall={handleInstall}
        canInstall={Boolean(installPrompt)}
        onTestSound={() => {
          playSound('questComplete');
          setNotification({ title: 'Audio test', message: 'Sound is working', xp: 0 });
        }}
        onRefresh={() => window.location.reload()}
        notification={notification}
      />
    );
  }

  return (
    <div className="app-shell min-h-screen bg-[#e5ecf6] text-slate-800 font-sans selection:bg-blue-500/30 pb-24 relative overflow-hidden">
      <DynamicBackground />
      <AnimatePresence>
        {!isLoaded && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#e5ecf6] flex flex-col items-center justify-center gap-4"
          >
            <div className="relative">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-full border-4 border-blue-500/10 border-t-blue-500"
              />
              <Activity className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500 animate-pulse" size={24} />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-black italic tracking-tighter uppercase text-slate-800">LifeQuest</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Loading Epic Progress...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header / Stats Bar */}
      <header className="sticky top-0 z-30 bg-[#0a0a0c]/80 backdrop-blur-md border-b border-gray-800 p-4">
        <div className="max-w-md mx-auto flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative select-none">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center border border-white/80 font-black italic text-white text-xl shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, #3b82f6 10%, #2563eb 100%)",
                    boxShadow: `
                      0px 6px 14px rgba(37, 99, 235, 0.4), 
                      inset 3px 3px 6px rgba(255, 255, 255, 0.6), 
                      inset -3px -3px 6px rgba(0, 0, 0, 0.25)
                    `
                  }}
                >
                  <span className="drop-shadow-sm">L{userStats.level}</span>
                </div>
                {/* Streak Badge Overlay */}
                {userStats.streak > 1 && (
                  <div 
                    className="absolute -bottom-1.5 -right-1.5 text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg border border-white/90 flex items-center gap-0.5"
                    style={{
                      background: "linear-gradient(135deg, #f97316, #ea580c)",
                      boxShadow: `
                        0px 4px 8px rgba(234, 88, 12, 0.35),
                        inset 1.5px 1.5px 3px rgba(255, 255, 255, 0.65),
                        inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.25)
                      `
                    }}
                  >
                    <Plus size={8} strokeWidth={4} className="fill-white" />
                    <span>{userStats.streak}</span>
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-lg leading-tight">{userStats.name || 'Player One'}</h1>
                  {userStats.xpMultiplier > 1 && (
                    <div className="bg-blue-500/20 border border-blue-500/30 px-1.5 py-0.5 rounded text-[8px] font-black text-blue-400 uppercase tracking-widest">
                      {userStats.xpMultiplier.toFixed(1)}x XP
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 font-medium">{userStats.title || 'Master of Life Skills'}</p>
              </div>
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-200/80 bg-white/95 text-slate-600 hover:text-slate-900 transition-all active:scale-95 shadow-sm cursor-pointer"
              style={{
                boxShadow: "0px 3px 8px rgba(100, 116, 139, 0.1), inset 1.5px 1.5px 3px rgba(255, 255, 255, 0.95), inset -1.5px -1.5px 3px rgba(100, 116, 139, 0.05)"
              }}
            >
              <Settings size={18} />
            </button>
          </div>

          {activeTab !== 'finance' ? (
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <StatBadge icon={Heart} value={consistencyStats.total.consistency} max={consistencyStats.total.maxConsistency} color="#ef4444" label="Consistency" />
                <StatBadge icon={Trophy} value={userStats.xp} max={userStats.maxXp} color="#3b82f6" label="Level XP" />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <div className="flex items-center gap-1">
                      <Plus size={12} className="text-blue-400" />
                      <span>Skill Points</span>
                    </div>
                    <span className="text-blue-400">{userStats.skillPoints} SP</span>
                  </div>
                  <ProgressBar value={userStats.skillPoints > 0 ? 1 : 0} max={1} color="#3b82f6" />
                </div>
              </div>

              {/* Category Consistency Bars */}
              <div className="space-y-2">
                <button 
                  onClick={() => setIsCategoryStatsCollapsed(!isCategoryStatsCollapsed)}
                  className="w-full flex items-center justify-between py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-800 transition-colors border-t border-slate-200/50"
                >
                  <span>Category Progress</span>
                  {isCategoryStatsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
                
                <AnimatePresence>
                  {!isCategoryStatsCollapsed && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-1 pb-3">
                        {consistencyStats.categories
                          .filter(c => c.maxConsistency > 0)
                          .map(c => (
                            <StatBadge 
                              key={`stat-badge-${c.categoryId}`} 
                              icon={Heart} 
                              value={c.consistency} 
                              max={c.maxConsistency} 
                              color="#ec4899" 
                              label={c.name} 
                            />
                          ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="space-y-3 mt-1">
              <div className="grid grid-cols-2 gap-2">
                <div 
                  onClick={() => window.dispatchEvent(new CustomEvent('finance-open-banks'))}
                  className="p-3 rounded-2xl bg-gray-950/40 border border-gray-800/80 flex flex-col justify-between cursor-pointer hover:border-blue-500/35 transition-all select-none group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[8.5px] font-black uppercase text-gray-400 tracking-wider">Net Bank Holdings</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        window.dispatchEvent(new CustomEvent('finance-open-banks'));
                      }}
                      className="text-[7.5px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-tighter"
                    >
                      MY BANK ACCOUNTS
                    </button>
                  </div>
                  <h3 className="text-xs font-black text-blue-400 mt-1 transition-colors group-hover:text-blue-300">
                    ₹{financeBalances.bank.toLocaleString('en-IN')}
                  </h3>
                </div>

                <div className="p-3 rounded-2xl bg-gray-950/40 border border-gray-800/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[8.5px] font-black uppercase text-gray-400 tracking-wider">Physical Cash</span>
                    <button 
                      onClick={() => window.dispatchEvent(new CustomEvent('finance-adjust-open', { detail: { account: 'cash' } }))}
                      className="text-[7.5px] font-black text-slate-500 hover:text-slate-800 uppercase tracking-tighter"
                    >
                      Adjust
                    </button>
                  </div>
                  <h3 className="text-xs font-black text-emerald-400 mt-1">
                    ₹{financeBalances.cash.toLocaleString('en-IN')}
                  </h3>
                </div>

                <div className="p-3 rounded-2xl bg-gray-950/40 border border-gray-800/80 flex flex-col justify-between">
                  <span className="text-[8.5px] font-black uppercase text-gray-400 tracking-wider">CC Outstanding</span>
                  <h3 className="text-xs font-black text-red-400 mt-1">
                    ₹{financeBalances.debt.toLocaleString('en-IN')}
                  </h3>
                </div>

                <div 
                  onClick={() => window.dispatchEvent(new CustomEvent('finance-manage-epf'))}
                  className="p-3 rounded-2xl bg-gray-950/40 border border-gray-800/80 flex flex-col justify-between cursor-pointer hover:border-yellow-500/35 transition-all select-none group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[8.5px] font-black uppercase text-gray-400 tracking-wider">EPF</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        window.dispatchEvent(new CustomEvent('finance-manage-epf'));
                      }}
                      className="text-[7.5px] font-black text-yellow-500 hover:text-yellow-400 uppercase tracking-tighter"
                    >
                      EPF DETAILS
                    </button>
                  </div>
                  <h3 className="text-xs font-black text-yellow-500 mt-1 transition-colors group-hover:text-yellow-400">
                    ₹{financeBalances.epfBalance.toLocaleString('en-IN')}
                  </h3>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Daily Check-in Card */}
              <DailyCheckIn 
                userStats={userStats}
                setUserStats={setUserStats}
                goals={goals}
                toggleGoalCompletion={toggleGoalCompletion}
                categories={categories}
              />

              {/* Radar Chart Section */}
              <section className="bg-gray-900/40 rounded-3xl border border-gray-800 p-4 overflow-hidden relative">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Skill Web</h2>
                  <button 
                    onClick={() => setIsRadarChartCollapsed(!isRadarChartCollapsed)}
                    className="p-1 hover:bg-gray-800 rounded-lg transition-colors text-gray-500"
                  >
                    {isRadarChartCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </button>
                </div>
                
                <AnimatePresence>
                  {!isRadarChartCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="h-60 w-full pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                            <PolarGrid stroke="#374151" />
                            <PolarAngleAxis 
                              dataKey="subject" 
                              tick={(props: any) => {
                                const { x, y, payload, cx, cy } = props;
                                const cat = categories.find(c => c.id === payload.value);
                                
                                // Calculate text anchor based on x relative to center
                                // If X is notably to the right, start anchor. If to the left, end anchor.
                                let textAnchor: "start" | "end" | "middle" = 'middle';
                                if (x > cx + 10) textAnchor = 'start';
                                else if (x < cx - 10) textAnchor = 'end';
                                
                                // Adjust vertical offset
                                let dy = 5;
                                if (y > cy + 10) dy = 12; // bottom labels
                                else if (y < cy - 10) dy = -5; // top labels
                                
                                return (
                                  <g transform={`translate(${x},${y})`}>
                                    <text
                                      x={0}
                                      y={0}
                                      dy={dy}
                                      textAnchor={textAnchor}
                                      fill="#9ca3af"
                                      fontSize={9}
                                      fontWeight={600}
                                      className="tracking-tight"
                                    >
                                      {cat?.name || payload.value}
                                    </text>
                                  </g>
                                );
                              }}
                            />
                            <Radar
                              name="Player"
                              dataKey="A"
                              stroke="#3b82f6"
                              fill="#3b82f6"
                              fillOpacity={0.4}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Consistency History Chart Section */}
              <section className="bg-gray-900/40 rounded-3xl border border-gray-800 overflow-hidden">
                <button 
                  onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <TrendingUp size={16} className="text-blue-400" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Consistency Progress</h2>
                      <p className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter mt-0.5">Historical Performance</p>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: isHistoryExpanded ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-gray-500"
                  >
                    <ChevronDown size={20} />
                  </motion.div>
                </button>
                
                <AnimatePresence>
                  {isHistoryExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="p-4 pt-0">
                        <ConsistencyHistoryChart history={history} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

               {/* Categories Grid */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-xl">Skill Categories</h2>
                  <button 
                    onClick={() => setIsAddingCategory(true)}
                    className="flex items-center gap-1 text-blue-400 text-sm font-semibold hover:underline"
                  >
                    <Plus size={16} />
                    <span>Add Category</span>
                  </button>
                </div>
                  <div className="grid grid-cols-2 gap-3">
                    {categories.map((cat) => (
                      <CategoryCard 
                        key={cat.id} 
                        cat={cat} 
                        onSelect={setSelectedCategoryId}
                        onEdit={setCategoryToEdit}
                        onDelete={handleDeleteCategory}
                        deletingId={deletingId}
                        setDeletingId={setDeletingId}
                      />
                    ))}
                  </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'goals' && (
            <motion.div 
              key="goals"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black italic tracking-tighter">QUEST DASHBOARD</h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsAddingQuest(true)}
                      className="p-2 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                  {(['all', 'daily', 'weekly', 'once', 'completed'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setQuestFilter(filter)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all border shrink-0",
                        questFilter === filter 
                          ? (
                            filter === 'daily' ? "bg-blue-600 border-blue-500 text-white" :
                            filter === 'weekly' ? "bg-emerald-600 border-emerald-500 text-white" :
                            filter === 'once' ? "bg-orange-600 border-orange-500 text-white" :
                            "bg-blue-600 border-blue-500 text-white"
                          ) 
                          : "bg-gray-100/50 border-gray-200 text-slate-500 hover:text-slate-800 hover:border-gray-300"
                      )}
                    >
                      {filter === 'once' ? 'Once' : filter}
                    </button>
                  ))}
                </div>
              </div>

              <AnimatePresence>
                {/* Removed duplicate manual quest form - using global modal instead */}
                {false && isAddingQuest && (
                  <motion.div
                    initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                    animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
                    exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                  >
                    <div className="bg-gray-900/60 border border-blue-500/30 rounded-2xl p-4 space-y-4 overflow-visible">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-widest text-blue-400">Add Manual Quest</h3>
                        <button onClick={() => setIsAddingQuest(false)} className="text-gray-500 hover:text-white">
                          <X size={16} />
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-500">Quest Title</label>
                          <input 
                            id="manual-quest-title"
                            placeholder="e.g. Read 10 pages of a book"
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 relative">
                            <label className="text-[10px] font-bold uppercase text-gray-500">Skill</label>
                            <button 
                              onClick={() => setIsSkillDropdownOpen(!isSkillDropdownOpen)}
                              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-left flex items-center justify-between hover:border-gray-600 transition-all"
                            >
                              <span className="truncate">
                                {manualQuestSkillId 
                                  ? categories.flatMap(c => c.skills).find(s => s.id === manualQuestSkillId)?.name 
                                  : "Select Skill"}
                              </span>
                              <ChevronDown size={14} className={cn("transition-transform", isSkillDropdownOpen && "rotate-180")} />
                            </button>

                            <AnimatePresence>
                              {isSkillDropdownOpen && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-[60]" 
                                    onClick={() => setIsSkillDropdownOpen(false)} 
                                  />
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute left-0 right-0 top-full mt-2 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl z-[70] max-h-64 overflow-y-auto p-2 space-y-1 scrollbar-hide"
                                  >
                                    {categories.map(category => (
                                      <div key={`skill-dropdown-cat-${category.id}`} className="space-y-1">
                                        <div className="px-3 py-1 text-[8px] font-black uppercase tracking-widest text-gray-600 flex items-center gap-2">
                                          <div className="w-1 h-1 rounded-full" style={{ backgroundColor: category.color }} />
                                          {category.name}
                                        </div>
                                        {category.skills.map(skill => {
                                          const isLocked = !skill.isUnlocked;
                                          const isSelected = manualQuestSkillId === skill.id;
                                          
                                          return (
                                            <button
                                              key={`skill-dropdown-item-${skill.id}`}
                                              disabled={isLocked}
                                              onClick={() => {
                                                setManualQuestSkillId(skill.id);
                                                setIsSkillDropdownOpen(false);
                                              }}
                                              className={cn(
                                                "w-full text-left px-3 py-2 rounded-xl transition-all flex flex-col gap-0.5",
                                                isLocked ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-800",
                                                isSelected && "bg-blue-500/10 border border-blue-500/20"
                                              )}
                                            >
                                              <div className="flex items-center justify-between">
                                                <span className={cn("text-xs font-bold", isSelected ? "text-blue-400" : "text-gray-200")}>
                                                  {skill.name}
                                                </span>
                                                {isLocked && <Lock size={10} className="text-gray-500" />}
                                              </div>
                                              {isLocked && (
                                                <div className="flex items-center gap-1 text-[8px] text-gray-500 font-medium">
                                                  <AlertCircle size={8} />
                                                  <span>
                                                    {skill.prerequisites && skill.prerequisites.length > 0 
                                                      ? `Requires: ${skill.prerequisites.join(', ')}` 
                                                      : `Cost: ${skill.spCost} SP`}
                                                  </span>
                                                </div>
                                              )}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ))}
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-500">Difficulty</label>
                            <select
                              id="manual-quest-difficulty"
                              defaultValue="easy"
                              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                            >
                              {QUEST_DIFFICULTIES.map(difficulty => (
                                <option key={difficulty} value={difficulty}>{difficulty}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="manual-quest-repeatable" className="w-4 h-4 rounded bg-gray-800 border-gray-700" />
                          <label htmlFor="manual-quest-repeatable" className="text-[10px] font-bold uppercase text-gray-500">Daily Repeatable</label>
                        </div>
                        <button 
                          onClick={async () => {
                            const title = (document.getElementById('manual-quest-title') as HTMLInputElement).value;
                            const skillId = manualQuestSkillId;
                            const difficulty = (document.getElementById('manual-quest-difficulty') as HTMLSelectElement).value as QuestDifficulty;
                            const isRepeatable = (document.getElementById('manual-quest-repeatable') as HTMLInputElement).checked;
                            
                            if (title.trim() && skillId) {
                              const newQuest: Goal = {
                                id: `quest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                skillId,
                                title: title.trim(),
                                completed: false,
                                xpReward: questBaseReward(difficulty, { isRepeatable }),
                                difficulty,
                                isRepeatable,
                              };
                              setGoals(prev => [...prev, newQuest]);
                              setIsAddingQuest(false);
                              setManualQuestSkillId('');
                            }
                          }}
                          className="w-full py-3 rounded-xl bg-blue-600 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Plus size={14} />
                          Add Quest
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                {goals.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-12 flex flex-col items-center justify-center text-center gap-4"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-600">
                      <Trophy size={32} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-gray-300">Your Quest Log is empty</h3>
                      <p className="text-xs text-gray-500 max-w-[200px]">Add some progressive quests to start leveling up your skills!</p>
                    </div>
                  </motion.div>
                )}

                {/* Active Quests */}
                {questFilter === 'all' ? (
                  <div className="space-y-6">
                    {/* Daily Section */}
                    {visibleGoals.some(g => !g.completed && g.repeatType === 'daily') && (
                      <div className="space-y-3">
                        <button 
                          onClick={() => setIsDailyQuestsExpanded(!isDailyQuestsExpanded)}
                          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 hover:text-blue-400 transition-colors w-full"
                        >
                          <span className="flex items-center gap-2">
                            Daily Quests ({visibleGoals.filter(g => !g.completed && g.repeatType === 'daily').length})
                            <ChevronDown size={12} className={cn("transition-transform", isDailyQuestsExpanded && "rotate-180")} />
                          </span>
                          <div className="h-[1px] flex-1 bg-blue-500/10" />
                        </button>
                        
                        <AnimatePresence>
                          {isDailyQuestsExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="space-y-3 overflow-hidden"
                            >
                              {visibleGoals.filter(g => !g.completed && g.repeatType === 'daily').map((goal) => (
                                <QuestItem 
                                  key={`quest-daily-${goal.id}`} 
                                  goal={goal}
                                  toggleGoalCompletion={toggleGoalCompletion}
                                  deletingId={deletingId}
                                  handleDeleteGoal={handleDeleteGoal}
                                  setDeletingId={setDeletingId}
                                  setEditingQuest={setEditingQuest}
                                  setNewQuestTitle={setNewQuestTitle}
                                  setNewQuestXp={setNewQuestXp}
                                  setNewQuestRepeatType={setNewQuestRepeatType}
                                  setNewQuestRepeatDays={setNewQuestRepeatDays}
                                  setManualQuestSkillId={setManualQuestSkillId}
                                  setNewQuestReminders={setNewQuestReminders}
                                  setNewQuestReminderFreq={setNewQuestReminderFreq}
                                  setIsAddingQuest={setIsAddingQuest}
                                  categories={categories}
                                  progress={goalDailyProgress.find(item => item.goalId === goal.id && item.date === dateKey())}
                                  onHabitAction={handleHabitAction}
                                />
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Weekly Section */}
                    {visibleGoals.some(g => !g.completed && g.repeatType === 'weekly') && (
                      <div className="space-y-3">
                        <button 
                          onClick={() => setIsWeeklyQuestsExpanded(!isWeeklyQuestsExpanded)}
                          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 hover:text-emerald-400 transition-colors w-full"
                        >
                          <span className="flex items-center gap-2">
                            Weekly Quests ({visibleGoals.filter(g => !g.completed && g.repeatType === 'weekly').length})
                            <ChevronDown size={12} className={cn("transition-transform", isWeeklyQuestsExpanded && "rotate-180")} />
                          </span>
                          <div className="h-[1px] flex-1 bg-emerald-500/10" />
                        </button>
                        
                        <AnimatePresence>
                          {isWeeklyQuestsExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="space-y-3 overflow-hidden"
                            >
                              {visibleGoals.filter(g => !g.completed && g.repeatType === 'weekly').map((goal) => (
                                <QuestItem 
                                  key={`quest-weekly-${goal.id}`} 
                                  goal={goal}
                                  toggleGoalCompletion={toggleGoalCompletion}
                                  deletingId={deletingId}
                                  handleDeleteGoal={handleDeleteGoal}
                                  setDeletingId={setDeletingId}
                                  setEditingQuest={setEditingQuest}
                                  setNewQuestTitle={setNewQuestTitle}
                                  setNewQuestXp={setNewQuestXp}
                                  setNewQuestRepeatType={setNewQuestRepeatType}
                                  setNewQuestRepeatDays={setNewQuestRepeatDays}
                                  setManualQuestSkillId={setManualQuestSkillId}
                                  setNewQuestReminders={setNewQuestReminders}
                                  setNewQuestReminderFreq={setNewQuestReminderFreq}
                                  setIsAddingQuest={setIsAddingQuest}
                                  categories={categories}
                                  progress={goalDailyProgress.find(item => item.goalId === goal.id && item.date === dateKey())}
                                  onHabitAction={handleHabitAction}
                                />
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* One-Time Section */}
                    {visibleGoals.some(g => !g.completed && (g.repeatType === 'none' || !g.repeatType)) && (
                      <div className="space-y-3">
                        <button 
                          onClick={() => setIsOneTimeQuestsExpanded(!isOneTimeQuestsExpanded)}
                          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 hover:text-orange-400 transition-colors w-full"
                        >
                          <span className="flex items-center gap-2">
                            One-Time ({visibleGoals.filter(g => !g.completed && (g.repeatType === 'none' || !g.repeatType)).length})
                            <ChevronDown size={12} className={cn("transition-transform", isOneTimeQuestsExpanded && "rotate-180")} />
                          </span>
                          <div className="h-[1px] flex-1 bg-orange-500/10" />
                        </button>
                        
                        <AnimatePresence>
                          {isOneTimeQuestsExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="space-y-3 overflow-hidden"
                            >
                              {visibleGoals.filter(g => !g.completed && (g.repeatType === 'none' || !g.repeatType)).map((goal) => (
                                <QuestItem 
                                  key={`quest-one-time-${goal.id}`} 
                                  goal={goal}
                                  toggleGoalCompletion={toggleGoalCompletion}
                                  deletingId={deletingId}
                                  handleDeleteGoal={handleDeleteGoal}
                                  setDeletingId={setDeletingId}
                                  setEditingQuest={setEditingQuest}
                                  setNewQuestTitle={setNewQuestTitle}
                                  setNewQuestXp={setNewQuestXp}
                                  setNewQuestRepeatType={setNewQuestRepeatType}
                                  setNewQuestRepeatDays={setNewQuestRepeatDays}
                                  setManualQuestSkillId={setManualQuestSkillId}
                                  setNewQuestReminders={setNewQuestReminders}
                                  setNewQuestReminderFreq={setNewQuestReminderFreq}
                                  setIsAddingQuest={setIsAddingQuest}
                                  categories={categories}
                                  progress={goalDailyProgress.find(item => item.goalId === goal.id && item.date === dateKey())}
                                  onHabitAction={handleHabitAction}
                                />
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Flat list for other filters (daily, weekly, completed) */
                  <div className="space-y-3">
                    {visibleGoals.map((goal) => (
                      <QuestItem 
                        key={`quest-filtered-${goal.id}`} 
                        goal={goal}
                        toggleGoalCompletion={toggleGoalCompletion}
                        deletingId={deletingId}
                        handleDeleteGoal={handleDeleteGoal}
                        setDeletingId={setDeletingId}
                        setEditingQuest={setEditingQuest}
                        setNewQuestTitle={setNewQuestTitle}
                        setNewQuestXp={setNewQuestXp}
                        setNewQuestRepeatType={setNewQuestRepeatType}
                        setNewQuestRepeatDays={setNewQuestRepeatDays}
                        setManualQuestSkillId={setManualQuestSkillId}
                        setNewQuestReminders={setNewQuestReminders}
                        setNewQuestReminderFreq={setNewQuestReminderFreq}
                        setIsAddingQuest={setIsAddingQuest}
                        categories={categories}
                        progress={goalDailyProgress.find(item => item.goalId === goal.id && item.date === dateKey())}
                        onHabitAction={handleHabitAction}
                      />
                    ))}
                  </div>
                )}

                {/* Completed Quests Section */}
                {visibleGoals.some(g => g.completed) && (
                  <div className="pt-4 space-y-3">
                    <button 
                      onClick={() => setIsCompletedQuestsExpanded(!isCompletedQuestsExpanded)}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 hover:text-gray-400 transition-colors w-full"
                    >
                      <div className="h-[1px] flex-1 bg-gray-800" />
                      <span className="flex items-center gap-2">
                        Completed ({visibleGoals.filter(g => g.completed).length})
                        <ChevronDown size={12} className={cn("transition-transform", isCompletedQuestsExpanded && "rotate-180")} />
                      </span>
                      <div className="h-[1px] flex-1 bg-gray-800" />
                    </button>

                    <AnimatePresence>
                      {isCompletedQuestsExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="space-y-3 overflow-hidden"
                        >
                          {visibleGoals.filter(g => g.completed).map((goal) => (
                            <motion.div
                              key={`quest-log-item-completed-${goal.id}`}
                              layout
                              className="p-4 rounded-2xl border bg-gray-900/20 border-gray-800/50 opacity-60 flex items-center gap-4"
                            >
                              <button 
                                onClick={() => toggleGoalCompletion(goal.id)}
                                className="text-green-500 relative flex-shrink-0"
                              >
                                <CheckCircle2 size={24} />
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="font-bold text-sm truncate line-through text-gray-500">
                                        {goal.title}
                                      </h3>
                                      {goal.streak > 1 && (
                                        <div className="flex items-center gap-1 text-[8px] font-black bg-orange-500/10 text-orange-400/70 px-1.5 py-0.5 rounded uppercase shrink-0">
                                          <Flame size={10} />
                                          {goal.streak}D Streak
                                        </div>
                                      )}
                                    </div>
                                    <StreakProgress 
                                      streak={goal.streak || 0} 
                                      isRepeatable={goal.repeatType === 'daily' || goal.repeatType === 'weekly' || goal.isRepeatable} 
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <motion.button 
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.96 }}
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setEditingQuest(goal);
                                        setNewQuestTitle(goal.title);
                                        setNewQuestXp(goal.xpReward);
                                        setNewQuestRepeatType(goal.repeatType || (goal.isRepeatable ? 'daily' : 'none'));
                                        setNewQuestRepeatDays(goal.repeatDays || []);
                                        setManualQuestSkillId(goal.skillId);
                                        setNewQuestReminders((goal.reminderTimes || []).filter(t => t && t.includes(':') && t.length >= 4));
                                        setNewQuestReminderFreq(goal.reminderFrequency || 'once');
                                        setIsAddingQuest(true);
                                      }}
                                      className="p-1.5 rounded-xl clay-edit-btn shadow-md"
                                    >
                                      <Edit2 size={14} />
                                    </motion.button>
                                    <motion.button 
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.96 }}
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        handleDeleteGoal(goal.id);
                                      }}
                                      className="p-1.5 rounded-xl clay-delete-btn shadow-md"
                                    >
                                      <Trash2 size={14} />
                                    </motion.button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter">
                                    +{calculateQuestReward(goal, goal.streak || 0)} XP
                                  </span>
                                  <span className="text-[10px] text-gray-700">•</span>
                                  <span className="text-[10px] text-gray-600 uppercase font-bold truncate">
                                    {categories.flatMap(c => c.skills).find(s => s.id === goal.skillId)?.name || goal.skillId}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div 
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-black italic">DETAILED STATS</h2>
              <div className="space-y-4">
                <div className="bg-white/70 rounded-2xl border border-white p-4 shadow-sm">
                  <ContributionHeatmap history={history} window={365} title="Yearly contributions" />
                </div>
                <div className="bg-white/70 rounded-2xl border border-white p-4 shadow-sm">
                  <MonthCalendar history={history} year={new Date().getFullYear()} month={new Date().getMonth()} title="Monthly overview" />
                </div>
                <div className="bg-white/70 rounded-2xl border border-white p-4 shadow-sm">
                  <WeeklyHabitMatrix goals={goals} progress={goalDailyProgress} history={history} title="Weekly habit matrix" />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-white/70 rounded-2xl border border-white p-4 shadow-sm"><TrendBars history={history} title="Six-month trend" /></div>
                  <div className="bg-white/70 rounded-2xl border border-white p-4 shadow-sm"><WeekdayBars history={history} window={30} title="Weekday completion" /></div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map(cat => (
                  <div key={`detailed-stats-cat-${cat.id}`} className="bg-gray-900/40 rounded-2xl border border-gray-800 p-4 space-y-4">
                    <div className="flex items-center gap-3">
                       <div 
                         className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/80 shrink-0" 
                         style={{ 
                           background: `linear-gradient(135deg, ${cat.color}da, ${cat.color}ff)`,
                           boxShadow: `
                             0px 4px 10px ${cat.color}30, 
                             inset 2px 2px 4px rgba(255, 255, 255, 0.55), 
                             inset -2px -2px 4px rgba(0, 0, 0, 0.22)
                           `
                         }}
                       >
                        {getIcon(cat.icon, 14, "#ffffff")}
                      </div>
                      <h3 className="font-bold">{cat.name}</h3>
                    </div>
                    <div className="space-y-3">
                      {cat.skills.map(skill => (
                        <div key={`skill-stats-${skill.id}`} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">{skill.name}</span>
                            <span className="font-bold text-white">LVL {skill.level}</span>
                          </div>
                          <ProgressBar value={skill.xp} max={skill.maxXp} color={cat.color} className="h-1.5" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'finance' && (
            <motion.div 
              key="finance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <Suspense
                fallback={
                  <div className="terminal-loading py-16 text-center font-mono text-sm text-gray-400">
                    $ loading finance.module...
                  </div>
                }
              >
                <FinanceTracker onBalancesChange={setFinanceBalances} />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Category Detail Modal */}
      <AnimatePresence>
        {/* Settings Modal */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setIsSettingsOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md bg-[#0f0f12] border border-gray-800 rounded-[2rem] overflow-hidden flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
                      <Settings size={20} className="text-gray-400" />
                    </div>
                    <h2 className="text-xl font-bold">Settings</h2>
                  </div>
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar pb-20">
                  {/* Profile Section */}
                  <section className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Profile</h3>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-400 ml-1">Player Name</label>
                        <input 
                          type="text"
                          value={settingsName}
                          onChange={e => setSettingsName(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                          placeholder="Enter your name..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-400 ml-1">Title</label>
                        <input 
                          type="text"
                          value={settingsTitle}
                          onChange={e => setSettingsTitle(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                          placeholder="Your epic title..."
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Habits & Daily Goal</h3>
                    <label className="block space-y-2">
                      <span className="text-xs font-bold text-gray-400">Daily completion threshold: {userStats.dailyGoalTarget ?? 60}%</span>
                      <input type="range" min="10" max="100" step="5" value={userStats.dailyGoalTarget ?? 60} onChange={event => setUserStats(prev => ({ ...prev, dailyGoalTarget: Number(event.target.value) }))} className="w-full" />
                    </label>
                    <div className="rounded-xl bg-gray-900 p-3 text-xs text-gray-400">
                      Shields: <strong className="text-cyan-400">{userStats.streakShields ?? 0}/3</strong> · earn progress {userStats.shieldProgress ?? 0}/5
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['none', 'vacation', 'sick'] as const).map(mode => (
                        <button type="button" key={mode} onClick={() => setUserStats(prev => ({ ...prev, pauseMode: mode }))} className={cn("rounded-xl border px-2 py-2 text-[10px] font-bold uppercase", (userStats.pauseMode ?? 'none') === mode ? "bg-emerald-600 border-emerald-500 text-white" : "bg-gray-900 border-gray-800 text-gray-400")}>{mode}</button>
                      ))}
                    </div>
                    <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                      <p className="text-xs font-bold text-amber-400">Native integrations</p>
                      <p className="text-[10px] text-gray-500">Apple Health / Health Connect, widgets, and iCloud require a future native build. They are disabled and never affect web scoring.</p>
                    </div>
                  </section>

                  {/* Appearance */}
                  <section className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Themes</h3>
                      <span className="text-[10px] font-mono text-gray-400">
                        Current theme: <strong>{THEME_OPTIONS.find(option => option.id === theme)?.name}</strong>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="App theme">
                      {THEME_OPTIONS.map(option => {
                        const selected = settingsTheme === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setSettingsTheme(option.id)}
                            className={cn(
                              'theme-option min-h-28 p-4 text-left border transition-all',
                              selected
                                ? 'is-selected border-blue-500 bg-blue-500/10'
                                : 'border-gray-800 bg-gray-900 hover:border-gray-600',
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 mb-4">
                              <Palette size={18} className={selected ? 'text-blue-400' : 'text-gray-500'} />
                              <span className="theme-option-marker font-mono text-xs">
                                {selected ? '[x]' : '[ ]'}
                              </span>
                            </div>
                            <p className="text-sm font-black">{option.name}</p>
                            <p className="mt-1 text-[10px] leading-relaxed text-gray-400">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    {settingsTheme !== theme && (
                      <p className="text-[10px] font-mono text-emerald-400">
                        $ theme --apply {settingsTheme} // saves with “Save changes”
                      </p>
                    )}
                  </section>

                  {/* Notifications Section */}
                  <section className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">System Notifications</h3>
                    <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl space-y-6">
                       {/* Sound Selection */}
                       <div className="space-y-3">
                         <div className="flex items-center gap-2">
                           <Volume2 size={16} className="text-blue-400" />
                           <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Notification Tune</label>
                         </div>
                         <div className="grid grid-cols-3 gap-2">
                           {[
                             { id: 'bling', label: 'Bling' },
                             { id: 'minimal', label: 'Subtle' },
                             { id: 'crystal', label: 'Crystal' }
                           ].map((s) => (
                             <button
                               key={s.id}
                               onClick={() => {
                                 localStorage.setItem('quest_rpg_notif_sound', s.id);
                                 setUserStats(prev => ({ ...prev, notificationSound: s.id }));
                                 playSound(s.id);
                               }}
                               className={cn(
                                 "px-2 py-2.5 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-tighter",
                                 (userStats.notificationSound || localStorage.getItem('quest_rpg_notif_sound') || 'bling') === s.id
                                   ? "bg-blue-600 border-blue-500 text-white shadow-md button-solid-white-text"
                                   : "bg-gray-100/50 border-gray-200 text-slate-500 hover:border-gray-300 hover:text-slate-800"
                               )}
                             >
                               {s.id === userStats.notificationSound ? (
                                 <div className="flex items-center justify-center gap-1">
                                   <div className="w-1 h-1 bg-current rounded-full animate-pulse" />
                                   {s.label}
                                 </div>
                               ) : s.label}
                             </button>
                           ))}
                         </div>
                       </div>

                       {!("Notification" in window) ? (
                         <div className="flex items-center gap-3 text-orange-400/80">
                           <Ban size={18} />
                           <p className="text-[10px] font-bold uppercase">Not supported by browser</p>
                         </div>
                       ) : (
                         <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Bell size={18} className={Notification.permission === 'granted' ? "text-blue-400" : "text-gray-400"} />
                            <div className="flex flex-col">
                              <p className="text-sm font-medium">Status</p>
                              <p className={cn(
                                "text-[9px] font-black uppercase tracking-widest",
                                Notification.permission === 'granted' ? "text-green-400" : 
                                Notification.permission === 'denied' ? "text-red-400" : "text-yellow-400"
                              )}>
                                {Notification.permission === 'granted' ? 'Authorized' : 
                                 Notification.permission === 'denied' ? 'Blocked in Browser' : 'Permission Required'}
                              </p>
                            </div>
                          </div>
                          {Notification.permission !== 'granted' && Notification.permission !== 'denied' && (
                            <button 
                              onClick={async () => {
                                const res = await Notification.requestPermission();
                                if (res === 'granted') {
                                  setNotification({ title: "System Info", message: "Notifications Authorized!", xp: 0 });
                                }
                                // Force re-render of settings
                                setUserStats(s => ({...s}));
                              }}
                              className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded-lg shadow-lg active:scale-95 transition-all"
                            >
                              ENABLE
                            </button>
                          )}
                        </div>
                       )}
                       
                       <div className="space-y-2 pt-2 border-t border-gray-800/50">
                         <div className="flex items-start gap-2">
                           <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 shrink-0" />
                           <p className="text-[9px] text-gray-400 font-medium leading-tight">
                             Quests must be <span className="text-blue-400">active</span> (not completed) to trigger reminders.
                           </p>
                         </div>
                         <div className="flex items-start gap-2">
                           <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 shrink-0" />
                           <p className="text-[9px] text-gray-400 font-medium leading-tight">
                             Daily reminders fire daily. Weekly reminders fire only on selected days.
                           </p>
                         </div>
                         <div className="flex items-start gap-2">
                           <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-1 shrink-0" />
                           <p className="text-[9px] text-orange-400/80 font-bold leading-tight">
                             PRO TIP: For background notifications when phone is locked, keep the app open in a browser tab.
                           </p>
                         </div>
                       </div>
                    </div>
                  </section>

                  {/* App Installation Guide */}
                  <section className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">App Installation</h3>
                    <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl space-y-4">
                      <div className="space-y-1">
                        <h4 className="text-xs font-black text-slate-200 uppercase tracking-tight">Run as a Standalone App</h4>
                        <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
                          Installing LifeQuest lets you run it full-screen without web borders, loads much faster, and works completely offline!
                        </p>
                      </div>

                      {/* Standalone URL Copy Block */}
                      <div className="p-3 bg-gray-950/60 border border-gray-800 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Direct App URL</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-black uppercase tracking-wide">Required for Install</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            readOnly 
                            value={window.location.origin} 
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            className="bg-gray-900 border border-gray-800 text-gray-300 rounded-lg px-2.5 py-1.5 text-[10px] font-mono flex-1 select-all outline-none"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(window.location.origin);
                              setCopiedLink(true);
                              setTimeout(() => setCopiedLink(false), 2000);
                            }}
                            className="p-2.5 rounded-lg bg-gray-800 border border-gray-750 text-gray-400 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0"
                            style={{ minWidth: "40px" }}
                            title="Copy link"
                          >
                            {copiedLink ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          </button>
                        </div>
                        <p className="text-[9px] text-yellow-400/95 font-bold leading-normal">
                          ⚠️ For iOS/Android: Copy this URL and open it directly inside Safari or Chrome (not inside AI Studio Chat) to enable the install options!
                        </p>
                      </div>

                      {installPrompt ? (
                        <button 
                          onClick={handleInstall}
                          className="w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-white font-extrabold uppercase text-xs tracking-wider border border-white/20 select-none cursor-pointer"
                          style={{
                            background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                            boxShadow: "0px 6px 16px rgba(37, 99, 235, 0.25), inset 2px 2px 4px rgba(255, 255, 255, 0.45)"
                          }}
                        >
                          <Download size={14} />
                          <span>Install Standalone App</span>
                        </button>
                      ) : (
                        <div className="space-y-3 pt-1">
                          {/* iOS / Safari */}
                          <div className="p-3 bg-gray-950/40 border border-gray-800 rounded-xl space-y-1">
                            <p className="text-xs font-black text-rose-400 flex items-center gap-1.5 uppercase tracking-wide">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block animate-pulse" />
                              iPhone & iPad (Safari)
                            </p>
                            <ol className="list-decimal pl-4 text-[10px] text-gray-400 font-semibold space-y-1">
                              <li>Copy the URL above and open it inside <strong className="text-slate-200">Safari</strong>.</li>
                              <li>Tap the <strong className="text-slate-200">Share</strong> icon (square with an up arrow) in Safari's bottom toolbar.</li>
                              <li>Scroll down and select <strong className="text-slate-200">"Add to Home Screen"</strong>.</li>
                            </ol>
                          </div>

                          {/* Android / Chrome */}
                          <div className="p-3 bg-gray-950/40 border border-gray-800 rounded-xl space-y-1">
                            <p className="text-xs font-black text-blue-400 flex items-center gap-1.5 uppercase tracking-wide">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block animate-pulse" />
                              Android & Chrome
                            </p>
                            <ol className="list-decimal pl-4 text-[10px] text-gray-400 font-semibold space-y-1">
                              <li>Copy the URL above and open it inside <strong className="text-slate-200">Chrome</strong>.</li>
                              <li>Tap the browser options menu button <strong className="text-slate-200">(⋮)</strong> at the top right.</li>
                              <li>Select <strong className="text-slate-200">"Add to Home screen"</strong> or <strong className="text-slate-200">"Install app"</strong>.</li>
                            </ol>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Data Management */}
                  <section className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Data Management</h3>
                    <div className="space-y-2">
                      <button 
                        onClick={() => window.location.reload()}
                        className="w-full flex items-center justify-between p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl hover:bg-blue-600/20 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <RefreshCw size={18} className="text-blue-400" />
                          <span className="text-sm font-medium text-blue-400">Refresh & Update App</span>
                        </div>
                        <ChevronRight size={16} className="text-blue-400" />
                      </button>
                      <button 
                        onClick={handleExportData}
                        className="w-full flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:bg-gray-800/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <Download size={18} className="text-gray-400 group-hover:text-blue-400" />
                          <span className="text-sm font-medium">Export Progress</span>
                        </div>
                        <ChevronRight size={16} className="text-gray-600" />
                      </button>
                      <label className="w-full flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:bg-gray-800/50 transition-colors group cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Upload size={18} className="text-gray-400 group-hover:text-green-400" />
                          <span className="text-sm font-medium">Import Progress</span>
                        </div>
                        <ChevronRight size={16} className="text-gray-600" />
                        <input 
                          type="file" 
                          accept=".json" 
                          onChange={handleImportData} 
                          className="hidden" 
                        />
                      </label>
                      <button 
                        onClick={handleResetData}
                        className="w-full flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:bg-gray-800/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <Trash2 size={18} className="text-gray-400 group-hover:text-red-400" />
                          <span className="text-sm font-medium text-red-400/80">Reset All Data</span>
                        </div>
                        <ChevronRight size={16} className="text-gray-600" />
                      </button>
                    </div>
                  </section>

                  {/* App Info */}
                  <div className="pt-4 text-center">
                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">LifeRPG v1.0.4</p>
                  </div>

                  {/* Save Button */}
                      <div className="flex gap-2">
                        <button 
                          onClick={handleSaveSettings}
                          className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 size={20} />
                          SAVE CHANGES
                        </button>
                        <button 
                          onClick={() => {
                            playSound('questComplete');
                            setNotification({ title: "Audio Test", message: "Sound is working perfectly!", xp: 0 });
                            setTimeout(() => setNotification(null), 2000);
                          }}
                          className="px-4 bg-gray-900 border border-gray-800 rounded-2xl hover:bg-gray-800 transition-colors flex items-center justify-center text-gray-400"
                          title="Test Sound"
                        >
                          <Volume2 size={20} />
                        </button>
                      </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {isInstallGuideOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 shadow-2xl"
            onClick={() => setIsInstallGuideOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#0f0f12] border border-gray-800 rounded-[2rem] overflow-hidden flex flex-col relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Download className="text-blue-400" size={18} />
                  <h3 className="text-sm font-black uppercase text-white tracking-tight leading-none">Installation Guide</h3>
                </div>
                <button 
                  onClick={() => setIsInstallGuideOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-850 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-6 space-y-5 text-left">
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-tight">Run as a Standalone App</h4>
                  <p className="text-[10.5px] text-gray-400 font-semibold leading-relaxed">
                    You can install LifeQuest locally to launch it directly from your device's home screen, support fast offline load, and run without browser borders!
                  </p>
                </div>

                {/* Standalone URL Copy Block inside Modal */}
                <div className="p-3 bg-gray-950/65 border border-gray-800 rounded-2xl space-y-2 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Direct App URL</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-black uppercase tracking-wide">Required for Install</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={window.location.origin} 
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="bg-gray-900 border border-gray-800 text-gray-300 rounded-lg px-2.5 py-1.5 text-[10px] font-mono flex-1 select-all outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.origin);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="p-2.5 rounded-lg bg-gray-800 border border-gray-750 text-gray-400 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0"
                      style={{ minWidth: "40px" }}
                    >
                      {copiedLink ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <p className="text-[9px] text-yellow-400/95 font-bold leading-normal">
                    ⚠️ Copy this URL and open it inside Safari (on iOS) or Chrome (on Android) to trigger the install prompt!
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Safari / iOS */}
                  <div className="p-4 bg-gray-950/50 border border-gray-800 rounded-2xl space-y-1.5 shadow-inner">
                    <p className="text-xs font-black text-rose-400 flex items-center gap-1.5 uppercase tracking-wide">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block animate-pulse" />
                      Safari on iOS (iPhone / iPad)
                    </p>
                    <ol className="list-decimal pl-4.5 text-[10px] text-gray-400 font-bold space-y-1 leading-normal">
                      <li>Copy the URL above and open it inside <strong className="text-slate-200">Safari</strong>.</li>
                      <li>Tap the <strong className="text-slate-200">Share</strong> icon (rectangle with up arrow) in Safari's bottom bar.</li>
                      <li>Scroll down and tap <strong className="text-slate-200">"Add to Home Screen"</strong>.</li>
                    </ol>
                  </div>

                  {/* Chrome / Desktop / Android */}
                  <div className="p-4 bg-gray-950/50 border border-gray-800 rounded-2xl space-y-1.5 shadow-inner">
                    <p className="text-xs font-black text-blue-400 flex items-center gap-1.5 uppercase tracking-wide">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block animate-pulse" />
                      Chrome (Android / Desktop)
                    </p>
                    <ol className="list-decimal pl-4.5 text-[10px] text-gray-400 font-bold space-y-1 leading-normal">
                      <li>Copy the URL above and open it inside <strong className="text-slate-200">Chrome</strong>.</li>
                      <li>Tap the options button <strong className="text-slate-200">(⋮)</strong> at the top right of Chrome.</li>
                      <li>Tap <strong className="text-slate-200">"Add to Home screen"</strong> or <strong className="text-slate-200">"Install app"</strong>.</li>
                    </ol>
                  </div>
                </div>

                <button
                  onClick={() => setIsInstallGuideOpen(false)}
                  className="w-full py-3 px-4 rounded-xl text-white text-xs font-extrabold uppercase tracking-widest bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:scale-[0.98] transition-all cursor-pointer text-center"
                  style={{
                    boxShadow: "0px 4px 12px rgba(37, 99, 235, 0.25)"
                  }}
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {selectedCategoryId && selectedCategory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center p-2 sm:p-4 overflow-y-auto"
            onClick={() => setSelectedCategoryId(null)}
          >
            <div className="min-h-full flex items-center justify-center py-8 w-full">
              <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                exit={{ y: 100 }}
                className="w-full max-w-2xl bg-[#0f0f12] border border-gray-800 rounded-[2rem] overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
                onClick={e => e.stopPropagation()}
              >
              <div className="h-32 relative flex-shrink-0" style={{ backgroundColor: selectedCategory.color }}>
                <div className="absolute inset-0 bg-gradient-to-t from-white/95 to-transparent" />
                <button 
                  onClick={() => setSelectedCategoryId(null)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white z-10 hover:bg-black/60 transition-colors"
                >
                  <X size={24} />
                </button>
                <div className="absolute bottom-0 left-0 p-4 sm:p-5 flex items-end gap-4">
                  <div 
                    className="w-16 h-16 rounded-2xl border border-white/80 flex items-center justify-center shrink-0 animate-in zoom-in-75 duration-300"
                    style={{ 
                      background: `linear-gradient(135deg, ${selectedCategory.color}da, ${selectedCategory.color}ff)`,
                      boxShadow: `
                        0px 8px 18px ${selectedCategory.color}40, 
                        inset 4px 4px 8px rgba(255, 255, 255, 0.55), 
                        inset -4px -4px 8px rgba(0, 0, 0, 0.22)
                      `
                    }}
                  >
                    {getIcon(selectedCategory.icon, 28, "#ffffff")}
                  </div>
                  <div className="mb-1">
                    <h2 className="text-2xl font-black italic uppercase">{selectedCategory.name}</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Category Mastery</p>
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-5 space-y-6 overflow-y-auto flex-1 custom-scrollbar pb-40">
                <div className="space-y-4 pr-1">
                  {selectedCategory.skills.map(skill => {
                      const isLocked = skill.prerequisites?.some(preId => {
                        const preSkill = categories.flatMap(c => c.skills).find(s => s.id === preId);
                        return !preSkill || preSkill.level < 1;
                      });

                      const canUnlock = !skill.isUnlocked && !isLocked && userStats.skillPoints >= skill.spCost;

                      return (
                        <div 
                          key={`skill-modal-${skill.id}`} 
                          className={cn(
                            "p-3 sm:p-4 rounded-2xl border space-y-3 transition-all",
                            !skill.isUnlocked ? "bg-gray-900/20 border-gray-800/50 opacity-80" : "bg-gray-900/40 border-gray-800"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 min-h-[2rem]">
                                {editingId === skill.id ? (
                                  <div className="flex-1 flex flex-col gap-2 py-1">
                                    <input 
                                      autoFocus
                                      className="w-full bg-gray-800 border border-blue-500/50 rounded-lg px-2 py-1.5 text-sm font-bold text-white outline-none"
                                      value={editingValue}
                                      onChange={e => setEditingValue(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleEditSkill(skill.id, editingValue, editingDescription, editingIcon);
                                        if (e.key === 'Escape') setEditingId(null);
                                      }}
                                    />
                                    <textarea
                                      className="w-full bg-gray-800 border border-blue-500/50 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none resize-none h-16"
                                      value={editingDescription}
                                      onChange={e => setEditingDescription(e.target.value)}
                                      placeholder="Skill description..."
                                    />
                                    <IconPicker
                                      value={editingIcon}
                                      onChange={setEditingIcon}
                                      color={selectedCategory.color}
                                      label="Skill icon"
                                    />
                                  </div>
                                ) : (
                                  <>
                                    <h4 className="font-bold text-sm leading-none flex items-center gap-1.5">
                                      <HabitIcon name={skill.icon ?? selectedCategory.icon} size={14} color={selectedCategory.color} aria-hidden />
                                      {skill.name}
                                    </h4>
                                    {skill.specialization && (
                                      <span className="text-[8px] font-black bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase shrink-0">
                                        {skill.specialization}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                              {editingId !== skill.id && (
                                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">
                                  {!skill.isUnlocked && isLocked ? `Requires: ${skill.prerequisites?.join(', ')}` : skill.description}
                                </p>
                              )}
                              {skill.isUnlocked && (
                                <div className="space-y-2 mt-1">
                                  <div className="flex items-center gap-1.5 ">
                                    <Trophy size={10} className="text-blue-400" />
                                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">
                                      Reward: +{Math.round(skill.xpReward * userStats.xpMultiplier)} XP
                                    </span>
                                  </div>
                                  {skill.perks && skill.perks.length > 0 && (
                                    <div className="pt-2 border-t border-gray-800/50">
                                      <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-1">
                                        <Star size={8} /> Skill Perks
                                      </p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {skill.perks.map((perk, pIdx) => (
                                          <div 
                                            key={pIdx}
                                            className={cn(
                                              "px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all",
                                              skill.level >= perk.level 
                                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
                                                : "bg-gray-800/20 text-gray-600 border-gray-800/50"
                                            )}
                                          >
                                            LVL {perk.level}: {perk.description}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0 min-h-[2rem]">
                              {editingId === skill.id ? (
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => handleEditSkill(skill.id, editingValue, editingDescription, editingIcon)}
                                    className="p-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/20"
                                  >
                                    <CheckCircle2 size={14} />
                                  </button>
                                  <button 
                                    onClick={() => setEditingId(null)}
                                    className="p-1.5 rounded-lg bg-gray-800 text-gray-400 border border-gray-700"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : deletingId === skill.id ? (
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => handleDeleteSkill(skill.id)}
                                    className="px-2 py-1.5 rounded-lg bg-red-600 text-white text-[10px] font-black uppercase"
                                  >
                                    Delete
                                  </button>
                                  <button 
                                    onClick={() => setDeletingId(null)}
                                    className="p-1.5 rounded-lg bg-gray-800 text-gray-400 border border-gray-700"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex gap-1.5">
                                    <motion.button 
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.96 }}
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setEditingId(skill.id);
                                        setEditingValue(skill.name);
                                        setEditingDescription(skill.description);
                                        setEditingIcon(skill.icon ?? selectedCategory.icon);
                                      }}
                                      className="p-1.5 rounded-lg clay-edit-btn shadow-md"
                                    >
                                      <Edit2 size={14} />
                                    </motion.button>
                                    <motion.button 
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.96 }}
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setDeletingId(skill.id);
                                      }}
                                      className="p-1.5 rounded-lg clay-delete-btn shadow-md"
                                    >
                                      <Trash2 size={14} />
                                    </motion.button>
                                  </div>

                                  {skill.isUnlocked ? (
                                    <span className="text-xs font-black italic ml-2" style={{ color: selectedCategory.color }}>
                                      LVL {skill.level}
                                    </span>
                                  ) : (
                                    <button
                                      disabled={!canUnlock}
                                      onClick={() => {
                                        setCategories(prev => prev.map(cat => ({
                                          ...cat,
                                          skills: cat.skills.map(s => s.id === skill.id ? { ...s, isUnlocked: true } : s)
                                        })));
                                        setUserStats(prev => ({ ...prev, skillPoints: prev.skillPoints - skill.spCost }));
                                      }}
                                      className={cn(
                                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ml-2 h-8",
                                        canUnlock 
                                          ? "bg-blue-600 text-white shadow-lg active:scale-95" 
                                          : "bg-gray-800 text-gray-500 cursor-not-allowed"
                                      )}
                                    >
                                      Unlock ({skill.spCost} SP)
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          
                          {skill.isUnlocked && (
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                                  <span>Progress</span>
                                  <span>
                                    {skill.xp}/{skill.maxXp} XP · {Math.round((skill.xp / skill.maxXp) * 100)}% · {skill.maxXp - skill.xp} left
                                  </span>
                                </div>
                                <ProgressBar value={skill.xp} max={skill.maxXp} color={selectedCategory.color} />
                              </div>

                                <div className="flex items-center justify-between p-2 rounded-xl bg-gray-800/50 border border-gray-700/50 group">
                                  <button 
                                    onClick={() => setExpandedSkillId(expandedSkillId === skill.id ? null : skill.id)}
                                    className="flex-1 flex items-center justify-between hover:bg-gray-800 transition-all p-1 rounded-lg"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Target size={14} className="text-blue-400" />
                                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Skill Quests</span>
                                    </div>
                                    <ChevronRight size={14} className={cn("text-gray-500 transition-transform", expandedSkillId === skill.id && "rotate-90")} />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setManualQuestSkillId(skill.id);
                                      setIsAddingQuest(true);
                                    }}
                                    className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors ml-2"
                                    title="Add Manual Quest"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>

                              <AnimatePresence>
                                {expandedSkillId === skill.id && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden space-y-2"
                                  >
                                    <div className="space-y-2 pt-1">
                                      {visibleGoals.filter(g => g.skillId === skill.id).map((goal, idx) => (
                                        <div 
                                          key={`skill-quest-item-${goal.id}`}
                                          onClick={() => toggleGoalCompletion(goal.id)}
                                          className={cn(
                                            "p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer",
                                            goal.completed ? "bg-green-500/5 border-green-500/10 opacity-60" : "bg-gray-800/30 border-gray-700/50 hover:border-gray-600"
                                          )}
                                        >
                                          <div className="w-5 h-5 rounded-full border border-gray-600 flex items-center justify-center text-[10px] font-black text-gray-500 shrink-0">
                                            {idx + 1}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className={cn("text-xs font-bold truncate", goal.completed && "line-through text-gray-500")}>
                                              {goal.title}
                                            </p>
                                            <div className="flex items-center gap-2">
                                              {goal.repeatType === 'daily' && (
                                                <span className="text-[8px] font-black text-green-400 uppercase tracking-tighter">Daily</span>
                                              )}
                                              {goal.repeatType === 'weekly' && (
                                                <span className="text-[8px] font-black text-purple-400 uppercase tracking-tighter">Weekly</span>
                                              )}
                                              {!goal.repeatType && goal.isRepeatable && (
                                                <span className="text-[8px] font-black text-green-400 uppercase tracking-tighter">Daily</span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingQuest(goal);
                                                setNewQuestTitle(goal.title);
                                                setNewQuestXp(goal.xpReward);
                                                setNewQuestRepeatType(goal.repeatType || (goal.isRepeatable ? 'daily' : 'none'));
                                                setNewQuestRepeatDays(goal.repeatDays || []);
                                                setManualQuestSkillId(goal.skillId);
                                                setNewQuestReminders((goal.reminderTimes || []).filter(t => t && t.includes(':') && t.length >= 4));
                                                setNewQuestReminderFreq(goal.reminderFrequency || 'once');
                                                setIsAddingQuest(true);
                                              }}
                                              className="p-1.5 rounded-lg clay-edit-btn shadow-sm"
                                            >
                                              <Edit2 size={12} />
                                            </button>
                                            {goal.completed ? (
                                              <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                                            ) : (
                                              <div className="text-[10px] font-black text-blue-400 shrink-0">
                                                +{calculateQuestReward(goal, goal.streak || 0, skill.specialization)}XP
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}

                                      {(visibleGoals.filter(g => g.skillId === skill.id).length === 0 || visibleGoals.filter(g => g.skillId === skill.id).every(g => g.completed)) && (
                                        <div className="text-center py-4 space-y-2">
                                          {visibleGoals.filter(g => g.skillId === skill.id).length === 0 && (
                                            <p className="text-[10px] text-gray-500 italic">No progressive quests yet.</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Specialization Selection at Level 5 */}
                          {skill.isUnlocked && skill.level >= 5 && !skill.specialization && (
                            <div className="pt-3 border-t border-gray-800/50 space-y-3">
                              <div>
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Specialization Available!</p>
                                <p className="text-[9px] text-gray-500">Choose your path to unlock unique bonuses and master quests.</p>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => {
                                    setCategories(prev => prev.map(c => ({
                                      ...c,
                                      skills: c.skills.map(s => s.id === skill.id ? { ...s, specialization: 'Expert' } : s)
                                    })));
                                  }}
                                  className="flex-1 p-3 rounded-xl bg-blue-600/10 border border-blue-600/30 text-left hover:bg-blue-600/20 transition-all group"
                                >
                                  <p className="text-xs font-black text-blue-400 uppercase">EXPERT</p>
                                  <p className="text-[8px] text-gray-500 leading-tight mt-1 group-hover:text-gray-400">+20% XP Bonus & Expert Quests</p>
                                </button>
                                <button 
                                  onClick={() => {
                                    setCategories(prev => prev.map(c => ({
                                      ...c,
                                      skills: c.skills.map(s => s.id === skill.id ? { ...s, specialization: 'Master' } : s)
                                    })));
                                  }}
                                  className="flex-1 p-3 rounded-xl bg-purple-600/10 border border-purple-600/30 text-left hover:bg-purple-600/20 transition-all group"
                                >
                                  <p className="text-xs font-black text-purple-400 uppercase">MASTER</p>
                                  <p className="text-[8px] text-gray-500 leading-tight mt-1 group-hover:text-gray-400">+50% XP Bonus & Master Quests</p>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                          {/* Add New Skill Form/Button */}
                  <div className="pt-2 space-y-3">
                    <AddSkillForm 
                      category={selectedCategory} 
                      onAdd={(name, desc, xpReward, icon) => {
                        const hasUnlocked = selectedCategory.skills.some(s => s.isUnlocked);
                        const isFirstSkill = !hasUnlocked;
                        const newSkill: Skill = {
                          id: Math.random().toString(36).substr(2, 9),
                          name,
                          icon,
                          description: desc,
                          level: 1,
                          xp: 0,
                          maxXp: xpRequiredForLevel(1),
                          xpReward,
                          isUnlocked: isFirstSkill,
                          spCost: isFirstSkill ? 0 : 1
                        };
                        setCategories(prev => prev.map(c => 
                          c.id === selectedCategory.id 
                            ? { ...c, skills: [...c.skills, newSkill] } 
                            : c
                        ));
                      }} 
                    />
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0c]/80 backdrop-blur-xl border-t border-gray-800 px-6 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <NavButton 
            active={activeTab === 'home'} 
            onClick={() => setActiveTab('home')} 
            icon={Home} 
            label="Home" 
          />
          <NavButton 
            active={activeTab === 'stats'} 
            onClick={() => setActiveTab('stats')} 
            icon={BarChart3} 
            label="Stats" 
          />
          <NavButton 
            active={activeTab === 'goals'} 
            onClick={() => setActiveTab('goals')} 
            icon={Trophy} 
            label="Quests" 
          />
          <NavButton 
            active={activeTab === 'finance'} 
            onClick={() => setActiveTab('finance')} 
            icon={Wallet} 
            label="Finance" 
          />
        </div>
      </nav>

      {/* Quest Completion Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="fixed bottom-24 left-4 right-4 z-50 flex justify-center pointer-events-none"
          >
            <div className="bg-blue-600 text-white px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(37,99,235,0.4)] border border-white/20 flex items-center gap-4 max-w-sm w-full mx-auto pointer-events-auto">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Trophy size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{notification.title || "Quest Completed!"}</p>
                <h4 className="font-bold text-sm leading-snug break-words">{notification.message}</h4>
              </div>
              {notification.xp > 0 && (
                <div className="text-right shrink-0">
                  <span className="text-lg font-black italic">+{notification.xp} XP</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Category Modal */}
      <AnimatePresence>
        {isAddingCategory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto"
            onClick={() => setIsAddingCategory(false)}
          >
            <div className="min-h-full w-full flex p-4" onClick={() => setIsAddingCategory(false)}>
              <div className="m-auto w-full flex justify-center" onClick={e => e.stopPropagation()}>
                <CategoryForm 
                  onSave={handleAddCategory} 
                  onClose={() => setIsAddingCategory(false)} 
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {categoryToEdit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto"
            onClick={() => setCategoryToEdit(null)}
          >
            <div className="min-h-full w-full flex p-4" onClick={() => setCategoryToEdit(null)}>
              <div className="m-auto w-full flex justify-center" onClick={e => e.stopPropagation()}>
                <CategoryForm 
                  initialData={{ name: categoryToEdit.name, icon: categoryToEdit.icon, color: categoryToEdit.color }}
                  onSave={(name, icon, color) => handleEditCategory(categoryToEdit.id, name, icon, color)} 
                  onClose={() => setCategoryToEdit(null)} 
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Manual Quest Modal */}
      <AnimatePresence>
        {isAddingQuest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm overflow-y-auto overflow-x-hidden"
            onClick={() => {
              setIsAddingQuest(false);
              setEditingQuest(null);
              setNewQuestTitle('');
              setNewQuestXp(50);
              setNewQuestRepeatType('none');
              setNewQuestRepeatDays([]);
              setManualQuestSkillId('');
              setNewQuestReminders([]);
              setNewQuestReminderFreq('once');
            }}
          >
            <div className="min-h-full w-full flex p-4" onClick={() => {
              setIsAddingQuest(false);
              setEditingQuest(null);
              setNewQuestTitle('');
              setNewQuestXp(50);
              setNewQuestRepeatType('none');
              setNewQuestRepeatDays([]);
              setManualQuestSkillId('');
              setNewQuestReminders([]);
              setNewQuestReminderFreq('once');
            }}>
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="w-full max-w-sm bg-[#0f0f12] border border-gray-800 rounded-[2.5rem] flex flex-col shadow-2xl m-auto overflow-visible"
                onClick={e => e.stopPropagation()}
              >
              <div className="p-6 border-b border-gray-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Plus size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold leading-tight">{editingQuest ? 'Edit Quest' : 'Add Quest'}</h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{editingQuest ? 'Update Details' : 'Manual Entry'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsAddingQuest(false);
                    setEditingQuest(null);
                    setNewQuestTitle('');
                    setNewQuestXp(50);
                    setNewQuestRepeatType('none');
                    setNewQuestRepeatDays([]);
                    setManualQuestSkillId('');
                  }}
                  className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4 overflow-visible custom-scrollbar max-h-[70vh]">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-500">Quest Title</label>
                  <input 
                    autoFocus
                    placeholder="e.g. Read 10 pages of a book"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    value={newQuestTitle}
                    onChange={e => setNewQuestTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-500">Note</label>
                  <input className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white" value={newQuestNote} onChange={event => setNewQuestNote(event.target.value)} placeholder="why or how to do it" />
                </div>
                <IconPicker value={newQuestIcon} onChange={setNewQuestIcon} color="#8b5cf6" label="Habit icon" />
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-gray-500">Tracking mode</label>
                  <div className="grid grid-cols-5 gap-1">
                    {(['checkbox', 'counter', 'numeric', 'timer', 'health'] as const).map(mode => (
                      <button type="button" key={mode} onClick={() => {
                        setNewQuestTrackingMode(mode);
                        if (mode === 'timer') setNewQuestUnit('minutes');
                      }} className={cn("py-2 rounded-lg text-[8px] font-bold uppercase border", newQuestTrackingMode === mode ? "bg-emerald-600 border-emerald-500 text-white" : "bg-gray-800 border-gray-700 text-gray-400")}>
                        {mode}
                      </button>
                    ))}
                  </div>
                  {newQuestTrackingMode !== 'checkbox' && newQuestTrackingMode !== 'health' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" type="number" min="1" value={newQuestTarget} onChange={event => setNewQuestTarget(Math.max(1, Number(event.target.value)))} aria-label="Target value" />
                      <input className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" value={newQuestTrackingMode === 'timer' ? 'minutes' : newQuestUnit} disabled={newQuestTrackingMode === 'timer'} onChange={event => setNewQuestUnit(event.target.value)} aria-label="Target unit" />
                    </div>
                  )}
                  {newQuestTrackingMode === 'health' && <p className="text-[9px] text-amber-400">Read-only web placeholder; excluded from XP and daily-goal scoring.</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-500">Routine</label>
                  <select className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white" value={newQuestRoutineId} onChange={event => setNewQuestRoutineId(event.target.value)}>
                    <option value="">Automatic category group</option>
                    {[...routines].sort((a, b) => a.sortOrder - b.sortOrder).map(routine => <option key={routine.id} value={routine.id}>{routine.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3 overflow-visible relative">
                  <div className="space-y-1 relative z-50">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Skill</label>
                    <button 
                      onClick={() => setIsSkillDropdownOpen(!isSkillDropdownOpen)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white text-left flex items-center justify-between hover:border-gray-600 transition-all"
                    >
                      <span className="truncate">
                        {manualQuestSkillId 
                          ? categories.flatMap(c => c.skills).find(s => s.id === manualQuestSkillId)?.name 
                          : "Select Skill"}
                      </span>
                      <ChevronDown size={14} className={cn("transition-transform", isSkillDropdownOpen && "rotate-180")} />
                    </button>
                    
                    <AnimatePresence>
                      {isSkillDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsSkillDropdownOpen(false)} />
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                className="absolute top-full left-0 right-[-50px] md:right-[-150px] mt-3 bg-[#16161a] border border-blue-500/20 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden z-[100] max-h-56 overflow-y-auto custom-scrollbar backdrop-blur-2xl"
                              >
                            <div className="p-2 space-y-1">
                              {categories.flatMap(c => c.skills).filter(s => s.isUnlocked).map(skill => (
                                <button
                                  key={`manual-quest-skill-opt-${skill.id}`}
                                  onClick={() => {
                                    setManualQuestSkillId(skill.id);
                                    setIsSkillDropdownOpen(false);
                                  }}
                                  className={cn(
                                    "w-full px-4 py-3 text-left text-xs font-bold rounded-xl transition-all flex items-center justify-between",
                                    manualQuestSkillId === skill.id
                                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/20 shadow-inner"
                                      : "text-gray-400 hover:bg-gray-800/50 hover:text-white"
                                  )}
                                >
                                  {skill.name}
                                  {manualQuestSkillId === skill.id && <Sparkles size={12} className="text-blue-400 animate-pulse" />}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Difficulty</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {QUEST_DIFFICULTIES.map(difficulty => (
                        <button
                          type="button"
                          key={difficulty}
                          onClick={() => setNewQuestDifficulty(difficulty)}
                          className={cn(
                            "py-2 rounded-xl text-[9px] font-bold uppercase border transition-all",
                            newQuestDifficulty === difficulty
                              ? "bg-violet-600 border-violet-500 text-white"
                              : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                          )}
                        >
                          {difficulty}
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] font-bold text-violet-400">
                      +{questBaseReward(newQuestDifficulty, {
                        repeatType: newQuestRepeatType,
                        isRepeatable: newQuestRepeatType !== 'none',
                      })} XP before bonuses
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-gray-500">Repeatability</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['none', 'daily', 'weekly'] as const).map(type => (
                      <button
                        key={`repeat-type-${type}`}
                        onClick={() => setNewQuestRepeatType(type)}
                        className={cn(
                          "py-2 rounded-xl text-[10px] font-bold uppercase border transition-all",
                          newQuestRepeatType === type 
                            ? "bg-blue-600 border-blue-500 text-white" 
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                        )}
                      >
                        {type === 'none' ? 'One-Time' : type}
                      </button>
                    ))}
                  </div>
                </div>

                {newQuestRepeatType === 'weekly' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Select Days</label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS_OF_WEEK.map((day, idx) => (
                        <button
                          key={`repeat-day-${idx}`}
                          onClick={() => {
                            setNewQuestRepeatDays(prev => 
                              prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
                            );
                          }}
                          className={cn(
                            "w-8 h-8 rounded-lg text-[10px] font-bold border transition-all",
                            newQuestRepeatDays.includes(idx)
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                          )}
                        >
                          {day[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase text-gray-500 flex items-center gap-1.5">
                      <Bell size={12} className="text-blue-400" />
                      Reminders
                    </label>
                    <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50">
                      {(['once', 'multiple'] as const).map((freq) => (
                        <button
                          key={freq}
                          onClick={() => setNewQuestReminderFreq(freq)}
                          className={cn(
                            "px-3 py-1 text-[8px] font-bold uppercase rounded-md transition-all",
                            newQuestReminderFreq === freq 
                              ? "bg-blue-600 text-white shadow-sm button-solid-white-text" 
                              : "text-slate-500 hover:text-slate-800"
                          )}
                        >
                          {freq}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 min-h-[40px] items-center">
                    {newQuestReminders.filter(t => t && t.includes(':') && formatTimeForDisplay(t) !== 'Invalid Time').map((time, idx) => (
                      <div 
                        key={idx} 
                        className={cn(
                          "relative flex items-center gap-2 border px-3 py-2.5 rounded-xl text-[11px] font-bold group animate-in zoom-in-95 duration-200 shadow-xl min-w-[85px] justify-center transition-all",
                          newQuestReminderFreq === 'once' && idx > 0 
                            ? "bg-gray-800/20 text-gray-600 border-gray-800 line-through" 
                            : "bg-blue-600/30 text-white border-blue-500/50 shadow-blue-900/10 hover:bg-blue-500/40"
                        )}
                        title={newQuestReminderFreq === 'once' && idx > 0 ? "Inactive: Frequency set to 'Once'" : ""}
                      >
                        <Clock size={12} className={cn(newQuestReminderFreq === 'once' && idx > 0 ? "text-gray-700" : "text-blue-300")} />
                        <span className="shrink-0 tracking-tight">{formatTimeForDisplay(time)}</span>
                        
                        <input 
                          type="time"
                          value={time}
                          onChange={(e) => {
                            if (e.target.value) {
                              const updated = [...newQuestReminders];
                              updated[idx] = e.target.value;
                              setNewQuestReminders([...new Set(updated.filter(t => t && t.includes(':')))].sort());
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                        />

                        <div className="flex items-center gap-1 ml-1 pl-2 border-l border-white/10 relative z-20">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setNewQuestReminders(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="bg-red-500/20 p-1.5 rounded-lg hover:bg-red-500/40 transition-colors text-red-200 flex items-center justify-center border border-red-500/20"
                          >
                            <X size={12} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {(newQuestReminderFreq === 'multiple' || newQuestReminders.filter(t => t && t.includes(':') && formatTimeForDisplay(t) !== 'Invalid Time').length === 0) && (
                      <div className="relative group min-w-[140px] h-[44px]">
                        <input 
                          type="time"
                          step="60"
                          onChange={(e) => {
                            if (e.target.value) {
                              const newTime = e.target.value;
                              setNewQuestReminders(prev => {
                                const exists = prev.some(t => t === newTime);
                                if (exists) return prev;
                                return [...prev, newTime].sort();
                              });
                              e.target.value = '';
                            }
                          }}
                          className="bg-gray-800/40 border-2 border-dashed border-gray-700 text-transparent rounded-xl px-4 py-2 text-[11px] font-bold focus:outline-none focus:border-blue-500/50 w-full hover:bg-gray-800/60 transition-all h-full cursor-pointer"
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-500 font-bold text-[10px] group-hover:text-blue-400 transition-colors uppercase tracking-widest gap-2">
                          <Plus size={14} className="text-blue-500" />
                          <span>Add Time</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {newQuestReminderFreq === 'once' && newQuestReminders.length > 1 && (
                    <p className="text-[9px] text-orange-400/80 font-medium">
                      * Only the earliest available reminder will trigger today in 'Once' mode.
                    </p>
                  )}
                  {newQuestReminderFreq === 'multiple' && (
                    <p className="text-[9px] text-blue-400/60 font-medium">
                      * Quest will trigger at every specified time until completed.
                    </p>
                  )}
                </div>
                <button 
                  disabled={!newQuestTitle || !manualQuestSkillId}
                  onClick={async () => {
                    if (editingQuest) {
                      const normalizedReward = newQuestTrackingMode === 'health' ? 0 : questBaseReward(newQuestDifficulty, {
                        repeatType: newQuestRepeatType,
                        isRepeatable: newQuestRepeatType !== 'none',
                      });
                      setGoals(prev => prev.map(g => g.id === editingQuest.id ? {
                        ...g,
                        title: newQuestTitle,
                        xpReward: normalizedReward,
                        difficulty: newQuestDifficulty,
                        trackingMode: newQuestTrackingMode,
                        targetValue: newQuestTarget,
                        unit: newQuestTrackingMode === 'timer' ? 'minutes' : newQuestUnit,
                        icon: newQuestIcon,
                        note: newQuestNote,
                        routineId: newQuestRoutineId || undefined,
                        repeatType: newQuestRepeatType,
                        repeatDays: newQuestRepeatType === 'weekly' ? newQuestRepeatDays : undefined,
                        isRepeatable: newQuestRepeatType !== 'none',
                        skillId: manualQuestSkillId,
                        reminderTimes: newQuestReminders,
                        reminderFrequency: newQuestReminderFreq
                      } : g));
                      setNotification({ title: "Success", message: "Quest updated!", xp: 0 });
                    } else {
                      const normalizedReward = newQuestTrackingMode === 'health' ? 0 : questBaseReward(newQuestDifficulty, {
                        repeatType: newQuestRepeatType,
                        isRepeatable: newQuestRepeatType !== 'none',
                      });
                      const newGoal: Goal = {
                        id: `quest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        skillId: manualQuestSkillId,
                        title: newQuestTitle,
                        completed: false,
                        xpReward: normalizedReward,
                        difficulty: newQuestDifficulty,
                        trackingMode: newQuestTrackingMode,
                        targetValue: newQuestTarget,
                        unit: newQuestTrackingMode === 'timer' ? 'minutes' : newQuestUnit,
                        icon: newQuestIcon,
                        note: newQuestNote,
                        routineId: newQuestRoutineId || undefined,
                        repeatType: newQuestRepeatType,
                        repeatDays: newQuestRepeatType === 'weekly' ? newQuestRepeatDays : undefined,
                        isRepeatable: newQuestRepeatType !== 'none',
                        reminderTimes: newQuestReminders.filter(t => t && t.includes(':')),
                        reminderFrequency: newQuestReminderFreq
                      };
                      setGoals(prev => [newGoal, ...prev]);
                      setNotification({ title: "Success", message: "New quest created!", xp: 0 });
                    }
                    setIsAddingQuest(false);
                    setEditingQuest(null);
                    setNewQuestTitle('');
                    setNewQuestXp(50);
                    setNewQuestDifficulty('easy');
                    setNewQuestTrackingMode('checkbox');
                    setNewQuestTarget(1);
                    setNewQuestUnit('times');
                    setNewQuestIcon('Target');
                    setNewQuestNote('');
                    setNewQuestRoutineId('');
                    setNewQuestRepeatType('none');
                    setNewQuestRepeatDays([]);
                    setManualQuestSkillId('');
                    setNewQuestReminders([]);
                    setNewQuestReminderFreq('once');
                  }}
                  className={cn(
                    "w-full py-4 font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4",
                    (!newQuestTitle || !manualQuestSkillId) 
                      ? "bg-gray-800 text-gray-500 cursor-not-allowed" 
                      : "bg-blue-600 text-white shadow-blue-600/20 active:scale-95"
                  )}
                >
                  {editingQuest ? <CheckCircle2 size={18} /> : <Plus size={18} />}
                  <span>{editingQuest ? 'SAVE CHANGES' : 'ADD QUEST'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    </div>
  );
}
