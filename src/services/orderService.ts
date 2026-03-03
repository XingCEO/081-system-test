import { db } from '../db/database';
import type { CartItem, Order, OrderItem, OrderStatus, OrderItemStatus } from '../db/types';
import { format } from 'date-fns';

export async function getNextOrderNumber(): Promise<string> {
  const today = format(new Date(), 'yyyyMMdd');
  const todaysOrders = await db.orders
    .where('orderNumber')
    .startsWith(today)
    .count();
  const seq = (todaysOrders + 1).toString().padStart(3, '0');
  return `${today}-${seq}`;
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

  const orderId = await db.orders.add(order);

  const orderItems: OrderItem[] = params.items.map((item) => ({
    orderId: orderId as number,
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

  await db.orderItems.bulkAdd(orderItems);

  // Deduct inventory
  for (const item of params.items) {
    if (item.isCombo && item.comboItems?.length) {
      // Combo: deduct inventory for each sub-product
      for (const sub of item.comboItems) {
        const inv = await db.inventory.where('productId').equals(sub.productId).first();
        if (inv && inv.id) {
          const deductQty = sub.quantity * item.quantity;
          const newStock = Math.max(0, inv.currentStock - deductQty);
          await db.inventory.update(inv.id, { currentStock: newStock, lastUpdated: now });
          await db.inventoryTransactions.add({
            productId: sub.productId,
            productName: sub.productName,
            type: 'sale',
            quantity: -deductQty,
            previousStock: inv.currentStock,
            newStock,
            orderId: orderId as number,
            note: `訂單 ${orderNumber} (套餐)`,
            employeeId: params.employeeId,
            createdAt: now,
          });
        }
      }
    } else {
      const inv = await db.inventory.where('productId').equals(item.productId).first();
      if (inv && inv.id) {
        const newStock = Math.max(0, inv.currentStock - item.quantity);
        await db.inventory.update(inv.id, {
          currentStock: newStock,
          lastUpdated: now,
        });
        await db.inventoryTransactions.add({
          productId: item.productId,
          productName: item.productName,
          type: 'sale',
          quantity: -item.quantity,
          previousStock: inv.currentStock,
          newStock,
          orderId: orderId as number,
          note: `訂單 ${orderNumber}`,
          employeeId: params.employeeId,
          createdAt: now,
        });
      }
    }
  }

  // Update table status
  if (params.tableId) {
    await db.diningTables.where('id').equals(params.tableId).modify({
      status: 'occupied',
      currentOrderId: orderId as number,
    });
  }

  return { ...order, id: orderId as number };
}

export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus
): Promise<void> {
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

export async function getOrderWithItems(orderId: number) {
  const order = await db.orders.get(orderId);
  if (!order) return null;
  const items = await db.orderItems.where('orderId').equals(orderId).toArray();
  return { order, items };
}

export async function getTodayOrders(): Promise<Order[]> {
  const today = format(new Date(), 'yyyyMMdd');
  return db.orders
    .where('orderNumber')
    .startsWith(today)
    .reverse()
    .toArray();
}

export async function cancelOrder(orderId: number): Promise<void> {
  const order = await db.orders.get(orderId);
  if (!order) return;

  // Restore inventory
  const items = await db.orderItems.where('orderId').equals(orderId).toArray();
  const now = new Date().toISOString();
  for (const item of items) {
    if (item.isCombo && item.comboItems?.length) {
      for (const sub of item.comboItems) {
        const inv = await db.inventory.where('productId').equals(sub.productId).first();
        if (inv && inv.id) {
          const restoreQty = sub.quantity * item.quantity;
          const newStock = inv.currentStock + restoreQty;
          await db.inventory.update(inv.id, { currentStock: newStock, lastUpdated: now });
          await db.inventoryTransactions.add({
            productId: sub.productId,
            productName: sub.productName,
            type: 'adjustment',
            quantity: restoreQty,
            previousStock: inv.currentStock,
            newStock,
            orderId,
            note: `取消訂單 ${order.orderNumber} (套餐)`,
            employeeId: order.employeeId,
            createdAt: now,
          });
        }
      }
    } else {
      const inv = await db.inventory.where('productId').equals(item.productId).first();
      if (inv && inv.id) {
        const newStock = inv.currentStock + item.quantity;
        await db.inventory.update(inv.id, {
          currentStock: newStock,
          lastUpdated: now,
        });
        await db.inventoryTransactions.add({
          productId: item.productId,
          productName: item.productName,
          type: 'adjustment',
          quantity: item.quantity,
          previousStock: inv.currentStock,
          newStock,
          orderId,
          note: `取消訂單 ${order.orderNumber}`,
          employeeId: order.employeeId,
          createdAt: now,
        });
      }
    }
  }

  await updateOrderStatus(orderId, 'cancelled');
}

export async function updateOrderItemStatus(
  orderItemId: number,
  status: OrderItemStatus
): Promise<void> {
  await db.orderItems.update(orderItemId, { itemStatus: status });

  // Auto-advance: if ALL items in the order are completed, set order to 'ready'
  const item = await db.orderItems.get(orderItemId);
  if (!item) return;

  const allItems = await db.orderItems.where('orderId').equals(item.orderId).toArray();
  const allCompleted = allItems.every((i) => i.itemStatus === 'completed');

  if (allCompleted) {
    const order = await db.orders.get(item.orderId);
    if (order && (order.status === 'pending' || order.status === 'preparing')) {
      await updateOrderStatus(item.orderId, 'ready');
    }
  }
}
