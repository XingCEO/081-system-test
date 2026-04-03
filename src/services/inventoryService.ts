import { api } from '../api/client';
import { syncNow } from '../api/sync';
import { db } from '../db/database';
import type { Ingredient, IngredientCategory, InventoryRecord, InventoryTransaction } from '../db/types';

export interface IngredientInput {
  name: string;
  unit: string;
  costPerUnit: number;
  costPerServing?: number;
  lowStockThreshold: number;
  currentStock: number;
  supplier?: string;
  ingredientCategory?: IngredientCategory;
  notes?: string;
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
      costPerServing: input.costPerServing ?? 0,
      lowStockThreshold: input.lowStockThreshold,
      supplier: input.supplier ?? '',
      ingredientCategory: input.ingredientCategory ?? '其他',
      notes: input.notes ?? '',
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
    costPerServing: input.costPerServing ?? 0,
    lowStockThreshold: input.lowStockThreshold,
    isActive: true,
    sortOrder,
    supplier: input.supplier ?? '',
    ingredientCategory: input.ingredientCategory ?? '其他',
    notes: input.notes ?? '',
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
    const id = result.id!;
    const now = new Date().toISOString();

    // Write directly to local Dexie so the UI updates immediately
    const sortOrder = (await db.ingredients.count()) + 1;
    await db.ingredients.put({
      id,
      name: input.name,
      unit: input.unit,
      costPerUnit: input.costPerUnit,
      costPerServing: input.costPerServing ?? 0,
      lowStockThreshold: input.lowStockThreshold,
      isActive: true,
      sortOrder,
      supplier: input.supplier ?? '',
      ingredientCategory: input.ingredientCategory ?? '其他',
      notes: input.notes ?? '',
      createdAt: now,
      updatedAt: now,
    });
    await db.inventory.put({
      ingredientId: id,
      ingredientName: input.name,
      currentStock: input.currentStock,
      lowStockThreshold: input.lowStockThreshold,
      unit: input.unit,
      lastUpdated: now,
    });

    // Background sync to reconcile any differences
    void syncNow();
    return id;
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
    void syncNow();
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
    const result = await api.post<{ newStock: number }>(`/inventory/${ingredientId}/restock`, { quantity, employeeId, note });
    // Update local stock to match server value (avoid double-add)
    await db.inventory.where('ingredientId').equals(ingredientId).modify({
      currentStock: result.newStock,
      lastUpdated: new Date().toISOString(),
    });
    // Force sync to prevent stale background sync from overwriting
    void syncNow();
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
    const result = await api.post<{ newStock: number }>(`/inventory/${ingredientId}/adjust`, { newQuantity, employeeId, note });
    // Update local stock to match server value (avoid double-apply)
    await db.inventory.where('ingredientId').equals(ingredientId).modify({
      currentStock: result.newStock,
      lastUpdated: new Date().toISOString(),
    });
    void syncNow();
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
    const result = await api.post<{ newStock: number }>(`/inventory/${ingredientId}/waste`, { quantity, employeeId, note });
    // Update local stock to match server value (avoid double-deduct)
    await db.inventory.where('ingredientId').equals(ingredientId).modify({
      currentStock: result.newStock,
      lastUpdated: new Date().toISOString(),
    });
    void syncNow();
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
    return db.inventoryTransactions
      .where('ingredientId')
      .equals(ingredientId)
      .reverse()
      .limit(limit)
      .toArray();
  }
}

export interface CostAnalysisGroup {
  category: string;
  items: Array<Ingredient & { currentStock: number }>;
  totalCost: number;
  itemCount: number;
}

export async function getCostAnalysis(): Promise<CostAnalysisGroup[]> {
  const ingredients = await db.ingredients
    .where('isActive')
    .equals(1)
    .toArray();

  const inventoryRecords = await db.inventory.toArray();
  const stockMap = new Map(inventoryRecords.map((r) => [r.ingredientId, r.currentStock]));

  const groups = new Map<string, CostAnalysisGroup>();

  for (const ingredient of ingredients) {
    const category = ingredient.ingredientCategory || '其他';
    const currentStock = stockMap.get(ingredient.id!) ?? 0;

    if (!groups.has(category)) {
      groups.set(category, { category, items: [], totalCost: 0, itemCount: 0 });
    }

    const group = groups.get(category)!;
    group.items.push({ ...ingredient, currentStock });
    group.totalCost += ingredient.costPerUnit * currentStock;
    group.itemCount += 1;
  }

  return Array.from(groups.values()).sort((a, b) => b.totalCost - a.totalCost);
}
