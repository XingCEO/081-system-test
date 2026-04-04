import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/database';
import {
  getIngredientUsageForProduct,
  getProductAvailabilityMap,
  mergeIngredientUsages,
} from './bomService';

// mock api 模組，讓所有呼叫都拋出錯誤，強制走 Dexie fallback
vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error('server unavailable')),
    post: vi.fn().mockRejectedValue(new Error('server unavailable')),
    put: vi.fn().mockRejectedValue(new Error('server unavailable')),
    del: vi.fn().mockRejectedValue(new Error('server unavailable')),
  },
}));

// mock syncNow 避免呼叫真實 fetch
vi.mock('../api/sync', () => ({
  syncNow: vi.fn().mockResolvedValue(undefined),
}));

const NOW = new Date().toISOString();

async function seedIngredientWithInventory(params: {
  id: number;
  name: string;
  currentStock: number;
  costPerUnit?: number;
}) {
  await db.ingredients.put({
    id: params.id,
    name: params.name,
    unit: '克',
    costPerUnit: params.costPerUnit ?? 1,
    costPerServing: 0,
    lowStockThreshold: 5,
    isActive: true,
    sortOrder: params.id,
    supplier: '',
    ingredientCategory: '其他',
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

async function seedProduct(params: {
  id: number;
  name: string;
  trackInventory: boolean;
}) {
  await db.products.put({
    id: params.id,
    categoryId: 1,
    name: params.name,
    description: '',
    price: 100,
    imageUrl: '',
    isActive: true,
    modifierGroupIds: [],
    trackInventory: params.trackInventory,
    sortOrder: params.id,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

beforeEach(async () => {
  // setup.ts 已在每次測試前刪除並重開 db，這裡只補充本模組需要的 seed
});

describe('mergeIngredientUsages', () => {
  it('相同 ingredientId 的用量應合併加總', () => {
    const usages = [
      { ingredientId: 1, ingredientName: '麵粉', quantity: 50 },
      { ingredientId: 2, ingredientName: '蛋', quantity: 1 },
      { ingredientId: 1, ingredientName: '麵粉', quantity: 30 },
    ];

    const merged = mergeIngredientUsages(usages);

    expect(merged).toHaveLength(2);
    const flour = merged.find((u) => u.ingredientId === 1);
    expect(flour?.quantity).toBe(80);
    const egg = merged.find((u) => u.ingredientId === 2);
    expect(egg?.quantity).toBe(1);
  });

  it('空陣列應回傳空陣列', () => {
    expect(mergeIngredientUsages([])).toEqual([]);
  });

  it('不同 ingredientId 各自獨立', () => {
    const usages = [
      { ingredientId: 10, ingredientName: 'A', quantity: 5 },
      { ingredientId: 20, ingredientName: 'B', quantity: 3 },
    ];
    const merged = mergeIngredientUsages(usages);
    expect(merged).toHaveLength(2);
  });
});

describe('getIngredientUsageForProduct', () => {
  it('從 Dexie productRecipes 查食材用量並乘以 multiplier（fallback 路徑）', async () => {
    await db.productRecipes.bulkAdd([
      { productId: 1, ingredientId: 10, ingredientName: '豬肉', quantity: 100 },
      { productId: 1, ingredientId: 11, ingredientName: '醬油', quantity: 20 },
    ]);

    const usages = await getIngredientUsageForProduct(1, 2);

    expect(usages).toHaveLength(2);
    const pork = usages.find((u) => u.ingredientId === 10);
    expect(pork?.quantity).toBe(200); // 100 × 2
    const sauce = usages.find((u) => u.ingredientId === 11);
    expect(sauce?.quantity).toBe(40); // 20 × 2
  });

  it('multiplier 預設為 1', async () => {
    await db.productRecipes.add({
      productId: 2,
      ingredientId: 10,
      ingredientName: '豬肉',
      quantity: 50,
    });

    const usages = await getIngredientUsageForProduct(2);
    expect(usages[0].quantity).toBe(50);
  });

  it('無食譜時回傳空陣列', async () => {
    const usages = await getIngredientUsageForProduct(999);
    expect(usages).toEqual([]);
  });
});

describe('getProductAvailabilityMap（Dexie fallback 路徑）', () => {
  it('有庫存追蹤的商品，根據食材庫存計算可售量', async () => {
    // 食材：豬肉庫存 300 克
    await seedIngredientWithInventory({ id: 1, name: '豬肉', currentStock: 300 });
    // 商品：追蹤庫存
    await seedProduct({ id: 1, name: '豬排飯', trackInventory: true });
    // 食譜：每份需要 100 克豬肉
    await db.productRecipes.add({
      productId: 1,
      ingredientId: 1,
      ingredientName: '豬肉',
      quantity: 100,
    });

    const map = await getProductAvailabilityMap();

    const avail = map.get(1);
    expect(avail).toBeDefined();
    // 300 / 100 = 3 份
    expect(avail?.availableQuantity).toBe(3);
    expect(avail?.isSoldOut).toBe(false);
  });

  it('食材庫存為 0 時標記 isSoldOut', async () => {
    await seedIngredientWithInventory({ id: 2, name: '雞肉', currentStock: 0 });
    await seedProduct({ id: 2, name: '雞腿飯', trackInventory: true });
    await db.productRecipes.add({
      productId: 2,
      ingredientId: 2,
      ingredientName: '雞肉',
      quantity: 150,
    });

    const map = await getProductAvailabilityMap();

    const avail = map.get(2);
    expect(avail?.availableQuantity).toBe(0);
    expect(avail?.isSoldOut).toBe(true);
  });

  it('無庫存追蹤的商品在 map 中 availableQuantity 為 null、isSoldOut 為 false', async () => {
    await seedProduct({ id: 3, name: '飲料', trackInventory: false });

    const map = await getProductAvailabilityMap();

    const avail = map.get(3);
    expect(avail).toBeDefined();
    expect(avail?.availableQuantity).toBeNull();
    expect(avail?.isSoldOut).toBe(false);
  });

  it('庫存充足但低於閾值時標記 isLowStock', async () => {
    // currentStock = 3，低於 lowStockThreshold = 5
    await seedIngredientWithInventory({ id: 4, name: '牛肉', currentStock: 3 });
    await db.inventory.where('ingredientId').equals(4).modify({ lowStockThreshold: 5 });
    await seedProduct({ id: 4, name: '牛肉飯', trackInventory: true });
    await db.productRecipes.add({
      productId: 4,
      ingredientId: 4,
      ingredientName: '牛肉',
      quantity: 1,
    });

    const map = await getProductAvailabilityMap();

    const avail = map.get(4);
    // availableQuantity = 3，介於 0 與 5 之間 → isLowStock
    expect(avail?.availableQuantity).toBe(3);
    expect(avail?.isLowStock).toBe(true);
    expect(avail?.isSoldOut).toBe(false);
  });
});
