import { describe, expect, it, vi } from 'vitest';
import { db } from '../db/database';
import type { IngredientCategory } from '../db/types';
import {
  getCostAnalysis,
  restockIngredient,
  wasteIngredient,
} from './inventoryService';

// mock api 模組讓所有呼叫拋出錯誤，強制走 Dexie fallback
vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error('server unavailable')),
    post: vi.fn().mockRejectedValue(new Error('server unavailable')),
    put: vi.fn().mockRejectedValue(new Error('server unavailable')),
    del: vi.fn().mockRejectedValue(new Error('server unavailable')),
  },
}));

vi.mock('../api/sync', () => ({
  syncNow: vi.fn().mockResolvedValue(undefined),
}));

const NOW = new Date().toISOString();

// ── 輔助工具 ──────────────────────────────────────────────────

async function seedIngredientWithInventory(params: {
  id: number;
  name: string;
  currentStock: number;
  costPerUnit?: number;
  category?: IngredientCategory;
}) {
  await db.ingredients.put({
    id: params.id,
    name: params.name,
    unit: '克',
    costPerUnit: params.costPerUnit ?? 10,
    costPerServing: 0,
    lowStockThreshold: 5,
    // getCostAnalysis 以 .where('isActive').equals(1) 查詢（對應 SQLite 同步的 0/1）
    // fake-indexeddb 嚴格比對，須以數字 1 儲存以確保索引查到
    isActive: 1 as unknown as boolean,
    sortOrder: params.id,
    supplier: '',
    ingredientCategory: params.category ?? '其他',
    notes: '',
    createdAt: NOW,
    updatedAt: NOW,
  });

  await db.inventory.put({
    ingredientId: params.id,
    ingredientName: params.name,
    currentStock: params.currentStock,
    lowStockThreshold: 5,
    unit: '克',
    lastUpdated: NOW,
  });
}

// ── 測試: restockIngredient ───────────────────────────────────

describe('inventoryService.restockIngredient（Dexie fallback）', () => {
  it('進貨後 currentStock 應增加', async () => {
    await seedIngredientWithInventory({ id: 1, name: '麵粉', currentStock: 100 });

    await restockIngredient(1, 50, 1, '補貨');

    const record = await db.inventory.where('ingredientId').equals(1).first();
    expect(record?.currentStock).toBe(150);
  });

  it('進貨後 inventoryTransactions 應有一筆 restock 記錄', async () => {
    await seedIngredientWithInventory({ id: 2, name: '鹽', currentStock: 20 });

    await restockIngredient(2, 30, 1, '每週補貨');

    const txs = await db.inventoryTransactions
      .where('ingredientId')
      .equals(2)
      .toArray();

    expect(txs).toHaveLength(1);
    expect(txs[0].type).toBe('restock');
    expect(txs[0].quantity).toBe(30);
    expect(txs[0].previousStock).toBe(20);
    expect(txs[0].newStock).toBe(50);
  });

  it('進貨後 lastUpdated 應更新（ISO 字串比較）', async () => {
    await seedIngredientWithInventory({ id: 3, name: '糖', currentStock: 0 });

    const before = new Date().toISOString();
    await restockIngredient(3, 10, 1, '');
    const after = new Date().toISOString();

    const record = await db.inventory.where('ingredientId').equals(3).first();
    // ISO 字串字典序等同時間序
    expect(record?.lastUpdated >= before).toBe(true);
    expect(record?.lastUpdated <= after).toBe(true);
  });
});

// ── 測試: wasteIngredient ─────────────────────────────────────

describe('inventoryService.wasteIngredient（Dexie fallback）', () => {
  it('報廢後 currentStock 應減少', async () => {
    await seedIngredientWithInventory({ id: 4, name: '豬肉', currentStock: 200 });

    await wasteIngredient(4, 80, 1, '過期報廢');

    const record = await db.inventory.where('ingredientId').equals(4).first();
    expect(record?.currentStock).toBe(120);
  });

  it('報廢量超過庫存時，currentStock 不低於 0', async () => {
    await seedIngredientWithInventory({ id: 5, name: '雞肉', currentStock: 10 });

    await wasteIngredient(5, 50, 1, '大量報廢');

    const record = await db.inventory.where('ingredientId').equals(5).first();
    expect(record?.currentStock).toBe(0);
  });

  it('報廢後 inventoryTransactions 應有一筆 waste 記錄', async () => {
    await seedIngredientWithInventory({ id: 6, name: '牛奶', currentStock: 30 });

    await wasteIngredient(6, 10, 1, '過期');

    const txs = await db.inventoryTransactions
      .where('ingredientId')
      .equals(6)
      .toArray();

    expect(txs).toHaveLength(1);
    expect(txs[0].type).toBe('waste');
    expect(txs[0].quantity).toBe(-10); // 負值代表扣減
    expect(txs[0].previousStock).toBe(30);
    expect(txs[0].newStock).toBe(20);
  });
});

// ── 測試: getCostAnalysis ─────────────────────────────────────

describe('inventoryService.getCostAnalysis', () => {
  it('計算各分類的 totalCost = costPerUnit × currentStock 加總', async () => {
    // 蛋白質分類：3 個食材
    await seedIngredientWithInventory({ id: 10, name: '豬肉', currentStock: 10, costPerUnit: 50, category: '蛋白質' });
    await seedIngredientWithInventory({ id: 11, name: '雞肉', currentStock: 5, costPerUnit: 40, category: '蛋白質' });
    // 主食分類：1 個食材
    await seedIngredientWithInventory({ id: 12, name: '米飯', currentStock: 20, costPerUnit: 5, category: '主食' });

    const groups = await getCostAnalysis();

    const protein = groups.find((g) => g.category === '蛋白質');
    expect(protein).toBeDefined();
    // 10×50 + 5×40 = 500 + 200 = 700
    expect(protein?.totalCost).toBe(700);
    expect(protein?.itemCount).toBe(2);

    const staple = groups.find((g) => g.category === '主食');
    expect(staple).toBeDefined();
    // 20×5 = 100
    expect(staple?.totalCost).toBe(100);
    expect(staple?.itemCount).toBe(1);
  });

  it('結果應依 totalCost 由高到低排序', async () => {
    await seedIngredientWithInventory({ id: 20, name: '低成本食材', currentStock: 1, costPerUnit: 1, category: '其他' });
    await seedIngredientWithInventory({ id: 21, name: '高成本食材', currentStock: 100, costPerUnit: 100, category: '醬料' });

    const groups = await getCostAnalysis();

    expect(groups.length).toBeGreaterThanOrEqual(2);
    // 第一個 totalCost 應大於或等於第二個
    for (let i = 1; i < groups.length; i++) {
      expect(groups[i - 1].totalCost).toBeGreaterThanOrEqual(groups[i].totalCost);
    }
  });

  it('非 active 的食材不納入計算', async () => {
    // isActive = 0（停用），不應出現在結果中
    await db.ingredients.put({
      id: 30,
      name: '停用食材',
      unit: '克',
      costPerUnit: 999,
      costPerServing: 0,
      lowStockThreshold: 5,
      isActive: 0 as unknown as boolean, // 停用
      sortOrder: 30,
      supplier: '',
      ingredientCategory: '其他',
      notes: '',
      createdAt: NOW,
      updatedAt: NOW,
    });
    await db.inventory.put({
      ingredientId: 30,
      ingredientName: '停用食材',
      currentStock: 100,
      lowStockThreshold: 5,
      unit: '克',
      lastUpdated: NOW,
    });

    const groups = await getCostAnalysis();

    const allItems = groups.flatMap((g) => g.items);
    const found = allItems.find((item) => item.id === 30);
    expect(found).toBeUndefined();
  });
});
