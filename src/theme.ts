export type ThemeId = 'claymorphic' | 'terminal';

export const THEME_STORAGE_KEY = 'lifequest_theme';

export const THEME_OPTIONS: Array<{
  id: ThemeId;
  name: string;
  description: string;
}> = [
  {
    id: 'claymorphic',
    name: 'Claymorphic',
    description: 'Soft surfaces, rounded cards, and tactile controls.',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    description: 'Monospace command-line interface inspired by the provided references.',
  },
];

export const getStoredTheme = (): ThemeId => {
  if (typeof window === 'undefined') return 'claymorphic';
  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'terminal'
    ? 'terminal'
    : 'claymorphic';
};

export const applyTheme = (theme: ThemeId) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === 'terminal' ? 'dark' : 'light';
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
};
