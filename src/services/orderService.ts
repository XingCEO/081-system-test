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
  items: Array<Pick<CartItem, 'productId' | 'quantity' | 'isCombo' | 'comboItems'>>
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
    const result = await api.post<Order>('/orders', { order, items: orderItems });
    // Inventory deduction is handled server-side in POST /api/orders.

    // Update Dexie locally for immediate reactivity
    if (result.id) {
      await db.orders.put(result);
      await db.orderItems.bulkPut(
        orderItems.map((item) => ({
          ...item,
          orderId: result.id!,
        }))
      );
      if (params.tableId) {
        await db.diningTables.where('id').equals(params.tableId).modify({
          status: 'occupied',
          currentOrderId: result.id,
        });
      }
    }

    return result;
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
