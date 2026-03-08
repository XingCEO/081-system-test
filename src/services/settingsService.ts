import { db } from '../db/database';
import type { AppSetting } from '../db/types';

export interface AppSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  receiptHeader: string;
  receiptFooter: string;
  currency: string;
  orderNumberPrefix: string;
  autoLogoutMinutes: number;
  lowStockDefaultThreshold: number;
  enableSound: boolean;
  themeColor: string;
  initialized: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  storeName: '美味餐廳',
  storeAddress: '台北市中山區中山北路100號',
  storePhone: '02-2345-6789',
  receiptHeader: '',
  receiptFooter: '謝謝光臨，歡迎再來！',
  currency: 'NT$',
  orderNumberPrefix: '',
  autoLogoutMinutes: 30,
  lowStockDefaultThreshold: 10,
  enableSound: true,
  themeColor: '#1e40af',
  initialized: true,
};

const APP_SETTING_KEYS = Object.keys(DEFAULT_APP_SETTINGS) as (keyof AppSettings)[];

function isAppSettingKey(key: string): key is keyof AppSettings {
  return APP_SETTING_KEYS.includes(key as keyof AppSettings);
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  const normalized =
    withHash.length === 4
      ? `#${withHash[1]}${withHash[1]}${withHash[2]}${withHash[2]}${withHash[3]}${withHash[3]}`
      : withHash;

  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : fallback;
}

function normalizeSettingsObject(
  values: Partial<Record<keyof AppSettings, unknown>>
): AppSettings {
  return {
    storeName: normalizeString(values.storeName, DEFAULT_APP_SETTINGS.storeName),
    storeAddress: normalizeString(values.storeAddress, DEFAULT_APP_SETTINGS.storeAddress),
    storePhone: normalizeString(values.storePhone, DEFAULT_APP_SETTINGS.storePhone),
    receiptHeader: normalizeString(values.receiptHeader, DEFAULT_APP_SETTINGS.receiptHeader),
    receiptFooter: normalizeString(values.receiptFooter, DEFAULT_APP_SETTINGS.receiptFooter),
    currency: normalizeString(values.currency, DEFAULT_APP_SETTINGS.currency),
    orderNumberPrefix: normalizeString(values.orderNumberPrefix, DEFAULT_APP_SETTINGS.orderNumberPrefix).trim(),
    autoLogoutMinutes: normalizeNumber(
      values.autoLogoutMinutes,
      DEFAULT_APP_SETTINGS.autoLogoutMinutes
    ),
    lowStockDefaultThreshold: normalizeNumber(
      values.lowStockDefaultThreshold,
      DEFAULT_APP_SETTINGS.lowStockDefaultThreshold
    ),
    enableSound: normalizeBoolean(values.enableSound, DEFAULT_APP_SETTINGS.enableSound),
    themeColor: normalizeHexColor(values.themeColor, DEFAULT_APP_SETTINGS.themeColor),
    initialized: normalizeBoolean(values.initialized, DEFAULT_APP_SETTINGS.initialized),
  };
}

export function normalizeAppSettings(records: AppSetting[]): AppSettings {
  const values: Partial<Record<keyof AppSettings, unknown>> = {};

  for (const record of records) {
    if (isAppSettingKey(record.key)) {
      values[record.key] = record.value;
    }
  }

  return normalizeSettingsObject(values);
}

export async function loadAppSettings(): Promise<AppSettings> {
  const records = await db.settings.toArray();
  return normalizeAppSettings(records);
}

export async function saveAppSettings(
  updates: Partial<AppSettings>
): Promise<AppSettings> {
  const current = await loadAppSettings();
  const next = normalizeSettingsObject({ ...current, ...updates });

  await db.transaction('rw', db.settings, async () => {
    for (const key of APP_SETTING_KEYS) {
      await db.settings.put({ key, value: next[key] });
    }
  });

  return next;
}

export async function getSettingValue<K extends keyof AppSettings>(
  key: K
): Promise<AppSettings[K]> {
  const record = await db.settings.get(key);
  return normalizeSettingsObject({
    [key]: record?.value,
  } as Partial<Record<keyof AppSettings, unknown>>)[key];
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hexColor: string): RgbColor {
  const normalized = normalizeHexColor(hexColor, DEFAULT_APP_SETTINGS.themeColor);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: RgbColor): string {
  return `#${[r, g, b]
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixColor(color: RgbColor, target: number, amount: number): RgbColor {
  return {
    r: color.r + (target - color.r) * amount,
    g: color.g + (target - color.g) * amount,
    b: color.b + (target - color.b) * amount,
  };
}

function rgba(color: RgbColor, alpha: number): string {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${alpha})`;
}

function getContrastColor(color: RgbColor): string {
  const luminance = (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
  return luminance > 0.62 ? '#0f172a' : '#ffffff';
}

export function applyThemeColor(themeColor: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  const base = hexToRgb(themeColor);
  const hover = rgbToHex(mixColor(base, 0, 0.08));
  const active = rgbToHex(mixColor(base, 0, 0.16));
  const gradientEnd = rgbToHex(mixColor(base, 0, 0.24));
  const root = document.documentElement;

  root.style.setProperty('--theme-primary', rgbToHex(base));
  root.style.setProperty('--theme-primary-hover', hover);
  root.style.setProperty('--theme-primary-active', active);
  root.style.setProperty('--theme-primary-gradient-end', gradientEnd);
  root.style.setProperty('--theme-primary-soft', rgba(base, 0.12));
  root.style.setProperty('--theme-primary-soft-strong', rgba(base, 0.18));
  root.style.setProperty('--theme-primary-ring', rgba(base, 0.32));
  root.style.setProperty('--theme-primary-contrast', getContrastColor(base));
}
