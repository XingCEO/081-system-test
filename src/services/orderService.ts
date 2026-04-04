import { endOfDay, startOfDay } from 'date-fns';
import { api } from '../api/client';
import { db } from '../db/database';
import type { CartItem, Order, OrderItem, OrderItemStatus, OrderStatus } from '../db/types';
import {
  getIngredientUsageForProduct,
  mergeIngredientUsages,
} from './bomService';
import type { IngredientUsage } from './bomService';

async function buildIngredientUsageForItems(
  items: Array<Pick<CartItem, 'productId' | 'quantity' | 'isCombo' | 'comboItems' | 'modifiers'>>
) {
  const usages: IngredientUsage[] = [];

  for (const item of items) {
    if (item.isCombo && item.comboItems?.length) {
      for (const comboItem of item.comboItems) {
        usages.push(
          ...(await getIngredientUsageForProduct(
            comboItem.productId,
            comboItem.quantity * item.quantity
          ))
        );
      }
      continue;
    }

    usages.push(...(await getIngredientUsageForProduct(item.productId, item.quantity)));

    // Include modifier recipe usages
    for (const mod of item.modifiers ?? []) {
      if (!mod.modifierId) continue;
      const modRecipes = await db.modifierRecipes
        .where('modifierId')
        .equals(mod.modifierId)
        .toArray();
      for (const recipe of modRecipes) {
        usages.push({
          ingredientId: recipe.ingredientId,
          ingredientName: recipe.ingredientName,
          quantity: recipe.quantity * item.quantity,
        });
      }
    }
  }

  return mergeIngredientUsages(usages);
}

export async function getNextOrderNumber(): Promise<string> {
  try {
    const result = await api.get<{ orderNumber: string }>('/orders/next-number');
    return result.orderNumber;
  } catch {
    // Fallback to Dexie
    const { format } = await import('date-fns');
    const now = new Date();
    const today = format(now, 'yyyyMMdd');
    const { getSettingValue } = await import('./settingsService');
    const prefix = await getSettingValue('orderNumberPrefix');
    const todaysOrders = await db.orders
      .where('createdAt')
      .between(startOfDay(now).toISOString(), endOfDay(now).toISOString(), true, true)
      .count();
    const seq = (todaysOrders + 1).toString().padStart(3, '0');
    return prefix ? `${prefix}-${today}-${seq}` : `${today}-${seq}`;
  }
}

export async function createOrder(params: {
  items: CartItem[];
  employeeId: number;
  employeeName: string;
  tableId: number | null;
  tableName: string;
  discount: number;
  cashReceived: number;
  note: string;
}): Promise<Order> {
  const orderNumber = await getNextOrderNumber();
  const subtotal = params.items.reduce(
    (sum, item) => sum + (item.unitPrice + item.modifiersTotal) * item.quantity,
    0
  );
  const total = subtotal - params.discount;
  const now = new Date().toISOString();

  const order: Order = {
    orderNumber,
    tableId: params.tableId,
    tableName: params.tableName || '外帶',
    status: 'pending',
    employeeId: params.employeeId,
    employeeName: params.employeeName,
    subtotal,
    discount: params.discount,
    total,
    cashReceived: params.cashReceived,
    changeGiven: params.cashReceived - total,
    note: params.note,
    createdAt: now,
    completedAt: '',
  };

  const orderItems: OrderItem[] = params.items.map((item) => ({
    orderId: 0, // Will be set by server
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    modifiers: item.modifiers,
    modifiersTotal: item.modifiersTotal,
    subtotal: (item.unitPrice + item.modifiersTotal) * item.quantity,
    note: item.note,
    itemStatus: 'pending' as OrderItemStatus,
    isCombo: item.isCombo,
    comboItems: item.comboItems,
  }));

  try {
    const result = await api.post<{ order: Order; items: OrderItem[] }>('/orders', { order, items: orderItems });
    // Inventory deduction is handled server-side in POST /api/orders.

    // Update Dexie locally for immediate reactivity — put BOTH order and items
    // so kitchen display has items immediately without waiting for next sync
    if (result.order.id) {
      await db.orders.put(result.order);
      if (result.items?.length) {
        await db.orderItems.bulkPut(result.items);
      }
      if (params.tableId) {
        await db.diningTables.where('id').equals(params.tableId).modify({
          status: 'occupied',
          currentOrderId: result.order.id,
        });
      }
    }

    return result.order;
  } catch {
    // Fallback to Dexie-only
    const orderId = await db.orders.add(order);

    const itemsWithOrderId = orderItems.map((item) => ({
      ...item,
      orderId: orderId as number,
    }));
    await db.orderItems.bulkAdd(itemsWithOrderId);

    const ingredientUsages = await buildIngredientUsageForItems(params.items);
    if (ingredientUsages.length > 0) {
      const { applyIngredientStockChange } = await import('./bomService');
      await applyIngredientStockChange({
        usages: ingredientUsages,
        employeeId: params.employeeId,
        note: `訂單 ${orderNumber}`,
        orderId: orderId as number,
        type: 'sale',
      });
    }

    if (params.tableId) {
      await db.diningTables.where('id').equals(params.tableId).modify({
        status: 'occupied',
        currentOrderId: orderId as number,
      });
    }

    return { ...order, id: orderId as number };
  }
}

export async function updateOrderStatus(orderId: number, status: OrderStatus): Promise<void> {
  try {
    await api.put(`/orders/${orderId}/status`, { status });

    // Update Dexie locally for immediate reactivity
    const updates: Partial<Order> = { status };
    if (status === 'completed') {
      updates.completedAt = new Date().toISOString();
    }
    await db.orders.update(orderId, updates);

    if (status === 'completed' || status === 'cancelled') {
      const order = await db.orders.get(orderId);
      if (order?.tableId) {
        await db.diningTables.where('id').equals(order.tableId).modify({
          status: 'cleaning',
          currentOrderId: null,
        });
      }
    }
  } catch {
    // Fallback to Dexie-only
    const updates: Partial<Order> = { status };
    if (status === 'completed') {
      updates.completedAt = new Date().toISOString();
    }
    await db.orders.update(orderId, updates);

    if (status === 'completed' || status === 'cancelled') {
      const order = await db.orders.get(orderId);
      if (order?.tableId) {
        await db.diningTables.where('id').equals(order.tableId).modify({
          status: 'cleaning',
          currentOrderId: null,
        });
      }
    }
  }
}

export async function getOrderWithItems(orderId: number) {
  try {
    const result = await api.get<{ order: Order; items: OrderItem[] }>(`/orders/${orderId}`);
    return result;
  } catch {
    // Fallback to Dexie
    const order = await db.orders.get(orderId);
    if (!order) {
      return null;
    }
    const items = await db.orderItems.where('orderId').equals(orderId).toArray();
    return { order, items };
  }
}

export async function getTodayOrders(): Promise<Order[]> {
  try {
    const orders = await api.get<Order[]>('/orders/today');
    return orders;
  } catch {
    // Fallback to Dexie
    const now = new Date();
    return db.orders
      .where('createdAt')
      .between(startOfDay(now).toISOString(), endOfDay(now).toISOString(), true, true)
      .reverse()
      .toArray();
  }
}

export async function cancelOrder(orderId: number): Promise<void> {
  try {
    await api.post(`/orders/${orderId}/cancel`);

    // Update Dexie locally for immediate reactivity
    await db.orders.update(orderId, {
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    });

    const order = await db.orders.get(orderId);
    if (order?.tableId) {
      await db.diningTables.where('id').equals(order.tableId).modify({
        status: 'cleaning',
        currentOrderId: null,
      });
    }
  } catch {
    // Fallback to Dexie-only
    const order = await db.orders.get(orderId);
    if (!order) {
      return;
    }

    const items = await db.orderItems.where('orderId').equals(orderId).toArray();
    const ingredientUsages = await buildIngredientUsageForItems(items);

    if (ingredientUsages.length > 0) {
      const { applyIngredientStockChange } = await import('./bomService');
      await applyIngredientStockChange({
        usages: ingredientUsages,
        employeeId: order.employeeId,
        note: `取消訂單 ${order.orderNumber}`,
        orderId,
        type: 'adjustment',
        restore: true,
      });
    }

    await updateOrderStatus(orderId, 'cancelled');
  }
}

export async function deleteOrder(orderId: number): Promise<void> {
  try {
    await api.del(`/orders/${orderId}`);

    // Clean up local Dexie after successful API call
    await db.orderItems.where('orderId').equals(orderId).delete();
    await db.orders.delete(orderId);
  } catch {
    // Fallback to Dexie-only
    const order = await db.orders.get(orderId);
    if (!order) return;

    if (order.status !== 'cancelled') {
      const items = await db.orderItems.where('orderId').equals(orderId).toArray();
      const ingredientUsages = await buildIngredientUsageForItems(items);
      if (ingredientUsages.length > 0) {
        const { applyIngredientStockChange } = await import('./bomService');
        await applyIngredientStockChange({
          usages: ingredientUsages,
          employeeId: order.employeeId,
          note: `刪除訂單 ${order.orderNumber}`,
          orderId,
          type: 'adjustment',
          restore: true,
        });
      }
    }

    if (order.tableId) {
      await db.diningTables.where('id').equals(order.tableId).modify({
        status: 'available',
        currentOrderId: null,
      });
    }

    // Clean up local Dexie in fallback path
    await db.orderItems.where('orderId').equals(orderId).delete();
    await db.orders.delete(orderId);
  }
}

export async function updateOrderWithItems(
  orderId: number,
  params: {
    items: OrderItem[];
    note: string;
    subtotal: number;
    total: number;
    discount: number;
    cashReceived: number;
    changeGiven: number;
  }
): Promise<{ order: Order; items: OrderItem[] }> {
  try {
    const result = await api.put<{ order: Order; items: OrderItem[] }>(`/orders/${orderId}`, {
      order: {
        subtotal: params.subtotal,
        discount: params.discount,
        total: params.total,
        cashReceived: params.cashReceived,
        changeGiven: params.changeGiven,
        note: params.note,
      },
      items: params.items,
    });

    // Update Dexie for immediate reactivity
    if (result.order) {
      await db.orders.put(result.order);
    }
    if (result.items) {
      // Remove old items and put new ones
      await db.orderItems.where('orderId').equals(orderId).delete();
      await db.orderItems.bulkPut(result.items);
    }

    return result;
  } catch {
    // Fallback to Dexie-only
    await db.orders.update(orderId, {
      subtotal: params.subtotal,
      discount: params.discount,
      total: params.total,
      cashReceived: params.cashReceived,
      changeGiven: params.changeGiven,
      note: params.note,
    });
    await db.orderItems.where('orderId').equals(orderId).delete();
    await db.orderItems.bulkAdd(params.items.map((item) => ({ ...item, orderId })));

    const order = await db.orders.get(orderId);
    const items = await db.orderItems.where('orderId').equals(orderId).toArray();
    return { order: order!, items };
  }
}

export async function updateOrderItemStatus(
  orderItemId: number,
  status: OrderItemStatus
): Promise<void> {
  try {
    await api.put(`/order-items/${orderItemId}/status`, { status });

    // Update Dexie locally for immediate reactivity
    await db.orderItems.update(orderItemId, { itemStatus: status });
  } catch {
    // Fallback to Dexie-only
    await db.orderItems.update(orderItemId, { itemStatus: status });
  }

  // Check if all items are completed to auto-update order status
  const item = await db.orderItems.get(orderItemId);
  if (!item) {
    return;
  }

  const allItems = await db.orderItems.where('orderId').equals(item.orderId).toArray();
  const allCompleted = allItems.every((orderItem) => orderItem.itemStatus === 'completed');
  const order = await db.orders.get(item.orderId);
  if (!order) {
    return;
  }

  if (allCompleted) {
    if (order.status === 'pending' || order.status === 'preparing') {
      await updateOrderStatus(item.orderId, 'ready');
    }
    return;
  }

  if (order.status === 'ready') {
    await updateOrderStatus(item.orderId, 'preparing');
  }
}
