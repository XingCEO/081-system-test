import { db } from '../db/database';
import type { Ingredient, InventoryRecord, InventoryTransaction } from '../db/types';

export interface IngredientInput {
  name: string;
  unit: string;
  costPerUnit: number;
  lowStockThreshold: number;
  currentStock: number;
}

export async function createIngredient(input: IngredientInput): Promise<number> {
  const now = new Date().toISOString();
  const sortOrder = (await db.ingredients.count()) + 1;

  const ingredientId = await db.ingredients.add({
    name: input.name,
    unit: input.unit,
    costPerUnit: input.costPerUnit,
    lowStockThreshold: input.lowStockThreshold,
    isActive: true,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  } satisfies Ingredient);

  await db.inventory.add({
    ingredientId: ingredientId as number,
    ingredientName: input.name,
    currentStock: input.currentStock,
    lowStockThreshold: input.lowStockThreshold,
    unit: input.unit,
    lastUpdated: now,
  });

  return ingredientId as number;
}

export async function updateIngredient(
  ingredientId: number,
  input: IngredientInput
): Promise<void> {
  const now = new Date().toISOString();

  await db.ingredients.where('id').equals(ingredientId).modify({
    name: input.name,
    unit: input.unit,
    costPerUnit: input.costPerUnit,
    lowStockThreshold: input.lowStockThreshold,
    updatedAt: now,
  });

  await db.inventory.where('ingredientId').equals(ingredientId).modify({
    ingredientName: input.name,
    currentStock: input.currentStock,
    lowStockThreshold: input.lowStockThreshold,
    unit: input.unit,
    lastUpdated: now,
  });

  await db.productRecipes.where('ingredientId').equals(ingredientId).modify({
    ingredientName: input.name,
  });
}

export async function restockIngredient(
  ingredientId: number,
  quantity: number,
  employeeId: number,
  note: string
): Promise<void> {
  const inventory = await db.inventory.where('ingredientId').equals(ingredientId).first();
  if (!inventory?.id) {
    return;
  }

  const newStock = inventory.currentStock + quantity;
  const now = new Date().toISOString();

  await db.inventory.update(inventory.id, {
    currentStock: newStock,
    lastUpdated: now,
  });

  await db.inventoryTransactions.add({
    ingredientId,
    ingredientName: inventory.ingredientName,
    type: 'restock',
    quantity,
    previousStock: inventory.currentStock,
    newStock,
    orderId: null,
    note,
    employeeId,
    createdAt: now,
  });
}

export async function adjustIngredientStock(
  ingredientId: number,
  newQuantity: number,
  employeeId: number,
  note: string
): Promise<void> {
  const inventory = await db.inventory.where('ingredientId').equals(ingredientId).first();
  if (!inventory?.id) {
    return;
  }

  const diff = newQuantity - inventory.currentStock;
  const now = new Date().toISOString();

  await db.inventory.update(inventory.id, {
    currentStock: newQuantity,
    lastUpdated: now,
  });

  await db.inventoryTransactions.add({
    ingredientId,
    ingredientName: inventory.ingredientName,
    type: 'adjustment',
    quantity: diff,
    previousStock: inventory.currentStock,
    newStock: newQuantity,
    orderId: null,
    note,
    employeeId,
    createdAt: now,
  });
}

export async function wasteIngredient(
  ingredientId: number,
  quantity: number,
  employeeId: number,
  note: string
): Promise<void> {
  const inventory = await db.inventory.where('ingredientId').equals(ingredientId).first();
  if (!inventory?.id) {
    return;
  }

  const newStock = Math.max(0, inventory.currentStock - quantity);
  const now = new Date().toISOString();

  await db.inventory.update(inventory.id, {
    currentStock: newStock,
    lastUpdated: now,
  });

  await db.inventoryTransactions.add({
    ingredientId,
    ingredientName: inventory.ingredientName,
    type: 'waste',
    quantity: -quantity,
    previousStock: inventory.currentStock,
    newStock,
    orderId: null,
    note,
    employeeId,
    createdAt: now,
  });
}

export async function getLowStockIngredients(): Promise<InventoryRecord[]> {
  return db.inventory.filter((inventory) => inventory.currentStock <= inventory.lowStockThreshold).toArray();
}

export async function updateThreshold(
  ingredientId: number,
  threshold: number
): Promise<void> {
  await db.inventory.where('ingredientId').equals(ingredientId).modify({
    lowStockThreshold: threshold,
  });
  await db.ingredients.where('id').equals(ingredientId).modify({
    lowStockThreshold: threshold,
  });
}

export async function getTransactionHistory(
  ingredientId: number,
  limit = 50
): Promise<InventoryTransaction[]> {
  return db.inventoryTransactions
    .where('ingredientId')
    .equals(ingredientId)
    .reverse()
    .limit(limit)
    .toArray();
}
