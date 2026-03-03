import { db } from '../db/database';

export async function exportAllData(): Promise<string> {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    categories: await db.categories.toArray(),
    products: await db.products.toArray(),
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
  if (!data.version) throw new Error('無效的資料格式');

  await db.transaction(
    'rw',
    [
      db.categories, db.products, db.modifierGroups, db.modifiers,
      db.diningTables, db.orders, db.orderItems, db.employees,
      db.shifts, db.inventory, db.inventoryTransactions,
      db.dailySummaries, db.settings,
    ],
    async () => {
      if (data.categories?.length) {
        await db.categories.clear();
        await db.categories.bulkAdd(data.categories);
      }
      if (data.products?.length) {
        await db.products.clear();
        await db.products.bulkAdd(data.products);
      }
      if (data.modifierGroups?.length) {
        await db.modifierGroups.clear();
        await db.modifierGroups.bulkAdd(data.modifierGroups);
      }
      if (data.modifiers?.length) {
        await db.modifiers.clear();
        await db.modifiers.bulkAdd(data.modifiers);
      }
      if (data.tables?.length) {
        await db.diningTables.clear();
        await db.diningTables.bulkAdd(data.tables);
      }
      if (data.orders?.length) {
        await db.orders.clear();
        await db.orders.bulkAdd(data.orders);
      }
      if (data.orderItems?.length) {
        await db.orderItems.clear();
        await db.orderItems.bulkAdd(data.orderItems);
      }
      if (data.employees?.length) {
        await db.employees.clear();
        await db.employees.bulkAdd(data.employees);
      }
      if (data.shifts?.length) {
        await db.shifts.clear();
        await db.shifts.bulkAdd(data.shifts);
      }
      if (data.inventory?.length) {
        await db.inventory.clear();
        await db.inventory.bulkAdd(data.inventory);
      }
      if (data.inventoryTransactions?.length) {
        await db.inventoryTransactions.clear();
        await db.inventoryTransactions.bulkAdd(data.inventoryTransactions);
      }
      if (data.dailySummaries?.length) {
        await db.dailySummaries.clear();
        await db.dailySummaries.bulkAdd(data.dailySummaries);
      }
      if (data.settings?.length) {
        await db.settings.clear();
        await db.settings.bulkAdd(data.settings);
      }
    }
  );
}

export async function exportMenuData(): Promise<string> {
  const data = {
    version: '1.0',
    type: 'menu',
    exportedAt: new Date().toISOString(),
    categories: await db.categories.toArray(),
    products: await db.products.toArray(),
    modifierGroups: await db.modifierGroups.toArray(),
    modifiers: await db.modifiers.toArray(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importMenuData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);
  if (!data.version) throw new Error('無效的菜單資料格式');

  await db.transaction(
    'rw',
    [db.categories, db.products, db.modifierGroups, db.modifiers, db.inventory],
    async () => {
      if (data.categories?.length) {
        await db.categories.clear();
        await db.categories.bulkAdd(data.categories);
      }
      if (data.modifierGroups?.length) {
        await db.modifierGroups.clear();
        await db.modifierGroups.bulkAdd(data.modifierGroups);
      }
      if (data.modifiers?.length) {
        await db.modifiers.clear();
        await db.modifiers.bulkAdd(data.modifiers);
      }
      if (data.products?.length) {
        await db.products.clear();
        await db.products.bulkAdd(data.products);

        // Recreate inventory for products that track inventory
        await db.inventory.clear();
        const now = new Date().toISOString();
        for (const product of data.products) {
          if (product.trackInventory && product.id) {
            await db.inventory.add({
              productId: product.id,
              productName: product.name,
              currentStock: 50,
              lowStockThreshold: 10,
              unit: '份',
              lastUpdated: now,
            });
          }
        }
      }
    }
  );
}

export async function resetAllData(): Promise<void> {
  await db.delete();
  window.location.reload();
}

export function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
