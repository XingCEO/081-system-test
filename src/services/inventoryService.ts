import { api } from '../api/client';
import { db } from '../db/database';
import type { Ingredient, InventoryRecord, InventoryTransaction } from '../db/types';

export interface IngredientInput {
  name: string;
  unit: string;
  costPerUnit: number;
  lowStockThreshold: number;
  currentStock: number;
}

async function upsertIngredientLocal(
  ingredientId: number | undefined,
  input: IngredientInput
): Promise<number> {
  const now = new Date().toISOString();

  if (typeof ingredientId === 'number') {
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

    return ingredientId;
  }

  const sortOrder = (await db.ingredients.count()) + 1;
  const id = await db.ingredients.add({
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
    ingredientId: id as number,
    ingredientName: input.name,
    currentStock: input.currentStock,
    lowStockThreshold: input.lowStockThreshold,
    unit: input.unit,
    lastUpdated: now,
  });

  return id as number;
}

async function applyInventoryDeltaLocal(params: {
  ingredientId: number;
  type: InventoryTransaction['type'];
  quantityDelta: number;
  note: string;
  employeeId: number;
}): Promise<void> {
  const inventory = await db.inventory.where('ingredientId').equals(params.ingredientId).first();
  if (!inventory?.id) {
    return;
  }

  const previousStock = inventory.currentStock;
  const newStock = Math.max(0, previousStock + params.quantityDelta);
  const now = new Date().toISOString();

  await db.inventory.update(inventory.id, {
    currentStock: newStock,
    lastUpdated: now,
  });

  await db.inventoryTransactions.add({
    ingredientId: params.ingredientId,
    ingredientName: inventory.ingredientName,
    type: params.type,
    quantity: params.quantityDelta,
    previousStock,
    newStock,
    orderId: null,
    note: params.note,
    employeeId: params.employeeId,
    createdAt: now,
  });
}

export async function createIngredient(input: IngredientInput): Promise<number> {
  try {
    const result = await api.post<Ingredient>('/ingredients', input);
    await upsertIngredientLocal(result.id, input);
    return result.id!;
  } catch {
    // Fallback to Dexie-only
    return upsertIngredientLocal(undefined, input);
  }
}

export async function updateIngredient(
  ingredientId: number,
  input: IngredientInput
): Promise<void> {
  try {
    await api.put(`/ingredients/${ingredientId}`, input);
    await upsertIngredientLocal(ingredientId, input);
  } catch {
    // Fallback to Dexie-only
    await upsertIngredientLocal(ingredientId, input);
  }
}

export async function restockIngredient(
  ingredientId: number,
  quantity: number,
  employeeId: number,
  note: string
): Promise<void> {
  try {
    await api.post(`/inventory/${ingredientId}/restock`, { quantity, employeeId, note });
    await applyInventoryDeltaLocal({
      ingredientId,
      type: 'restock',
      quantityDelta: quantity,
      note,
      employeeId,
    });
  } catch {
    // Fallback to Dexie-only
    await applyInventoryDeltaLocal({
      ingredientId,
      type: 'restock',
      quantityDelta: quantity,
      note,
      employeeId,
    });
  }
}

export async function adjustIngredientStock(
  ingredientId: number,
  newQuantity: number,
  employeeId: number,
  note: string
): Promise<void> {
  try {
    await api.post(`/inventory/${ingredientId}/adjust`, { newQuantity, employeeId, note });
    const inventory = await db.inventory.where('ingredientId').equals(ingredientId).first();
    if (inventory) {
      await applyInventoryDeltaLocal({
        ingredientId,
        type: 'adjustment',
        quantityDelta: newQuantity - inventory.currentStock,
        note,
        employeeId,
      });
    }
  } catch {
    // Fallback to Dexie-only
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
}

export async function wasteIngredient(
  ingredientId: number,
  quantity: number,
  employeeId: number,
  note: string
): Promise<void> {
  try {
    await api.post(`/inventory/${ingredientId}/waste`, { quantity, employeeId, note });
    await applyInventoryDeltaLocal({
      ingredientId,
      type: 'waste',
      quantityDelta: -quantity,
      note,
      employeeId,
    });
  } catch {
    // Fallback to Dexie-only
    await applyInventoryDeltaLocal({
      ingredientId,
      type: 'waste',
      quantityDelta: -quantity,
      note,
      employeeId,
    });
  }
}

export async function getLowStockIngredients(): Promise<InventoryRecord[]> {
  try {
    return await api.get<InventoryRecord[]>('/inventory/low-stock');
  } catch {
    // Fallback to Dexie
    return db.inventory.filter((inventory) => inventory.currentStock <= inventory.lowStockThreshold).toArray();
  }
}

export async function updateThreshold(
  ingredientId: number,
  threshold: number
): Promise<void> {
  try {
    await api.put(`/inventory/${ingredientId}/threshold`, { threshold });
  } catch {
    // Fallback to Dexie-only
    await db.inventory.where('ingredientId').equals(ingredientId).modify({
      lowStockThreshold: threshold,
    });
    await db.ingredients.where('id').equals(ingredientId).modify({
      lowStockThreshold: threshold,
    });
  }
}

export async function getTransactionHistory(
  ingredientId: number,
  limit = 50
): Promise<InventoryTransaction[]> {
  try {
    return await api.get<InventoryTransaction[]>(`/inventory/${ingredientId}/transactions?limit=${limit}`);
  } catch {
    // Fallback to Dexie
    return db.inventoryTransactions
      .where('ingredientId')
      .equals(ingredientId)
      .reverse()
      .limit(limit)
      .toArray();
  }
}
