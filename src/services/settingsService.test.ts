import { describe, expect, it } from 'vitest';
import { db } from '../db/database';
import {
  DEFAULT_APP_SETTINGS,
  getSettingValue,
  loadAppSettings,
  saveAppSettings,
} from './settingsService';

describe('settingsService', () => {
  it('returns defaults when the settings table is empty', async () => {
    await db.settings.clear();

    await expect(loadAppSettings()).resolves.toEqual(DEFAULT_APP_SETTINGS);
    await expect(getSettingValue('currency')).resolves.toBe(DEFAULT_APP_SETTINGS.currency);
  });

  it('normalizes and persists saved settings', async () => {
    const settings = await saveAppSettings({
      orderNumberPrefix: ' POS ',
      themeColor: '#abc',
      autoLogoutMinutes: 45,
      enableSound: false,
    });

    expect(settings.orderNumberPrefix).toBe('POS');
    expect(settings.themeColor).toBe('#aabbcc');
    expect(settings.autoLogoutMinutes).toBe(45);
    expect(settings.enableSound).toBe(false);

    const stored = await loadAppSettings();
    expect(stored).toMatchObject(settings);
    expect(await db.settings.count()).toBe(Object.keys(DEFAULT_APP_SETTINGS).length);
  });
});
