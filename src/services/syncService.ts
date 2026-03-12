import { api } from '../api/client';
import { pullFromServer } from '../api/sync';
import { db } from '../db/database';
import type {
  AppSetting,
  Category,
  DailySummary,
  Employee,
  Ingredient,
  InventoryRecord,
  InventoryTransaction,
  Modifier,
  ModifierGroup,
  Order,
  OrderItem,
  Product,
  ProductRecipeItem,
  RestaurantTable,
  Shift,
} from '../db/types';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeInventoryRecords(value: unknown): InventoryRecord[] {
  return asArray<Record<string, unknown>>(value).flatMap((record) => {
    const ingredientId =
      typeof record.ingredientId === 'number'
        ? record.ingredientId
        : typeof record.productId === 'number'
          ? record.productId
          : null;

    const ingredientName =
      typeof record.ingredientName === 'string'
        ? record.ingredientName
        : typeof record.productName === 'string'
          ? record.productName
          : null;

    if (ingredientId == null || ingredientName == null) {
      return [];
    }

    return [{
      ingredientId,
      ingredientName,
      currentStock: Number(record.currentStock ?? 0),
      lowStockThreshold: Number(record.lowStockThreshold ?? 0),
      unit: typeof record.unit === 'string' ? record.unit : '份',
      lastUpdated: typeof record.lastUpdated === 'string' ? record.lastUpdated : new Date().toISOString(),
    }];
  });
}

function normalizeInventoryTransactions(value: unknown): InventoryTransaction[] {
  return asArray<Record<string, unknown>>(value).flatMap((record) => {
    const ingredientId =
      typeof record.ingredientId === 'number'
        ? record.ingredientId
        : typeof record.productId === 'number'
          ? record.productId
          : null;

    const ingredientName =
      typeof record.ingredientName === 'string'
        ? record.ingredientName
        : typeof record.productName === 'string'
          ? record.productName
          : null;

    if (ingredientId == null || ingredientName == null) {
      return [];
    }

    return [{
      ingredientId,
      ingredientName,
      type: (record.type as InventoryTransaction['type']) ?? 'adjustment',
      quantity: Number(record.quantity ?? 0),
      previousStock: Number(record.previousStock ?? 0),
      newStock: Number(record.newStock ?? 0),
      orderId: typeof record.orderId === 'number' ? record.orderId : null,
      note: typeof record.note === 'string' ? record.note : '',
      employeeId: typeof record.employeeId === 'number' ? record.employeeId : 0,
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
    }];
  });
}

function buildFullBackupJson(data: {
  categories: Category[];
  products: Product[];
  ingredients: Ingredient[];
  productRecipes: ProductRecipeItem[];
  modifierGroups: ModifierGroup[];
  modifiers: Modifier[];
  diningTables: RestaurantTable[];
  orders: Order[];
  orderItems: OrderItem[];
  employees: Employee[];
  shifts: Shift[];
  inventory: InventoryRecord[];
  inventoryTransactions: InventoryTransaction[];
  dailySummaries: DailySummary[];
  settings: AppSetting[];
}): string {
  return JSON.stringify({
    version: '2.0',
    exportedAt: new Date().toISOString(),
    categories: data.categories,
    products: data.products,
    ingredients: data.ingredients,
    productRecipes: data.productRecipes,
    modifierGroups: data.modifierGroups,
    modifiers: data.modifiers,
    tables: data.diningTables,
    diningTables: data.diningTables,
    orders: data.orders,
    orderItems: data.orderItems,
    employees: data.employees,
    shifts: data.shifts,
    inventory: data.inventory,
    inventoryTransactions: data.inventoryTransactions,
    dailySummaries: data.dailySummaries,
    settings: data.settings,
  }, null, 2);
}

function buildMenuBackupJson(data: {
  categories: Category[];
  products: Product[];
  ingredients: Ingredient[];
  productRecipes: ProductRecipeItem[];
  modifierGroups: ModifierGroup[];
  modifiers: Modifier[];
  inventory: InventoryRecord[];
}): string {
  return JSON.stringify({
    version: '2.0',
    type: 'menu',
    exportedAt: new Date().toISOString(),
    categories: data.categories,
    products: data.products,
    ingredients: data.ingredients,
    productRecipes: data.productRecipes,
    modifierGroups: data.modifierGroups,
    modifiers: data.modifiers,
    inventory: data.inventory,
  }, null, 2);
}

export async function exportAllData(): Promise<string> {
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
      employees: Employee[];
      shifts: Shift[];
      inventory: InventoryRecord[];
      inventoryTransactions: InventoryTransaction[];
      dailySummaries: DailySummary[];
      settings: AppSetting[];
    }>('/sync/export');

    return buildFullBackupJson(data);
  } catch {
    // Fall back to local Dexie mirror.
  }

  const data = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    categories: await db.categories.toArray(),
    products: await db.products.toArray(),
    ingredients: await db.ingredients.toArray(),
    productRecipes: await db.productRecipes.toArray(),
    modifierGroups: await db.modifierGroups.toArray(),
    modifiers: await db.modifiers.toArray(),
    tables: await db.diningTables.toArray(),
    orders: await db.orders.toArray(),
    orderItems: await db.orderItems.toArray(),
    employees: await db.employees.toArray(),
    shifts: await db.shifts.toArray(),
    inventory: await db.inventory.toArray(),
    inventoryTransactions: await db.inventoryTransactions.toArray(),
    dailySummaries: await db.dailySummaries.toArray(),
    settings: await db.settings.toArray(),
  };

  return JSON.stringify(data, null, 2);
}

export async function importAllData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);
  const diningTables = asArray<RestaurantTable>(data.diningTables ?? data.tables);

  try {
    await api.post('/sync/import', {
      ...data,
      diningTables,
    });
    await pullFromServer();
    return;
  } catch {
    // Fall back to local Dexie import.
  }

  if (!data.version) {
    throw new Error('無效的資料格式');
  }

  const categories = asArray<Category>(data.categories);
  const products = asArray<Product>(data.products);
  const ingredients = asArray<Ingredient>(data.ingredients);
  const productRecipes = asArray<ProductRecipeItem>(data.productRecipes);
  const modifierGroups = asArray<ModifierGroup>(data.modifierGroups);
  const modifiers = asArray<Modifier>(data.modifiers);
  const tables = diningTables;
  const orders = asArray<Order>(data.orders);
  const orderItems = asArray<OrderItem>(data.orderItems);
  const employees = asArray<Employee>(data.employees);
  const shifts = asArray<Shift>(data.shifts);
  const inventory = normalizeInventoryRecords(data.inventory);
  const inventoryTransactions = normalizeInventoryTransactions(data.inventoryTransactions);
  const dailySummaries = asArray<DailySummary>(data.dailySummaries);
  const settings = asArray<AppSetting>(data.settings);

  await db.transaction(
    'rw',
    [
      db.categories,
      db.products,
      db.ingredients,
      db.productRecipes,
      db.modifierGroups,
      db.modifiers,
      db.diningTables,
      db.orders,
      db.orderItems,
      db.employees,
      db.shifts,
      db.inventory,
      db.inventoryTransactions,
      db.dailySummaries,
      db.settings,
    ],
    async () => {
      await db.orderItems.clear();
      await db.orders.clear();
      await db.inventoryTransactions.clear();
      await db.inventory.clear();
      await db.shifts.clear();
      await db.employees.clear();
      await db.diningTables.clear();
      await db.modifiers.clear();
      await db.modifierGroups.clear();
      await db.productRecipes.clear();
      await db.ingredients.clear();
      await db.products.clear();
      await db.categories.clear();
      await db.dailySummaries.clear();
      await db.settings.clear();

      if (categories.length) await db.categories.bulkAdd(categories);
      if (products.length) await db.products.bulkAdd(products);
      if (ingredients.length) await db.ingredients.bulkAdd(ingredients);
      if (productRecipes.length) await db.productRecipes.bulkAdd(productRecipes);
      if (modifierGroups.length) await db.modifierGroups.bulkAdd(modifierGroups);
      if (modifiers.length) await db.modifiers.bulkAdd(modifiers);
      if (tables.length) await db.diningTables.bulkAdd(tables);
      if (orders.length) await db.orders.bulkAdd(orders);
      if (orderItems.length) await db.orderItems.bulkAdd(orderItems);
      if (employees.length) await db.employees.bulkAdd(employees);
      if (shifts.length) await db.shifts.bulkAdd(shifts);
      if (inventory.length) await db.inventory.bulkAdd(inventory);
      if (inventoryTransactions.length) await db.inventoryTransactions.bulkAdd(inventoryTransactions);
      if (dailySummaries.length) await db.dailySummaries.bulkAdd(dailySummaries);
      if (settings.length) await db.settings.bulkAdd(settings);
    }
  );
}

export async function exportMenuData(): Promise<string> {
  try {
    const data = await api.get<{
      categories: Category[];
      products: Product[];
      ingredients: Ingredient[];
      productRecipes: ProductRecipeItem[];
      modifierGroups: ModifierGroup[];
      modifiers: Modifier[];
      inventory: InventoryRecord[];
    }>('/sync/menu-export');

    return buildMenuBackupJson(data);
  } catch {
    // Fall back to local Dexie mirror.
  }

  const data = {
    version: '2.0',
    type: 'menu',
    exportedAt: new Date().toISOString(),
    categories: await db.categories.toArray(),
    products: await db.products.toArray(),
    ingredients: await db.ingredients.toArray(),
    productRecipes: await db.productRecipes.toArray(),
    modifierGroups: await db.modifierGroups.toArray(),
    modifiers: await db.modifiers.toArray(),
    inventory: await db.inventory.toArray(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importMenuData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);
  try {
    await api.post('/sync/menu-import', {
      ...data,
      inventory: normalizeInventoryRecords(data.inventory),
    });
    await pullFromServer();
    return;
  } catch {
    // Fall back to local Dexie import.
  }

  if (!data.version) {
    throw new Error('無效的菜單資料格式');
  }

  const categories = asArray<Category>(data.categories);
  const products = asArray<Product>(data.products);
  const ingredients = asArray<Ingredient>(data.ingredients);
  const productRecipes = asArray<ProductRecipeItem>(data.productRecipes);
  const modifierGroups = asArray<ModifierGroup>(data.modifierGroups);
  const modifiers = asArray<Modifier>(data.modifiers);
  const inventory = normalizeInventoryRecords(data.inventory);

  await db.transaction(
    'rw',
    [
      db.categories,
      db.products,
      db.ingredients,
      db.productRecipes,
      db.modifierGroups,
      db.modifiers,
      db.inventory,
    ],
    async () => {
      await db.inventory.clear();
      await db.productRecipes.clear();
      await db.ingredients.clear();
      await db.modifiers.clear();
      await db.modifierGroups.clear();
      await db.products.clear();
      await db.categories.clear();

      if (categories.length) await db.categories.bulkAdd(categories);
      if (products.length) await db.products.bulkAdd(products);
      if (ingredients.length) await db.ingredients.bulkAdd(ingredients);
      if (productRecipes.length) await db.productRecipes.bulkAdd(productRecipes);
      if (modifierGroups.length) await db.modifierGroups.bulkAdd(modifierGroups);
      if (modifiers.length) await db.modifiers.bulkAdd(modifiers);
      if (inventory.length) await db.inventory.bulkAdd(inventory);
    }
  );
}

export async function resetAllData(): Promise<void> {
  try {
    await api.post('/sync/reset');
    await pullFromServer();
  } catch {
    await db.delete();
  }

  window.location.reload();
}

export function downloadFile(
  content: string,
  filename: string,
  mimeType = 'application/json;charset=utf-8'
) {
  const blob = new Blob(['\ufeff', content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
