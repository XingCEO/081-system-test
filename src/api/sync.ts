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
import type { Table } from 'dexie';
import { db } from '../db/database';
import { api } from './client';
import type {
  Category, Product, ModifierGroup, Modifier,
  Ingredient, ProductRecipeItem, ModifierRecipeItem,
  RestaurantTable, Order, OrderItem,
  Employee, Shift,
  InventoryRecord, InventoryTransaction,
  DailySummary, AppSetting,
} from '../db/types';

let syncInterval: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;
let isServerAvailable = true;
let consecutiveFailures = 0;
let currentIntervalMs = 5000;
let baseIntervalMs = 5000;
const MAX_SYNC_INTERVAL_MS = 30000;
let isSyncStarted = false;

function scheduleNextSync(): void {
  if (!isSyncStarted || document.hidden || syncInterval) return;

  syncInterval = setTimeout(() => {
    syncInterval = null;
    void pullFromServer().finally(() => {
      scheduleNextSync();
    });
  }, currentIntervalMs);
}

function handleVisibilityChange(): void {
  if (!isSyncStarted) return;

  if (document.hidden) {
    if (syncInterval) {
      clearTimeout(syncInterval);
      syncInterval = null;
    }
    return;
  }

  if (syncInterval) {
    clearTimeout(syncInterval);
    syncInterval = null;
  }

  void pullFromServer().finally(() => {
    scheduleNextSync();
  });
}

export function getServerStatus(): boolean {
  return isServerAvailable;
}

/**
 * Upsert server rows into a Dexie table and remove rows that no longer exist
 * on the server. Uses bulkPut (upsert) instead of clear+bulkPut to avoid a
 * transient empty-table state that causes UI flicker.
 */
async function syncTable<T>(
  table: Table<T>,
  serverRows: T[] | undefined,
  primaryKey: string = 'id',
): Promise<void> {
  if (!serverRows) return;

  // Upsert all server rows
  if (serverRows.length > 0) {
    await table.bulkPut(serverRows);
  }

  // Remove local rows that the server no longer has
  const serverIds = new Set(
    serverRows.map((row) => (row as Record<string, unknown>)[primaryKey])
  );
  const localKeys = await table.toCollection().primaryKeys();
  const staleKeys = localKeys.filter((key) => !serverIds.has(key));
  if (staleKeys.length > 0) {
    await table.bulkDelete(staleKeys);
  }
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
      modifierRecipes: ModifierRecipeItem[];
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
    consecutiveFailures = 0;
    currentIntervalMs = baseIntervalMs;

    // Upsert everything to Dexie in one transaction (no clear → no flicker)
    await db.transaction('rw',
      [db.categories, db.products, db.ingredients, db.productRecipes,
       db.modifierRecipes, db.modifierGroups, db.modifiers, db.diningTables,
       db.orders, db.orderItems, db.employees, db.shifts,
       db.inventory, db.inventoryTransactions, db.dailySummaries, db.settings],
      async () => {
        await syncTable(db.categories, data.categories);
        await syncTable(db.products, data.products);
        await syncTable(db.ingredients, data.ingredients);
        await syncTable(db.productRecipes, data.productRecipes);
        await syncTable(db.modifierRecipes, data.modifierRecipes);
        await syncTable(db.modifierGroups, data.modifierGroups);
        await syncTable(db.modifiers, data.modifiers);
        await syncTable(db.diningTables, data.diningTables);
        await syncTable(db.orders, data.orders);
        await syncTable(db.orderItems, data.orderItems);

        // Server no longer sends pin hashes. Store empty pin locally.
        if (data.employees?.length) {
          const employees: Employee[] = data.employees.map((employee) => ({
            id: employee.id,
            username: employee.username,
            pin: '',
            name: employee.name,
            role: employee.role,
            isActive: employee.isActive,
            createdAt: employee.createdAt,
          }));
          await syncTable(db.employees, employees);
        } else {
          await syncTable(db.employees, []);
        }

        await syncTable(db.shifts, data.shifts);
        await syncTable(db.inventory, data.inventory);
        await syncTable(db.inventoryTransactions, data.inventoryTransactions);
        await syncTable(db.dailySummaries, data.dailySummaries);
        await syncTable(db.settings, data.settings, 'key');
      }
    );
  } catch (err) {
    isServerAvailable = false;
    consecutiveFailures += 1;
    currentIntervalMs = Math.min(baseIntervalMs * (2 ** consecutiveFailures), MAX_SYNC_INTERVAL_MS);
    console.warn('Sync failed (server may be offline):', err);
  } finally {
    isSyncing = false;
  }
}

export function startSync(intervalMs = 5000): void {
  if (isSyncStarted) return;

  isSyncStarted = true;
  baseIntervalMs = intervalMs;
  currentIntervalMs = intervalMs;
  consecutiveFailures = 0;

  document.addEventListener('visibilitychange', handleVisibilityChange);

  if (document.hidden) return;

  // Initial pull
  void pullFromServer().finally(() => {
    scheduleNextSync();
  });
}

export function stopSync(): void {
  isSyncStarted = false;
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  if (syncInterval) {
    clearTimeout(syncInterval);
    syncInterval = null;
  }
}

/**
 * Force an immediate sync from server. Waits for any in-flight sync to finish
 * first, then pulls fresh data. Use after mutations to avoid stale-data races.
 */
export async function syncNow(): Promise<void> {
  // Wait for in-flight sync to finish
  let retries = 0;
  while (isSyncing && retries < 100) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    retries++;
  }
  await pullFromServer();
}
