import { db } from '../db/database';
import type { InventoryRecord } from '../db/types';

export async function restockProduct(
  productId: number,
  quantity: number,
  employeeId: number,
  note: string
): Promise<void> {
  const inv = await db.inventory.where('productId').equals(productId).first();
  if (!inv || !inv.id) return;

  const newStock = inv.currentStock + quantity;
  const now = new Date().toISOString();

  await db.inventory.update(inv.id, {
    currentStock: newStock,
    lastUpdated: now,
  });

  await db.inventoryTransactions.add({
    productId,
    productName: inv.productName,
    type: 'restock',
    quantity,
    previousStock: inv.currentStock,
    newStock,
    orderId: null,
    note,
    employeeId,
    createdAt: now,
  });
}

export async function adjustStock(
  productId: number,
  newQuantity: number,
  employeeId: number,
  note: string
): Promise<void> {
  const inv = await db.inventory.where('productId').equals(productId).first();
  if (!inv || !inv.id) return;

  const diff = newQuantity - inv.currentStock;
  const now = new Date().toISOString();

  await db.inventory.update(inv.id, {
    currentStock: newQuantity,
    lastUpdated: now,
  });

  await db.inventoryTransactions.add({
    productId,
    productName: inv.productName,
    type: 'adjustment',
    quantity: diff,
    previousStock: inv.currentStock,
    newStock: newQuantity,
    orderId: null,
    note,
    employeeId,
    createdAt: now,
  });
}

export async function wasteProduct(
  productId: number,
  quantity: number,
  employeeId: number,
  note: string
): Promise<void> {
  const inv = await db.inventory.where('productId').equals(productId).first();
  if (!inv || !inv.id) return;

  const newStock = Math.max(0, inv.currentStock - quantity);
  const now = new Date().toISOString();

  await db.inventory.update(inv.id, {
    currentStock: newStock,
    lastUpdated: now,
  });

  await db.inventoryTransactions.add({
    productId,
    productName: inv.productName,
    type: 'waste',
    quantity: -quantity,
    previousStock: inv.currentStock,
    newStock,
    orderId: null,
    note,
    employeeId,
    createdAt: now,
  });
}

export async function getLowStockProducts(): Promise<InventoryRecord[]> {
  return db.inventory
    .filter((inv) => inv.currentStock <= inv.lowStockThreshold)
    .toArray();
}

export async function updateThreshold(
  productId: number,
  threshold: number
): Promise<void> {
  const inv = await db.inventory.where('productId').equals(productId).first();
  if (inv && inv.id) {
    await db.inventory.update(inv.id, { lowStockThreshold: threshold });
  }
}

export async function getTransactionHistory(
  productId: number,
  limit = 50
): Promise<ReturnType<typeof db.inventoryTransactions.toArray>> {
  return db.inventoryTransactions
    .where('productId')
    .equals(productId)
    .reverse()
    .limit(limit)
    .toArray();
}

export async function addInventoryForProduct(
  productId: number,
  productName: string,
  initialStock = 50,
  threshold = 10,
  unit = '份'
): Promise<void> {
  const exists = await db.inventory.where('productId').equals(productId).first();
  if (exists) return;

  await db.inventory.add({
    productId,
    productName,
    currentStock: initialStock,
    lowStockThreshold: threshold,
    unit,
    lastUpdated: new Date().toISOString(),
  });
}
