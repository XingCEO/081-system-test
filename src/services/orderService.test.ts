import { format } from 'date-fns';
import { describe, expect, it, vi } from 'vitest';
import { db } from '../db/database';
import type { CartItem, Order } from '../db/types';
import {
  cancelOrder,
  createOrder,
  getNextOrderNumber,
  updateOrderStatus,
} from './orderService';
import { saveAppSettings } from './settingsService';

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

// ── 輔助工具 ──────────────────────────────────────────────────

function buildOrder(partial: Partial<Order>): Order {
  const now = new Date().toISOString();

  return {
    orderNumber: partial.orderNumber ?? 'TEMP-001',
    tableId: null,
    tableName: '外帶',
    status: 'completed',
    employeeId: 1,
    employeeName: '測試員工',
    subtotal: 100,
    discount: 0,
    total: 100,
    cashReceived: 100,
    changeGiven: 0,
    note: '',
    createdAt: partial.createdAt ?? now,
    completedAt: partial.completedAt ?? now,
  };
}

function buildCartItem(partial: Partial<CartItem> = {}): CartItem {
  return {
    cartItemId: crypto.randomUUID(),
    productId: partial.productId ?? 1,
    productName: partial.productName ?? '測試商品',
    unitPrice: partial.unitPrice ?? 100,
    quantity: partial.quantity ?? 1,
    modifiers: partial.modifiers ?? [],
    modifiersTotal: partial.modifiersTotal ?? 0,
    note: partial.note ?? '',
    isCombo: partial.isCombo ?? false,
    comboItems: partial.comboItems ?? [],
  };
}

// ── 測試: getNextOrderNumber ──────────────────────────────────

describe('orderService.getNextOrderNumber', () => {
  it('uses the saved prefix and increments based on today orders', async () => {
    await saveAppSettings({ orderNumberPrefix: 'POS' });

    const today = new Date();
    const todayIso = today.toISOString();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await db.orders.bulkAdd([
      buildOrder({ orderNumber: 'POS-OLD-001', createdAt: yesterday.toISOString() }),
      buildOrder({ orderNumber: 'POS-TODAY-001', createdAt: todayIso }),
      buildOrder({ orderNumber: 'POS-TODAY-002', createdAt: todayIso }),
    ]);

    await expect(getNextOrderNumber()).resolves.toBe(
      `POS-${format(today, 'yyyyMMdd')}-003`
    );
  });
});

// ── 測試: createOrder（Dexie fallback 路徑）──────────────────

describe('orderService.createOrder（Dexie fallback）', () => {
  it('建立訂單後 db.orders 應有記錄，且 status 為 pending', async () => {
    const items = [buildCartItem({ productId: 1, unitPrice: 150, quantity: 2 })];

    const order = await createOrder({
      items,
      employeeId: 1,
      employeeName: '測試員工',
      tableId: null,
      tableName: '外帶',
      discount: 0,
      cashReceived: 300,
      note: '',
    });

    expect(order.status).toBe('pending');
    expect(order.id).toBeDefined();

    const stored = await db.orders.get(order.id!);
    expect(stored).toBeDefined();
    expect(stored?.status).toBe('pending');
    expect(stored?.total).toBe(300);
  });

  it('db.orderItems 應有對應品項', async () => {
    const items = [
      buildCartItem({ productId: 1, productName: '炒飯', unitPrice: 80, quantity: 1 }),
      buildCartItem({ productId: 2, productName: '湯', unitPrice: 30, quantity: 2 }),
    ];

    const order = await createOrder({
      items,
      employeeId: 1,
      employeeName: '測試員工',
      tableId: null,
      tableName: '外帶',
      discount: 0,
      cashReceived: 200,
      note: '',
    });

    const orderItems = await db.orderItems
      .where('orderId')
      .equals(order.id!)
      .toArray();

    expect(orderItems).toHaveLength(2);
    const names = orderItems.map((i) => i.productName);
    expect(names).toContain('炒飯');
    expect(names).toContain('湯');
  });

  it('折扣應正確計算 total', async () => {
    const items = [buildCartItem({ unitPrice: 200, quantity: 1 })];

    const order = await createOrder({
      items,
      employeeId: 1,
      employeeName: '測試員工',
      tableId: null,
      tableName: '外帶',
      discount: 50,
      cashReceived: 200,
      note: '',
    });

    expect(order.subtotal).toBe(200);
    expect(order.total).toBe(150); // 200 - 50
  });
});

// ── 測試: cancelOrder（Dexie fallback 路徑）──────────────────

describe('orderService.cancelOrder（Dexie fallback）', () => {
  it('取消後 order status 應為 cancelled', async () => {
    // 先直接在 Dexie 建立一筆 pending 訂單
    const orderId = await db.orders.add(
      buildOrder({ status: 'pending', completedAt: '' })
    );

    await cancelOrder(orderId as number);

    const updated = await db.orders.get(orderId as number);
    expect(updated?.status).toBe('cancelled');
  });

  it('取消不存在的訂單不應拋出錯誤', async () => {
    await expect(cancelOrder(99999)).resolves.toBeUndefined();
  });
});

// ── 測試: updateOrderStatus（Dexie fallback 路徑）────────────

describe('orderService.updateOrderStatus（Dexie fallback）', () => {
  it('狀態更新應正確寫入 Dexie', async () => {
    const orderId = await db.orders.add(
      buildOrder({ status: 'pending', completedAt: '' })
    );

    await updateOrderStatus(orderId as number, 'preparing');

    const updated = await db.orders.get(orderId as number);
    expect(updated?.status).toBe('preparing');
  });

  it('狀態改為 completed 時應設定 completedAt', async () => {
    const orderId = await db.orders.add(
      buildOrder({ status: 'preparing', completedAt: '' })
    );

    await updateOrderStatus(orderId as number, 'completed');

    const updated = await db.orders.get(orderId as number);
    expect(updated?.status).toBe('completed');
    expect(updated?.completedAt).not.toBe('');
  });
});
