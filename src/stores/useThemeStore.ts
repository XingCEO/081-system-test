import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  _v: number;
  setTheme: (theme: Theme) => void;
}

const THEME_VERSION = 2;

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      _v: THEME_VERSION,
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: 'pos-theme',
      onRehydrateStorage: () => (state) => {
        if (!state || state._v !== THEME_VERSION) {
          // Force reset to light on version mismatch (old dark default)
          useThemeStore.setState({ theme: 'light', _v: THEME_VERSION });
          applyTheme('light');
        } else {
          applyTheme(state.theme);
        }
      },
    }
  )
);

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const { theme } = useThemeStore.getState();
  if (theme === 'system') applyTheme('system');
});

// Apply on load
applyTheme(useThemeStore.getState().theme);
