/**
 * Sync Manager — pulls data from the server into local Dexie for reactive UI.
 *
 * Strategy:
 *   1. On app init, pull ALL data from server → write to Dexie
 *   2. Poll every few seconds to pick up changes from other devices
 *   3. Service mutations write to API first, then Dexie updates via next sync
 *
 * This lets useLiveQuery() keep working since Dexie is always in sync.
 */
import { db } from '../db/database';
import { api } from './client';
import type {
  Category, Product, ModifierGroup, Modifier,
  Ingredient, ProductRecipeItem,
  RestaurantTable, Order, OrderItem,
  Employee, Shift,
  InventoryRecord, InventoryTransaction,
  DailySummary, AppSetting,
} from '../db/types';

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;
let isServerAvailable = true;

export function getServerStatus(): boolean {
  return isServerAvailable;
}

export async function pullFromServer(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const data = await api.get<{
      categories: Category[];
      products: Product[];
      ingredients: Ingredient[];
      productRecipes: ProductRecipeItem[];
      modifierGroups: ModifierGroup[];
      modifiers: Modifier[];
      diningTables: RestaurantTable[];
      orders: Order[];
      orderItems: OrderItem[];
      employees: (Employee & { pin?: string })[];
      shifts: Shift[];
      inventory: InventoryRecord[];
      inventoryTransactions: InventoryTransaction[];
      dailySummaries: DailySummary[];
      settings: AppSetting[];
    }>('/sync/export');

    isServerAvailable = true;

    // Write everything to Dexie in one transaction
    await db.transaction('rw',
      [db.categories, db.products, db.ingredients, db.productRecipes,
       db.modifierGroups, db.modifiers, db.diningTables,
       db.orders, db.orderItems, db.employees, db.shifts,
       db.inventory, db.inventoryTransactions, db.dailySummaries, db.settings],
      async () => {
        // Clear and re-populate each table
        await db.categories.clear();
        if (data.categories?.length) await db.categories.bulkPut(data.categories);

        await db.products.clear();
        if (data.products?.length) await db.products.bulkPut(data.products);

        await db.ingredients.clear();
        if (data.ingredients?.length) await db.ingredients.bulkPut(data.ingredients);

        await db.productRecipes.clear();
        if (data.productRecipes?.length) await db.productRecipes.bulkPut(data.productRecipes);

        await db.modifierGroups.clear();
        if (data.modifierGroups?.length) await db.modifierGroups.bulkPut(data.modifierGroups);

        await db.modifiers.clear();
        if (data.modifiers?.length) await db.modifiers.bulkPut(data.modifiers);

        await db.diningTables.clear();
        if (data.diningTables?.length) await db.diningTables.bulkPut(data.diningTables);

        await db.orders.clear();
        if (data.orders?.length) await db.orders.bulkPut(data.orders);

        await db.orderItems.clear();
        if (data.orderItems?.length) await db.orderItems.bulkPut(data.orderItems);

        await db.employees.clear();
        if (data.employees?.length) {
          // Don't store pin hashes locally.
          const employees = data.employees.map((employee) => ({
            id: employee.id,
            username: employee.username,
            pin: '***',
            name: employee.name,
            role: employee.role,
            isActive: employee.isActive,
            createdAt: employee.createdAt,
          } satisfies Employee));
          await db.employees.bulkPut(employees);
        }

        await db.shifts.clear();
        if (data.shifts?.length) await db.shifts.bulkPut(data.shifts);

        await db.inventory.clear();
        if (data.inventory?.length) await db.inventory.bulkPut(data.inventory);

        await db.inventoryTransactions.clear();
        if (data.inventoryTransactions?.length) await db.inventoryTransactions.bulkPut(data.inventoryTransactions);

        await db.dailySummaries.clear();
        if (data.dailySummaries?.length) await db.dailySummaries.bulkPut(data.dailySummaries);

        await db.settings.clear();
        if (data.settings?.length) await db.settings.bulkPut(data.settings);
      }
    );
  } catch (err) {
    isServerAvailable = false;
    console.warn('Sync failed (server may be offline):', err);
  } finally {
    isSyncing = false;
  }
}

export function startSync(intervalMs = 5000): void {
  if (syncInterval) return;

  // Initial pull
  pullFromServer();

  // Periodic sync
  syncInterval = setInterval(() => {
    pullFromServer();
  }, intervalMs);
}

export function stopSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
