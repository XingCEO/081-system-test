import Dexie, { type Table } from 'dexie';
import type {
  Category, Product, ModifierGroup, Modifier,
  RestaurantTable, Order, OrderItem,
  Employee, Shift,
  InventoryRecord, InventoryTransaction,
  DailySummary, SyncQueueItem, AppSetting,
} from './types';

export class PosDatabase extends Dexie {
  categories!: Table<Category>;
  products!: Table<Product>;
  modifierGroups!: Table<ModifierGroup>;
  modifiers!: Table<Modifier>;
  diningTables!: Table<RestaurantTable>;
  orders!: Table<Order>;
  orderItems!: Table<OrderItem>;
  employees!: Table<Employee>;
  shifts!: Table<Shift>;
  inventory!: Table<InventoryRecord>;
  inventoryTransactions!: Table<InventoryTransaction>;
  dailySummaries!: Table<DailySummary>;
  syncQueue!: Table<SyncQueueItem>;
  settings!: Table<AppSetting>;

  constructor() {
    super('pos-restaurant-db');

    this.version(1).stores({
      categories: '++id, name, sortOrder, isActive',
      products: '++id, categoryId, name, price, isActive, sortOrder, [categoryId+isActive]',
      modifierGroups: '++id, name',
      modifiers: '++id, groupId, name, isActive',
      diningTables: '++id, number, status, floor, isActive',
      orders: '++id, &orderNumber, tableId, status, employeeId, createdAt, [status+createdAt]',
      orderItems: '++id, orderId, productId, [orderId+productId]',
      employees: '++id, &username, role, isActive',
      shifts: '++id, employeeId, startTime, [employeeId+startTime]',
      inventory: '++id, &productId, currentStock, lowStockThreshold',
      inventoryTransactions: '++id, productId, type, createdAt, [productId+createdAt]',
      dailySummaries: '++id, &date, totalRevenue',
      syncQueue: '++id, table, operation, createdAt, synced',
      settings: '&key',
    });
  }
}

export const db = new PosDatabase();

export async function initializeDatabase() {
  try {
    const count = await db.settings.count();
    if (count === 0) {
      const { seedDatabase } = await import('./seed');
      await seedDatabase();
    }
  } catch (err) {
    console.error('Database init error:', err);
    try {
      await db.delete();
      await db.open();
      const { seedDatabase } = await import('./seed');
      await seedDatabase();
    } catch (retryErr) {
      console.error('Database retry failed:', retryErr);
    }
  }
}
