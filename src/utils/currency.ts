import { DEFAULT_APP_SETTINGS } from '../services/settingsService';
import { useAppSettingsStore } from '../stores/useAppSettingsStore';

export function getCurrencySymbol(): string {
  return useAppSettingsStore.getState().settings.currency || DEFAULT_APP_SETTINGS.currency;
}

export function formatPrice(amount: number): string {
  return `${getCurrencySymbol()}${amount.toLocaleString()}`;
}

export function formatPriceShort(amount: number): string {
  return formatPrice(amount);
}

export function formatPriceDelta(amount: number): string {
  if (amount === 0) {
    return formatPrice(0);
  }

  const sign = amount > 0 ? '+' : '-';
  return `${sign}${formatPrice(Math.abs(amount))}`;
}
