import { create } from 'zustand';
import {
  DEFAULT_APP_SETTINGS,
  applyThemeColor,
  loadAppSettings,
  saveAppSettings,
  type AppSettings,
} from '../services/settingsService';

interface AppSettingsState {
  settings: AppSettings;
  hydrated: boolean;
  loadSettings: () => Promise<void>;
  saveSettings: (updates: Partial<AppSettings>) => Promise<void>;
  setSettings: (settings: AppSettings) => void;
}

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  settings: DEFAULT_APP_SETTINGS,
  hydrated: false,
  loadSettings: async () => {
    const settings = await loadAppSettings();
    applyThemeColor(settings.themeColor);
    set({ settings, hydrated: true });
  },
  saveSettings: async (updates) => {
    const settings = await saveAppSettings(updates);
    applyThemeColor(settings.themeColor);
    set({ settings, hydrated: true });
  },
  setSettings: (settings) => {
    applyThemeColor(settings.themeColor);
    set({ settings, hydrated: true });
  },
}));

applyThemeColor(DEFAULT_APP_SETTINGS.themeColor);
