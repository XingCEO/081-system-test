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

    // Upsert everything to Dexie in one transaction (no clear → no flicker)
    await db.transaction('rw',
      [db.categories, db.products, db.ingredients, db.productRecipes,
       db.modifierGroups, db.modifiers, db.diningTables,
       db.orders, db.orderItems, db.employees, db.shifts,
       db.inventory, db.inventoryTransactions, db.dailySummaries, db.settings],
      async () => {
        await syncTable(db.categories, data.categories);
        await syncTable(db.products, data.products);
        await syncTable(db.ingredients, data.ingredients);
        await syncTable(db.productRecipes, data.productRecipes);
        await syncTable(db.modifierGroups, data.modifierGroups);
        await syncTable(db.modifiers, data.modifiers);
        await syncTable(db.diningTables, data.diningTables);
        await syncTable(db.orders, data.orders);
        await syncTable(db.orderItems, data.orderItems);

        // Store pin hashes so offline login works.
        // The server only returns SHA-256 hashes, never plaintext PINs.
        if (data.employees?.length) {
          const employees: Employee[] = data.employees.map((employee) => ({
            id: employee.id,
            username: employee.username,
            pin: employee.pin ?? '***',
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
