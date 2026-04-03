import { describe, expect, it } from 'vitest';
import {
  buildPurchaseSuggestions,
  formatPurchaseListText,
  summarizePurchaseSuggestions,
} from './inventory';

describe('inventory purchase suggestions', () => {
  const rows = [
    {
      ingredientId: 1,
      ingredientName: '牛肉',
      currentStock: 0,
      lowStockThreshold: 5,
      unit: '公斤',
      costPerUnit: 260,
    },
    {
      ingredientId: 2,
      ingredientName: '青蔥',
      currentStock: 3,
      lowStockThreshold: 6,
      unit: '把',
      costPerUnit: 18,
    },
    {
      ingredientId: 3,
      ingredientName: '白飯',
      currentStock: 20,
      lowStockThreshold: 10,
      unit: '份',
      costPerUnit: 8,
    },
  ];

  it('builds purchase suggestions for low-stock ingredients only', () => {
    const suggestions = buildPurchaseSuggestions(rows);

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toMatchObject({
      ingredientName: '牛肉',
      status: 'out',
      recommendedTargetStock: 10,
      recommendedOrderQuantity: 10,
      shortage: 5,
      estimatedCost: 2600,
    });
    expect(suggestions[1]).toMatchObject({
      ingredientName: '青蔥',
      status: 'low',
      recommendedTargetStock: 12,
      recommendedOrderQuantity: 9,
      shortage: 3,
      estimatedCost: 162,
    });
  });

  it('summarizes low-stock and out-of-stock counts', () => {
    const summary = summarizePurchaseSuggestions(buildPurchaseSuggestions(rows));

    expect(summary).toEqual({
      outOfStockCount: 1,
      lowStockCount: 1,
      totalSuggestedQuantity: 19,
      totalEstimatedCost: 2762,
    });
  });

  it('formats a readable purchase list', () => {
    const text = formatPurchaseListText({
      storeName: '測試餐廳',
      currency: 'NT$',
      suggestions: buildPurchaseSuggestions(rows),
      createdAt: new Date('2026-03-08T10:00:00+08:00'),
    });

    expect(text).toContain('測試餐廳 低庫存採購清單');
    expect(text).toContain('1. 牛肉');
    expect(text).toContain('建議補貨：10 公斤');
    expect(text).toContain('預估採購成本：NT$2,762');
  });
});
