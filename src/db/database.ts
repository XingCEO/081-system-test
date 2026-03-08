import Dexie, { type Table } from 'dexie';
import type {
  Category, Product, ModifierGroup, Modifier,
  Ingredient, ProductRecipeItem,
  RestaurantTable, Order, OrderItem,
  Employee, Shift,
  InventoryRecord, InventoryTransaction,
  DailySummary, SyncQueueItem, AppSetting,
} from './types';

export class PosDatabase extends Dexie {
  categories!: Table<Category>;
  products!: Table<Product>;
  ingredients!: Table<Ingredient>;
  productRecipes!: Table<ProductRecipeItem>;
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
      ingredients: '++id, name, isActive, sortOrder',
      productRecipes: '++id, productId, ingredientId, [productId+ingredientId]',
      modifierGroups: '++id, name',
      modifiers: '++id, groupId, name, isActive',
      diningTables: '++id, number, status, floor, isActive',
      orders: '++id, &orderNumber, tableId, status, employeeId, createdAt, [status+createdAt]',
      orderItems: '++id, orderId, productId, [orderId+productId]',
      employees: '++id, &username, role, isActive',
      shifts: '++id, employeeId, startTime, [employeeId+startTime]',
      inventory: '++id, &ingredientId, currentStock, lowStockThreshold',
      inventoryTransactions: '++id, ingredientId, type, createdAt, [ingredientId+createdAt]',
      dailySummaries: '++id, &date, totalRevenue',
      syncQueue: '++id, table, operation, createdAt, synced',
      settings: '&key',
    });

    // v2: add itemStatus to order items, combo fields are non-indexed
    this.version(2).stores({}).upgrade(async (tx) => {
      await tx.table('orderItems').toCollection().modify((item) => {
        if (!item.itemStatus) {
          item.itemStatus = 'pending';
        }
      });
    });

    this.version(3).stores({
      categories: '++id, name, sortOrder, isActive',
      products: '++id, categoryId, name, price, isActive, sortOrder, [categoryId+isActive]',
      ingredients: '++id, name, isActive, sortOrder',
      productRecipes: '++id, productId, ingredientId, [productId+ingredientId]',
      modifierGroups: '++id, name',
      modifiers: '++id, groupId, name, isActive',
      diningTables: '++id, number, status, floor, isActive',
      orders: '++id, &orderNumber, tableId, status, employeeId, createdAt, [status+createdAt]',
      orderItems: '++id, orderId, productId, [orderId+productId]',
      employees: '++id, &username, role, isActive',
      shifts: '++id, employeeId, startTime, [employeeId+startTime]',
      inventory: '++id, &ingredientId, currentStock, lowStockThreshold',
      inventoryTransactions: '++id, ingredientId, type, createdAt, [ingredientId+createdAt]',
      dailySummaries: '++id, &date, totalRevenue',
      syncQueue: '++id, table, operation, createdAt, synced',
      settings: '&key',
    }).upgrade(async (tx) => {
      const inventoryTable = tx.table('inventory');
      const inventoryTransactionsTable = tx.table('inventoryTransactions');
      const ingredientsTable = tx.table('ingredients');
      const productRecipesTable = tx.table('productRecipes');
      const productsTable = tx.table('products');
      const now = new Date().toISOString();

      await inventoryTable.toCollection().modify((record: Record<string, unknown>) => {
        if (record.ingredientId == null && typeof record.productId === 'number') {
          record.ingredientId = record.productId;
        }

        if (record.ingredientName == null && typeof record.productName === 'string') {
          record.ingredientName = record.productName;
        }
      });

      await inventoryTransactionsTable.toCollection().modify((record: Record<string, unknown>) => {
        if (record.ingredientId == null && typeof record.productId === 'number') {
          record.ingredientId = record.productId;
        }

        if (record.ingredientName == null && typeof record.productName === 'string') {
          record.ingredientName = record.productName;
        }
      });

      if ((await ingredientsTable.count()) === 0) {
        const inventoryRecords = await inventoryTable.toArray();

        if (inventoryRecords.length > 0) {
          await ingredientsTable.bulkAdd(
            inventoryRecords.map((record, index) => ({
              name: String(record.ingredientName ?? ''),
              unit: String(record.unit ?? '份'),
              costPerUnit: 0,
              lowStockThreshold: Number(record.lowStockThreshold ?? 0),
              isActive: true,
              sortOrder: index + 1,
              createdAt: now,
              updatedAt: now,
            }))
          );
        }
      }

      if ((await inventoryTable.count()) === 0) {
        const ingredients = await ingredientsTable.toArray();
        if (ingredients.length > 0) {
          await inventoryTable.bulkAdd(
            ingredients
              .filter((ingredient) => ingredient.id)
              .map((ingredient) => ({
                ingredientId: ingredient.id!,
                ingredientName: ingredient.name,
                currentStock: 50,
                lowStockThreshold: ingredient.lowStockThreshold,
                unit: ingredient.unit,
                lastUpdated: now,
              }))
          );
        }
      }

      if ((await productRecipesTable.count()) === 0) {
        const ingredients = await ingredientsTable.toArray();
        const ingredientByName = new Map(
          ingredients.map((ingredient) => [ingredient.name, ingredient])
        );
        const products = await productsTable.toArray();
        const fallbackRecipes = products.flatMap((product) => {
          if (!product.id || !product.trackInventory || product.isCombo) {
            return [];
          }

          const ingredient = ingredientByName.get(product.name);
          if (!ingredient?.id) {
            return [];
          }

          return [{
            productId: product.id,
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            quantity: 1,
          }];
        });

        if (fallbackRecipes.length > 0) {
          await productRecipesTable.bulkAdd(fallbackRecipes);
        }
      }
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
