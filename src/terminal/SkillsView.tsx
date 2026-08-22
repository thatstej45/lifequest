import { FormEvent, useState } from 'react';
import { Category, UserStats } from '../types';
import TerminalCommandPanel from './TerminalCommandPanel';
import { HabitIcon, IconPicker } from '../components/icons';

interface SkillsViewProps {
  userStats: UserStats;
  categories: Category[];
  onAddCategory: (name: string, icon: string, color: string) => void;
  onEditCategory: (id: string, name: string, icon: string, color: string) => void;
  onDeleteCategory: (id: string) => void;
  onAddSkill: (categoryId: string, name: string, description: string, xpReward: number, icon: string) => void;
  onEditSkill: (id: string, name: string, description: string, icon?: string) => void;
  onDeleteSkill: (id: string) => void;
  onUnlockSkill: (categoryId: string, skillId: string) => void;
}

interface CategoryDraft {
  id?: string;
  name: string;
  icon: string;
  color: string;
}

interface SkillDraft {
  id?: string;
  categoryId: string;
  name: string;
  description: string;
  xpReward: number;
  icon: string;
}

type DeleteTarget = { kind: 'category' | 'skill'; id: string; name: string };

const EMPTY_CATEGORY: CategoryDraft = { name: '', icon: 'Target', color: '#22c55e' };

export default function SkillsView({
  userStats,
  categories,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onAddSkill,
  onEditSkill,
  onDeleteSkill,
  onUnlockSkill,
}: SkillsViewProps) {
  const [expanded, setExpanded] = useState<string | null>(categories[0]?.id ?? null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [skillDraft, setSkillDraft] = useState<SkillDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DeleteTarget | null>(null);
  const [commandOutput, setCommandOutput] = useState('');

  const submitCategory = (event: FormEvent) => {
    event.preventDefault();
    if (!categoryDraft?.name.trim()) return;
    if (categoryDraft.id) {
      onEditCategory(categoryDraft.id, categoryDraft.name.trim(), categoryDraft.icon, categoryDraft.color);
    } else {
      onAddCategory(categoryDraft.name.trim(), categoryDraft.icon, categoryDraft.color);
    }
    setCommandOutput(`${categoryDraft.id ? 'updated' : 'created'} category "${categoryDraft.name.trim()}"`);
    setCategoryDraft(null);
  };

  const submitSkill = (event: FormEvent) => {
    event.preventDefault();
    if (!skillDraft?.name.trim()) return;
    if (skillDraft.id) {
      onEditSkill(skillDraft.id, skillDraft.name.trim(), skillDraft.description, skillDraft.icon);
    } else {
      onAddSkill(
        skillDraft.categoryId,
        skillDraft.name.trim(),
        skillDraft.description,
        skillDraft.xpReward,
        skillDraft.icon,
      );
    }
    setCommandOutput(`${skillDraft.id ? 'updated' : 'created'} skill "${skillDraft.name.trim()}"`);
    setSkillDraft(null);
  };

  const categoryPanel = (draft: CategoryDraft) => (
    <TerminalCommandPanel command={draft.id ? 'category --edit' : 'category --new'} onCancel={() => setCategoryDraft(null)}>
      <form className="term-form" onSubmit={submitCategory}>
        <label>name<input className="term-input" value={draft.name} autoFocus onChange={event => setCategoryDraft({ ...draft, name: event.target.value })} /></label>
        <IconPicker value={draft.icon} onChange={icon => setCategoryDraft({ ...draft, icon })} color={draft.color} label="Category icon" />
        <label>color<input className="term-color-input" type="color" value={draft.color} onChange={event => setCategoryDraft({ ...draft, color: event.target.value })} /></label>
        <div className="term-command-actions">
          <button type="button" className="term-token" onClick={() => setCategoryDraft(null)}>[cancel]</button>
          <button type="submit" className="term-token is-action">[save]</button>
        </div>
      </form>
    </TerminalCommandPanel>
  );

  const skillPanel = (draft: SkillDraft, color: string) => (
    <TerminalCommandPanel command={draft.id ? 'skill --edit' : 'skill --new'} onCancel={() => setSkillDraft(null)}>
      <form className="term-form" onSubmit={submitSkill}>
        <label>name<input className="term-input" value={draft.name} autoFocus onChange={event => setSkillDraft({ ...draft, name: event.target.value })} /></label>
        <label>description<textarea className="term-input term-textarea" value={draft.description} onChange={event => setSkillDraft({ ...draft, description: event.target.value })} /></label>
        <IconPicker value={draft.icon} onChange={icon => setSkillDraft({ ...draft, icon })} color={color} label="Skill icon" />
        {!draft.id && <p className="term-comment">{'// quests for this skill use their own difficulty-based rewards'}</p>}
        <div className="term-command-actions">
          <button type="button" className="term-token" onClick={() => setSkillDraft(null)}>[cancel]</button>
          <button type="submit" className="term-token is-action">[save]</button>
        </div>
      </form>
    </TerminalCommandPanel>
  );

  const deletePanel = (target: DeleteTarget) => (
    <TerminalCommandPanel command="confirm --delete" onCancel={() => setConfirmDelete(null)}>
      <p className="term-comment">{`// delete ${target.name}? linked quests will also be removed.`}</p>
      <div className="term-command-actions">
        <button type="button" className="term-token" onClick={() => setConfirmDelete(null)}>[cancel]</button>
        <button
          type="button"
          className="term-token is-danger"
          onClick={() => {
            if (target.kind === 'category') onDeleteCategory(target.id);
            else onDeleteSkill(target.id);
            setCommandOutput(`deleted ${target.kind} "${target.name}"`);
            setConfirmDelete(null);
          }}
        >
          [confirm delete]
        </button>
      </div>
    </TerminalCommandPanel>
  );

  return (
    <>
      <p className="term-prompt">
        <span className="term-prompt-user">{`${userStats.name || 'user'}[L${userStats.level}]@lifequest`}</span>
        <span className="term-prompt-symbol">$</span>
        <span className="term-prompt-cmd">skills --list</span>
      </p>
      <p className="term-comment">{`// ${categories.length} categories · ${userStats.skillPoints} skill points available`}</p>

      <div className="term-command-row">
        <button type="button" className="term-token is-action" onClick={() => setCategoryDraft(EMPTY_CATEGORY)}>
          [+ category]
        </button>
      </div>

      {categoryDraft && !categoryDraft.id && categoryPanel(categoryDraft)}

      {categories.map(category => {
        const isOpen = expanded === category.id;
        const unlocked = category.skills.filter(skill => skill.isUnlocked).length;
        return (
          <section className="term-group" key={category.id}>
            <div className="term-group-head">
              <button
                type="button"
                className="term-category-toggle"
                onClick={() => setExpanded(isOpen ? null : category.id)}
              >
                <span className="term-group-name" style={{ color: category.color }}>
                  <HabitIcon name={category.icon} size={14} aria-hidden /> {category.name}
                </span>
                <span className="term-group-count">{`[${unlocked}/${category.skills.length}] ${isOpen ? '▾' : '▸'}`}</span>
              </button>
              <span className="term-row-actions">
                <button
                  type="button"
                  className="term-token"
                  onClick={() => setCategoryDraft({
                    id: category.id,
                    name: category.name,
                    icon: category.icon,
                    color: category.color,
                  })}
                >
                  [edit]
                </button>
                <button
                  type="button"
                  className="term-token is-danger"
                  onClick={() => setConfirmDelete({ kind: 'category', id: category.id, name: category.name })}
                >
                  [del]
                </button>
              </span>
            </div>

            {categoryDraft?.id === category.id && categoryPanel(categoryDraft)}
            {confirmDelete?.kind === 'category' && confirmDelete.id === category.id && deletePanel(confirmDelete)}

            {isOpen && (
              <div className="term-skill-list">
                {category.skills.map(skill => {
                  const perks = (skill.perks ?? []).map(perk => `lvl ${perk.level}: ${perk.description}`).join(' · ');
                  return (
                    <div key={skill.id}>
                      <div className="term-skill-row is-dense">
                        <span className={skill.isUnlocked ? 'term-state-on' : 'term-state-off'}>
                          {skill.isUnlocked ? '[✓]' : '[×]'}
                        </span>
                        <span className="term-row-name" style={{ color: category.color }}>
                          <HabitIcon name={skill.icon ?? category.icon} size={13} aria-hidden /> {skill.name}
                        </span>
                        <span className="term-row-inline" title={[skill.description, perks].filter(Boolean).join(' · ')}>
                          {`// ${skill.description || 'no description'}${perks ? ` · ${perks}` : ''}`}
                        </span>
                        <span className="term-inline-meta">
                          {`lvl ${skill.level} · ${skill.xp}/${skill.maxXp}xp · ${Math.round((skill.xp / skill.maxXp) * 100)}%`}
                        </span>
                        <span className="term-row-actions">
                          {!skill.isUnlocked && (
                            <button
                              type="button"
                              className="term-token is-action"
                              disabled={userStats.skillPoints < skill.spCost}
                              onClick={() => onUnlockSkill(category.id, skill.id)}
                            >
                              {`[unlock ${skill.spCost}sp]`}
                            </button>
                          )}
                          <button
                            type="button"
                            className="term-token"
                            onClick={() => setSkillDraft({
                              id: skill.id,
                              categoryId: category.id,
                              name: skill.name,
                              description: skill.description,
                              xpReward: skill.xpReward,
                              icon: skill.icon ?? category.icon,
                            })}
                          >
                            [edit]
                          </button>
                          <button
                            type="button"
                            className="term-token is-danger"
                            onClick={() => setConfirmDelete({ kind: 'skill', id: skill.id, name: skill.name })}
                          >
                            [del]
                          </button>
                        </span>
                      </div>
                      {skillDraft?.id === skill.id && skillPanel(skillDraft, category.color)}
                      {confirmDelete?.kind === 'skill' && confirmDelete.id === skill.id && deletePanel(confirmDelete)}
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="term-token is-action term-add-row"
                  onClick={() => setSkillDraft({
                    categoryId: category.id,
                    name: '',
                    description: '',
                    xpReward: 10,
                    icon: category.icon,
                  })}
                >
                  [+ skill]
                </button>
                {skillDraft && !skillDraft.id && skillDraft.categoryId === category.id && skillPanel(skillDraft, category.color)}
              </div>
            )}
          </section>
        );
      })}

      {commandOutput && <p className="term-command-output"><b>&gt;</b> {commandOutput}</p>}
    </>
  );
}
