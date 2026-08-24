import { ChangeEvent, useEffect, useState } from 'react';
import { Goal, Routine, ScorecardRating, UserStats } from '../types';
import { THEME_OPTIONS, ThemeId } from '../theme';
import { ScorecardPanel } from '../components/HabitCoachingPanels';
import { trackingMode } from '../habits/habitDomain';
import { MENTOR_PERSONALITIES, normalizeMentorPersonality } from '../habits/mentorPersonality';
import type { NotificationBackend, NotificationPermissionState } from '../services/habitReminders';

interface ProfileViewProps {
  userStats: UserStats;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  onSaveIdentity: (name: string, title: string) => void;
  onSelectMentor: (mentor: NonNullable<UserStats['mentorPersonality']>) => void;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  onNotificationSound: (sound: string) => void;
  onEnableNotifications: () => void;
  notificationPermission: NotificationPermissionState;
  notificationBackend: NotificationBackend;
  onInstall: () => void;
  canInstall: boolean;
  onTestSound: () => void;
  onRefresh: () => void;
  routines: Routine[];
  goals: Goal[];
  onUpdateHabitSettings: (settings: Partial<UserStats>) => void;
  onRateScorecard: (goalId: string, rating: ScorecardRating | undefined) => void;
  onAddScorecardQuests: (created: Goal[]) => void;
}

const MENTORS = MENTOR_PERSONALITIES;

export default function ProfileView({
  userStats,
  theme,
  onThemeChange,
  onSaveIdentity,
  onSelectMentor,
  onExport,
  onImport,
  onReset,
  onNotificationSound,
  onEnableNotifications,
  notificationPermission,
  notificationBackend,
  onInstall,
  canInstall,
  onTestSound,
  onRefresh,
  routines,
  goals,
  onUpdateHabitSettings,
  onRateScorecard,
  onAddScorecardQuests,
}: ProfileViewProps) {
  const [name, setName] = useState(userStats.name ?? 'Player One');
  const [title, setTitle] = useState(userStats.title ?? 'Master of Life Skills');
  const [identityDraft, setIdentityDraft] = useState<[string, string, string]>(['', '', '']);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setName(userStats.name ?? 'Player One');
    setTitle(userStats.title ?? 'Master of Life Skills');
    setIdentityDraft([
      userStats.identityStatements?.[0] ?? '',
      userStats.identityStatements?.[1] ?? '',
      userStats.identityStatements?.[2] ?? '',
    ]);
  }, [userStats.name, userStats.title, userStats.identityStatements]);

  const dirty = name !== (userStats.name ?? '') || title !== (userStats.title ?? '') ||
    identityDraft.some((statement, index) => statement !== (userStats.identityStatements?.[index] ?? ''));

  return (
    <>
      <p className="term-prompt">
        <span className="term-prompt-user">{`${userStats.name || 'user'}[L${userStats.level}]@lifequest`}</span>
        <span className="term-prompt-symbol">$</span>
        <span className="term-prompt-cmd">profile</span>
      </p>

      <section className="term-section">
        <h2 className="term-section-title is-cyan">identity</h2>
        <div className="term-field">
          <label className="term-field-label" htmlFor="term-name">
            username
          </label>
          <input
            id="term-name"
            className="term-input"
            value={name}
            maxLength={18}
            onChange={event => setName(event.target.value)}
          />
          <span className="term-field-count">{`${name.length}/18`}</span>
        </div>
        <div className="term-field">
          <label className="term-field-label" htmlFor="term-title">
            title
          </label>
          <input
            id="term-title"
            className="term-input"
            value={title}
            maxLength={30}
            onChange={event => setTitle(event.target.value)}
          />
          <span className="term-field-count">{`${title.length}/30`}</span>
        </div>
        <button
          type="button"
          className="term-token is-action"
          disabled={!dirty}
          onClick={() => {
            onSaveIdentity(name.trim() || 'Player One', title.trim());
            onUpdateHabitSettings({
              identityStatements: identityDraft.map(statement => statement.trim()).filter(Boolean).slice(0, 3),
            });
          }}
        >
          [save]
        </button>
      </section>

      <section className="term-section">
        <h2 className="term-section-title is-purple">identity statements</h2>
        <p className="term-comment is-nested">{'// 1–3 statements your habits vote for'}</p>
        {[0, 1, 2].map(index => (
          <div className="term-field" key={index}>
            <label className="term-field-label" htmlFor={`term-identity-${index}`}>
              {`statement ${index + 1}`}
            </label>
            <input
              id={`term-identity-${index}`}
              className="term-input"
              maxLength={80}
              value={identityDraft[index]}
              onChange={event => {
                const next = [...identityDraft] as [string, string, string];
                next[index] = event.target.value;
                setIdentityDraft(next);
              }}
              placeholder="I am a person who…"
            />
          </div>
        ))}
      </section>

      <ScorecardPanel
        theme="terminal"
        goals={goals.filter(goal => trackingMode(goal) !== 'health')}
        identityStatements={userStats.identityStatements}
        onRate={onRateScorecard}
        onConvertMinus={onAddScorecardQuests}
        onReviewed={() => onUpdateHabitSettings({ scorecardReviewedAt: new Date().toISOString() })}
      />

      <section className="term-section">
        <h2 className="term-section-title is-good">daily goal & shields</h2>
        <p className="term-comment is-nested">{`// ${goals.length} habits · ${routines.length} routines · ${userStats.streakShields ?? 0}/3 shields`}</p>
        <div className="term-field">
          <label className="term-field-label" htmlFor="term-daily-target">daily threshold</label>
          <input
            id="term-daily-target"
            className="term-input"
            type="number"
            min="10"
            max="100"
            step="5"
            value={userStats.dailyGoalTarget ?? 60}
            onChange={event => onUpdateHabitSettings({ dailyGoalTarget: Math.min(100, Math.max(10, Number(event.target.value))) })}
          />
          <span className="term-field-count">%</span>
        </div>
        <p className="term-comment is-nested">{`// complete 5 daily goals to earn a shield · progress ${userStats.shieldProgress ?? 0}/5`}</p>
        <div className="term-window-row">
          {(['none', 'vacation', 'sick'] as const).map(mode => (
            <button type="button" key={mode} className={`term-token${(userStats.pauseMode ?? 'none') === mode ? ' is-active' : ''}`} onClick={() => onUpdateHabitSettings({ pauseMode: mode })}>
              {`[${mode}]`}
            </button>
          ))}
        </div>
        <p className="term-comment is-nested">{'// vacation and sick modes pause streak loss and daily-goal scoring'}</p>
      </section>

      <section className="term-section">
        <h2 className="term-section-title is-purple">appearance density</h2>
        <div className="term-window-row">
          {(['compact', 'cozy', 'relaxed'] as const).map(density => (
            <button type="button" key={density} className={`term-token${(userStats.appearanceDensity ?? 'cozy') === density ? ' is-active' : ''}`} onClick={() => onUpdateHabitSettings({ appearanceDensity: density })}>
              {`[${density}]`}
            </button>
          ))}
        </div>
      </section>

      <section className="term-section">
        <h2 className="term-section-title is-blue">native integrations</h2>
        {[
          ['apple health / health connect', 'not connected'],
          ['icloud sync', 'export/import only'],
        ].map(([name, status]) => (
          <p className="term-stat-line" key={name}>
            <span className="term-stat-label">{name}</span>
            <span className="term-stat-value is-amber">{status}</span>
          </p>
        ))}
      </section>

      <section className="term-section">
        <h2 className="term-section-title is-purple">themes</h2>
        {THEME_OPTIONS.map(option => (
          <button
            key={option.id}
            type="button"
            className={`term-option${theme === option.id ? ' is-active' : ''}`}
            onClick={() => onThemeChange(option.id)}
            aria-pressed={theme === option.id}
          >
            <span className="term-option-mark">{theme === option.id ? '[✓]' : '[ ]'}</span>
            <span className="term-option-body">
              <span className="term-option-name">{option.name.toLowerCase()}</span>
              <span className="term-comment is-nested">{`// ${option.description.toLowerCase()}`}</span>
            </span>
          </button>
        ))}
      </section>

      <section className="term-section">
        <h2 className="term-section-title is-blue">mentor</h2>
        <p className="term-comment is-nested">{'// tone used for AI guidance and nudges'}</p>
        <div className="term-window-row">
          {MENTORS.map(mentor => (
            <button
              key={mentor}
              type="button"
              className={`term-token${
                normalizeMentorPersonality(userStats.mentorPersonality) === mentor ? ' is-active' : ''
              }`}
              onClick={() => onSelectMentor(mentor)}
            >
              {`[${mentor.toLowerCase()}]`}
            </button>
          ))}
        </div>
      </section>

      <section className="term-section">
        <h2 className="term-section-title is-amber">system notifications</h2>
        <div className="term-window-row">
          {[
            { id: 'bling', label: 'bling' },
            { id: 'minimal', label: 'subtle' },
            { id: 'crystal', label: 'crystal' },
          ].map(sound => (
            <button
              key={sound.id}
              type="button"
              className={`term-token${(userStats.notificationSound ?? 'bling') === sound.id ? ' is-active' : ''}`}
              onClick={() => onNotificationSound(sound.id)}
            >
              {`[${sound.label}]`}
            </button>
          ))}
          <button type="button" className="term-token is-action" onClick={onTestSound}>[test sound]</button>
        </div>
        {notificationBackend === 'none' ? (
          <p className="term-comment is-nested">{'// notifications are not supported in this environment'}</p>
        ) : (
          <>
            <p className="term-comment is-nested">{`// backend: ${notificationBackend} · permission: ${notificationPermission}`}</p>
            {notificationPermission === 'default' && (
              <button type="button" className="term-token is-action term-nested-action" onClick={onEnableNotifications}>
                [enable notifications]
              </button>
            )}
            {notificationPermission === 'denied' && (
              <p className="term-comment is-nested">{`// blocked — enable in ${notificationBackend === 'native' ? 'android settings' : 'browser settings'}`}</p>
            )}
          </>
        )}
        <p className="term-comment is-nested">{'// unfinished habits remind you at their set times'}</p>
      </section>

      <section className="term-section">
        <h2 className="term-section-title is-cyan">app installation</h2>
        <div className="term-copy-row">
          <input className="term-input" readOnly value={window.location.origin} onFocus={event => event.target.select()} />
          <button
            type="button"
            className="term-token is-action"
            onClick={async () => {
              await navigator.clipboard.writeText(window.location.origin);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? '[copied]' : '[copy url]'}
          </button>
        </div>
        {canInstall ? (
          <button type="button" className="term-token is-action term-nested-action" onClick={onInstall}>[install app]</button>
        ) : (
          <div className="term-install-notes">
            <p><span className="term-state-on">ios/safari</span> // share → add to home screen</p>
            <p><span className="term-state-on">android/chrome</span> // menu → install app</p>
          </div>
        )}
      </section>

      <section className="term-section">
        <h2 className="term-section-title is-red">data management</h2>
        <p className="term-comment is-nested">{'// local-first. everything stays on this device'}</p>
        <div className="term-window-row">
          <button type="button" className="term-token is-action" onClick={onRefresh}>
            [refresh/update]
          </button>
          <button type="button" className="term-token is-action" onClick={onExport}>
            [export]
          </button>
          <label className="term-token is-action">
            [import]
            <input type="file" accept=".json" className="term-file" onChange={onImport} />
          </label>
          <button type="button" className="term-token is-danger" onClick={onReset}>
            [reset]
          </button>
        </div>
      </section>

      <p className="term-comment">{'// lifequest v1.0.4'}</p>
    </>
  );
}
