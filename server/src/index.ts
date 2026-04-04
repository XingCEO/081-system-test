import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { rowToJs, jsToRow } from './db.js';
import { seedDatabase } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;

// S3: CORS 白名單
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Seed on first run
seedDatabase();

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// ==================== Helpers ====================
function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function allRows(table: string): unknown[] {
  return db.prepare(`SELECT * FROM ${table}`).all().map(r => rowToJs(r as Record<string, unknown>));
}

function getById(table: string, id: number): unknown {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  return row ? rowToJs(row as Record<string, unknown>) : null;
}

function getEmployeeById(id: number): unknown {
  const row = db.prepare('SELECT id, username, name, role, isActive, createdAt FROM employees WHERE id = ?').get(id);
  return row ? rowToJs(row as Record<string, unknown>) : null;
}

interface IngredientUsage {
  ingredientId: number;
  ingredientName: string;
  quantity: number;
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function mergeIngredientUsages(usages: IngredientUsage[]): IngredientUsage[] {
  const map = new Map<number, IngredientUsage>();

  for (const usage of usages) {
    const existing = map.get(usage.ingredientId);
    if (existing) {
      existing.quantity += usage.quantity;
      continue;
    }

    map.set(usage.ingredientId, { ...usage });
  }

  return Array.from(map.values());
}

function getSettingsRows(): Array<{ key: string; value: unknown }> {
  return db.prepare('SELECT * FROM settings').all().map((record) => {
    const row = record as { key: string; value: string };
    try {
      return { key: row.key, value: JSON.parse(row.value) };
    } catch {
      return { key: row.key, value: row.value };
    }
  });
}

function getSyncExportData() {
  return {
    categories: allRows('categories'),
    products: allRows('products'),
    ingredients: allRows('ingredients'),
    productRecipes: allRows('product_recipes'),
    modifierRecipes: allRows('modifier_recipes'),
    modifierGroups: allRows('modifier_groups'),
    modifiers: allRows('modifiers'),
    diningTables: allRows('dining_tables'),
    orders: allRows('orders'),
    orderItems: allRows('order_items'),
    employees: db.prepare('SELECT id, username, name, role, isActive, createdAt FROM employees').all().map(r => rowToJs(r as Record<string, unknown>)),
    shifts: allRows('shifts'),
    inventory: allRows('inventory'),
    inventoryTransactions: allRows('inventory_transactions'),
    dailySummaries: allRows('daily_summaries'),
    settings: getSettingsRows(),
  };
}

function getProductIngredientUsage(productId: number, multiplier = 1): IngredientUsage[] {
  const product = db.prepare(
    'SELECT id, trackInventory, isCombo, comboItems FROM products WHERE id = ?'
  ).get(productId) as Record<string, unknown> | undefined;

  if (!product || product.trackInventory !== 1) {
    return [];
  }

  if (product.isCombo === 1) {
    const comboItems = parseJsonArray<{ productId: number; quantity: number }>(product.comboItems);
    return mergeIngredientUsages(
      comboItems.flatMap((item) =>
        getProductIngredientUsage(item.productId, item.quantity * multiplier)
      )
    );
  }

  const recipes = db.prepare(
    'SELECT ingredientId, ingredientName, quantity FROM product_recipes WHERE productId = ?'
  ).all(productId) as Array<Record<string, unknown>>;

  return recipes.map((recipe) => ({
    ingredientId: recipe.ingredientId as number,
    ingredientName: recipe.ingredientName as string,
    quantity: (recipe.quantity as number) * multiplier,
  }));
}

function getModifierIngredientUsage(modifierId: number, multiplier = 1): IngredientUsage[] {
  const recipes = db.prepare(
    'SELECT ingredientId, ingredientName, quantity FROM modifier_recipes WHERE modifierId = ?'
  ).all(modifierId) as Array<Record<string, unknown>>;

  return recipes.map((recipe) => ({
    ingredientId: recipe.ingredientId as number,
    ingredientName: recipe.ingredientName as string,
    quantity: (recipe.quantity as number) * multiplier,
  }));
}

function getOrderIngredientUsage(items: Array<Record<string, unknown>>): IngredientUsage[] {
  const usages = items.flatMap((item) => {
    const quantity = Number(item.quantity ?? 1);
    const isCombo = item.isCombo === 1 || item.isCombo === true;
    const itemUsages: IngredientUsage[] = [];

    if (isCombo) {
      const comboItems = parseJsonArray<{ productId: number; quantity: number }>(item.comboItems);
      itemUsages.push(
        ...mergeIngredientUsages(
          comboItems.flatMap((comboItem) =>
            getProductIngredientUsage(comboItem.productId, comboItem.quantity * quantity)
          )
        )
      );
    } else {
      itemUsages.push(...getProductIngredientUsage(Number(item.productId), quantity));
    }

    // Include modifier recipes
    const modifiers = parseJsonArray<{ modifierId: number }>(item.modifiers);
    for (const mod of modifiers) {
      if (mod.modifierId) {
        itemUsages.push(...getModifierIngredientUsage(mod.modifierId, quantity));
      }
    }

    return itemUsages;
  });

  return mergeIngredientUsages(usages);
}

function applyInventoryUsageChanges(params: {
  usages: IngredientUsage[];
  employeeId: number;
  orderId: number | null;
  note: string;
  restore?: boolean;
  type?: 'sale' | 'restock' | 'adjustment' | 'waste';
}): void {
  const now = new Date().toISOString();
  const usages = mergeIngredientUsages(params.usages);

  for (const usage of usages) {
    const inv = db.prepare('SELECT * FROM inventory WHERE ingredientId = ?').get(usage.ingredientId) as Record<string, unknown> | undefined;
    if (!inv) {
      continue;
    }

    const previousStock = inv.currentStock as number;
    const quantityDelta = params.restore ? usage.quantity : -usage.quantity;
    const newStock = params.restore
      ? previousStock + usage.quantity
      : Math.max(0, previousStock - usage.quantity);

    db.prepare('UPDATE inventory SET currentStock = ?, lastUpdated = ? WHERE ingredientId = ?')
      .run(newStock, now, usage.ingredientId);
    db.prepare(
      `INSERT INTO inventory_transactions (ingredientId, ingredientName, type, quantity, previousStock, newStock, orderId, note, employeeId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      usage.ingredientId,
      usage.ingredientName,
      params.type ?? (params.restore ? 'restock' : 'sale'),
      quantityDelta,
      previousStock,
      newStock,
      params.orderId,
      params.note,
      params.employeeId,
      now
    );
  }
}

function importSyncData(
  data: Record<string, unknown>,
  options: { menuOnly?: boolean } = {}
): void {
  const tablesToClear = options.menuOnly
    ? ['inventory', 'modifier_recipes', 'product_recipes', 'ingredients', 'modifiers', 'modifier_groups', 'products', 'categories']
    : ['settings', 'inventory_transactions', 'inventory', 'shifts', 'employees',
        'order_items', 'orders', 'dining_tables', 'modifier_recipes', 'modifiers', 'modifier_groups',
        'product_recipes', 'ingredients', 'products', 'categories', 'daily_summaries'];

  const insertWithId = (table: string, columns: string[], rows: Array<Record<string, unknown>>) => {
    if (!rows?.length) return;
    const placeholders = columns.map(() => '?').join(',');
    const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`);
    for (const row of rows) {
      const converted = jsToRow(row);
      stmt.run(...columns.map(c => converted[c] ?? null));
    }
  };

  db.transaction(() => {
    for (const table of tablesToClear) {
      db.prepare(`DELETE FROM ${table}`).run();
    }

    if (data.categories) insertWithId('categories', ['id', 'name', 'description', 'sortOrder', 'isActive', 'icon', 'color', 'createdAt', 'updatedAt'], data.categories as Array<Record<string, unknown>>);
    if (data.products) insertWithId('products', ['id', 'categoryId', 'name', 'description', 'price', 'imageUrl', 'isActive', 'modifierGroupIds', 'trackInventory', 'sortOrder', 'isCombo', 'comboItems', 'createdAt', 'updatedAt'], data.products as Array<Record<string, unknown>>);
    if (data.ingredients) insertWithId('ingredients', ['id', 'name', 'unit', 'costPerUnit', 'costPerServing', 'lowStockThreshold', 'isActive', 'sortOrder', 'supplier', 'ingredientCategory', 'notes', 'createdAt', 'updatedAt'], data.ingredients as Array<Record<string, unknown>>);
    if (data.productRecipes) insertWithId('product_recipes', ['id', 'productId', 'ingredientId', 'ingredientName', 'quantity'], data.productRecipes as Array<Record<string, unknown>>);
    if (data.modifierRecipes) insertWithId('modifier_recipes', ['id', 'modifierId', 'ingredientId', 'ingredientName', 'quantity'], data.modifierRecipes as Array<Record<string, unknown>>);
    if (data.modifierGroups) insertWithId('modifier_groups', ['id', 'name', 'required', 'multiSelect', 'maxSelections'], data.modifierGroups as Array<Record<string, unknown>>);
    if (data.modifiers) insertWithId('modifiers', ['id', 'groupId', 'name', 'price', 'isActive'], data.modifiers as Array<Record<string, unknown>>);
    if (!options.menuOnly && data.diningTables) insertWithId('dining_tables', ['id', 'number', 'name', 'capacity', 'x', 'y', 'width', 'height', 'shape', 'status', 'currentOrderId', 'floor', 'isActive'], data.diningTables as Array<Record<string, unknown>>);
    if (!options.menuOnly && data.orders) insertWithId('orders', ['id', 'orderNumber', 'tableId', 'tableName', 'status', 'employeeId', 'employeeName', 'subtotal', 'discount', 'total', 'cashReceived', 'changeGiven', 'note', 'createdAt', 'completedAt'], data.orders as Array<Record<string, unknown>>);
    if (!options.menuOnly && data.orderItems) insertWithId('order_items', ['id', 'orderId', 'productId', 'productName', 'quantity', 'unitPrice', 'modifiers', 'modifiersTotal', 'subtotal', 'note', 'itemStatus', 'isCombo', 'comboItems'], data.orderItems as Array<Record<string, unknown>>);
    if (!options.menuOnly && data.employees) insertWithId('employees', ['id', 'username', 'pin', 'name', 'role', 'isActive', 'createdAt'], data.employees as Array<Record<string, unknown>>);
    if (!options.menuOnly && data.shifts) insertWithId('shifts', ['id', 'employeeId', 'employeeName', 'startTime', 'endTime', 'totalOrders', 'totalRevenue'], data.shifts as Array<Record<string, unknown>>);
    if (data.inventory) insertWithId('inventory', ['id', 'ingredientId', 'ingredientName', 'currentStock', 'lowStockThreshold', 'unit', 'lastUpdated'], data.inventory as Array<Record<string, unknown>>);
    if (!options.menuOnly && data.inventoryTransactions) insertWithId('inventory_transactions', ['id', 'ingredientId', 'ingredientName', 'type', 'quantity', 'previousStock', 'newStock', 'orderId', 'note', 'employeeId', 'createdAt'], data.inventoryTransactions as Array<Record<string, unknown>>);
    if (!options.menuOnly && data.dailySummaries) insertWithId('daily_summaries', ['id', 'date', 'totalOrders', 'totalRevenue', 'totalDiscount', 'averageOrderValue', 'topSellingItems', 'hourlyBreakdown', 'createdAt'], data.dailySummaries as Array<Record<string, unknown>>);

    if (!options.menuOnly && data.settings) {
      const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      for (const setting of data.settings as Array<{ key: string; value: unknown }>) {
        upsert.run(setting.key, typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value));
      }
    }
  })();
}

// ==================== AUTH ====================
app.post('/api/auth/login', (req, res) => {
  const { employeeId, pin } = req.body;
  if (!pin) { res.status(400).json({ error: '請輸入 PIN 碼' }); return; }
  const employee = db.prepare('SELECT * FROM employees WHERE id = ? AND isActive = 1').get(employeeId) as Record<string, unknown> | undefined;
  if (!employee) { res.status(401).json({ error: '找不到員工' }); return; }

  const pinHash = hashPin(pin);
  if (employee.pin !== pinHash) { res.status(401).json({ error: 'PIN 碼錯誤' }); return; }

  const now = new Date().toISOString();
  const result = db.prepare(
    'INSERT INTO shifts (employeeId, employeeName, startTime, endTime, totalOrders, totalRevenue) VALUES (?, ?, ?, \'\', 0, 0)'
  ).run(employeeId, employee.name, now);

  // Strip pin hash from response
  const safeEmployee = rowToJs(employee);
  delete safeEmployee.pin;
  res.json({
    employee: safeEmployee,
    shiftId: Number(result.lastInsertRowid),
  });
});

app.post('/api/auth/logout', (req, res) => {
  const { shiftId } = req.body;
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId) as Record<string, unknown> | undefined;
  if (!shift) { res.status(404).json({ error: '找不到班次' }); return; }

  const now = new Date().toISOString();
  const orders = db.prepare(
    `SELECT * FROM orders WHERE employeeId = ? AND status = 'completed' AND createdAt >= ? AND createdAt <= ?`
  ).all(shift.employeeId, shift.startTime, now) as Array<Record<string, unknown>>;

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total as number), 0);

  db.prepare('UPDATE shifts SET endTime = ?, totalOrders = ?, totalRevenue = ? WHERE id = ?')
    .run(now, totalOrders, totalRevenue, shiftId);

  res.json({ success: true });
});

// ==================== CATEGORIES ====================
app.get('/api/categories', (_req, res) => {
  res.json(allRows('categories'));
});

app.post('/api/categories', (req, res) => {
  const data = jsToRow(req.body);
  const now = new Date().toISOString();
  const result = db.prepare(
    'INSERT INTO categories (name, description, sortOrder, isActive, icon, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(data.name, data.description ?? '', data.sortOrder ?? 0, data.isActive ?? 1, data.icon ?? 'restaurant', data.color ?? '', now, now);
  res.json(getById('categories', Number(result.lastInsertRowid)));
});

app.put('/api/categories/:id', (req, res) => {
  const data = jsToRow(req.body);
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE categories SET name=?, description=?, sortOrder=?, isActive=?, icon=?, color=?, updatedAt=? WHERE id=?'
  ).run(data.name, data.description ?? '', data.sortOrder ?? 0, data.isActive ?? 1, data.icon ?? 'restaurant', data.color ?? '', now, Number(req.params.id));
  res.json(getById('categories', Number(req.params.id)));
});

app.delete('/api/categories/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(Number(req.params.id));
  res.json({ success: true });
});

// ==================== PRODUCTS ====================
app.get('/api/products', (_req, res) => {
  res.json(allRows('products'));
});

app.get('/api/products/availability', (_req, res) => {
  const products = db.prepare('SELECT id FROM products WHERE isActive = 1').all() as Array<{ id: number }>;
  const inventoryRows = db.prepare('SELECT * FROM inventory').all() as Array<Record<string, unknown>>;
  const inventoryByIngredientId = new Map<number, { currentStock: number }>();

  for (const inventory of inventoryRows) {
    inventoryByIngredientId.set(inventory.ingredientId as number, {
      currentStock: inventory.currentStock as number,
    });
  }

  const result: Record<number, { availableQuantity: number | null; isSoldOut: boolean; isLowStock: boolean }> = {};

  for (const product of products) {
    const usage = getProductIngredientUsage(product.id);
    if (usage.length === 0) {
      result[product.id] = { availableQuantity: null, isSoldOut: false, isLowStock: false };
      continue;
    }

    const availableQuantity = usage.reduce<number>((lowest, item) => {
      const inventory = inventoryByIngredientId.get(item.ingredientId);
      if (!inventory) {
        return 0;
      }

      const servings = item.quantity <= 0
        ? Number.POSITIVE_INFINITY
        : Math.floor(inventory.currentStock / item.quantity);
      return Math.min(lowest, servings);
    }, Number.POSITIVE_INFINITY);

    const normalizedAvailability =
      availableQuantity === Number.POSITIVE_INFINITY ? null : availableQuantity;

    result[product.id] = {
      availableQuantity: normalizedAvailability,
      isSoldOut: normalizedAvailability !== null && normalizedAvailability <= 0,
      isLowStock: normalizedAvailability !== null && normalizedAvailability > 0 && normalizedAvailability <= 5,
    };
  }

  res.json(result);
});

app.get('/api/products/:id', (req, res) => {
  const product = getById('products', Number(req.params.id));
  if (!product) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(product);
});

app.post('/api/products', (req, res) => {
  const data = jsToRow(req.body);
  const now = new Date().toISOString();
  const result = db.prepare(
    `INSERT INTO products (categoryId, name, description, price, imageUrl, isActive, modifierGroupIds, trackInventory, sortOrder, isCombo, comboPickCount, comboItems, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    data.categoryId, data.name, data.description ?? '', data.price, data.imageUrl ?? '',
    data.isActive ?? 1, data.modifierGroupIds ?? '[]', data.trackInventory ?? 0,
    data.sortOrder ?? 0, data.isCombo ?? 0, data.comboPickCount ?? 0, data.comboItems ?? '[]', now, now
  );
  res.json(getById('products', Number(result.lastInsertRowid)));
});

app.put('/api/products/:id', (req, res) => {
  const data = jsToRow(req.body);
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE products SET categoryId=?, name=?, description=?, price=?, imageUrl=?, isActive=?, modifierGroupIds=?, trackInventory=?, sortOrder=?, isCombo=?, comboPickCount=?, comboItems=?, updatedAt=? WHERE id=?`
  ).run(
    data.categoryId, data.name, data.description ?? '', data.price, data.imageUrl ?? '',
    data.isActive ?? 1, data.modifierGroupIds ?? '[]', data.trackInventory ?? 0,
    data.sortOrder ?? 0, data.isCombo ?? 0, data.comboPickCount ?? 0, data.comboItems ?? '[]', now, Number(req.params.id)
  );
  res.json(getById('products', Number(req.params.id)));
});

app.delete('/api/products/:id', (req, res) => {
  const productId = Number(req.params.id);
  db.prepare('DELETE FROM product_recipes WHERE productId = ?').run(productId);
  db.prepare('DELETE FROM products WHERE id = ?').run(productId);
  res.json({ success: true });
});

// ==================== MODIFIER GROUPS ====================
app.get('/api/modifier-groups', (_req, res) => {
  const groups = allRows('modifier_groups');
  res.json(groups);
});

app.get('/api/modifiers', (req, res) => {
  const groupId = req.query.groupId;
  if (groupId) {
    const rows = db.prepare('SELECT * FROM modifiers WHERE groupId = ?').all(groupId).map(r => rowToJs(r as Record<string, unknown>));
    res.json(rows);
  } else {
    res.json(allRows('modifiers'));
  }
});

app.post('/api/modifier-groups', (req, res) => {
  const { group, modifiers: mods } = req.body;
  const groupData = jsToRow(group);

  const txn = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO modifier_groups (name, required, multiSelect, maxSelections) VALUES (?, ?, ?, ?)'
    ).run(groupData.name, groupData.required, groupData.multiSelect, groupData.maxSelections);
    const groupId = Number(result.lastInsertRowid);

    const insertMod = db.prepare(
      'INSERT INTO modifiers (groupId, name, price, isActive) VALUES (?, ?, ?, ?)'
    );
    for (const mod of (mods ?? [])) {
      const m = jsToRow(mod);
      insertMod.run(groupId, m.name, m.price ?? 0, m.isActive ?? 1);
    }

    return groupId;
  });

  const groupId = txn();
  res.json({ id: groupId, ...getById('modifier_groups', groupId) as object });
});

app.put('/api/modifier-groups/:id', (req, res) => {
  const groupId = Number(req.params.id);
  const { group, modifiers: mods } = req.body;
  const groupData = jsToRow(group);

  db.transaction(() => {
    db.prepare('UPDATE modifier_groups SET name=?, required=?, multiSelect=?, maxSelections=? WHERE id=?')
      .run(groupData.name, groupData.required, groupData.multiSelect, groupData.maxSelections, groupId);

    // Delete existing modifiers, re-insert
    db.prepare('DELETE FROM modifiers WHERE groupId = ?').run(groupId);
    const insertMod = db.prepare(
      'INSERT INTO modifiers (groupId, name, price, isActive) VALUES (?, ?, ?, ?)'
    );
    for (const mod of (mods ?? [])) {
      const m = jsToRow(mod);
      insertMod.run(groupId, m.name, m.price ?? 0, m.isActive ?? 1);
    }
  })();

  res.json(getById('modifier_groups', groupId));
});

app.delete('/api/modifier-groups/:id', (req, res) => {
  const groupId = Number(req.params.id);
  db.transaction(() => {
    db.prepare('DELETE FROM modifiers WHERE groupId = ?').run(groupId);
    // Remove from products' modifierGroupIds
    const products = db.prepare('SELECT id, modifierGroupIds FROM products').all() as Array<{ id: number; modifierGroupIds: string }>;
    const updateProduct = db.prepare('UPDATE products SET modifierGroupIds = ? WHERE id = ?');
    for (const p of products) {
      try {
        const ids: number[] = JSON.parse(p.modifierGroupIds);
        const filtered = ids.filter(id => id !== groupId);
        if (filtered.length !== ids.length) {
          updateProduct.run(JSON.stringify(filtered), p.id);
        }
      } catch { /* skip */ }
    }
    db.prepare('DELETE FROM modifier_groups WHERE id = ?').run(groupId);
  })();
  res.json({ success: true });
});

// ==================== MODIFIER RECIPES ====================
app.get('/api/modifier-recipes/:modifierId', (req, res) => {
  const modifierId = Number(req.params.modifierId);
  const rows = db.prepare('SELECT * FROM modifier_recipes WHERE modifierId = ?')
    .all(modifierId)
    .map(r => rowToJs(r as Record<string, unknown>));
  res.json(rows);
});

app.put('/api/modifier-recipes/:modifierId', (req, res) => {
  const modifierId = Number(req.params.modifierId);
  const recipes: Array<{ ingredientId: number; ingredientName: string; quantity: number }> = req.body;

  db.transaction(() => {
    db.prepare('DELETE FROM modifier_recipes WHERE modifierId = ?').run(modifierId);
    const stmt = db.prepare(
      'INSERT INTO modifier_recipes (modifierId, ingredientId, ingredientName, quantity) VALUES (?, ?, ?, ?)'
    );
    for (const recipe of recipes) {
      stmt.run(modifierId, recipe.ingredientId, recipe.ingredientName ?? '', recipe.quantity);
    }
  })();

  const rows = db.prepare('SELECT * FROM modifier_recipes WHERE modifierId = ?')
    .all(modifierId)
    .map(r => rowToJs(r as Record<string, unknown>));
  res.json(rows);
});

// ==================== ORDERS ====================
app.get('/api/orders', (_req, res) => {
  res.json(allRows('orders'));
});

app.get('/api/orders/today', (_req, res) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const rows = db.prepare('SELECT * FROM orders WHERE createdAt >= ? AND createdAt < ? ORDER BY createdAt DESC')
    .all(start, end).map(r => rowToJs(r as Record<string, unknown>));
  res.json(rows);
});

// 注意：此端點僅供前端預覽用，不保證唯一性。實際訂單編號在 POST /api/orders 的 transaction 中原子生成。
app.get('/api/orders/next-number', (_req, res) => {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const count = (db.prepare('SELECT COUNT(*) as c FROM orders WHERE createdAt >= ? AND createdAt < ?').get(start, end) as { c: number }).c;

  const prefix = db.prepare("SELECT value FROM settings WHERE key = 'orderNumberPrefix'").get() as { value: string } | undefined;
  let prefixStr = '';
  try { prefixStr = prefix?.value ? JSON.parse(prefix.value) : ''; } catch { /* empty */ }

  const num = String(count + 1).padStart(3, '0');
  const prefixPart = prefixStr ? `${prefixStr}-` : '';
  res.json({ orderNumber: `${prefixPart}${dateStr}-${num}` });
});

app.get('/api/orders/:id', (req, res) => {
  const order = getById('orders', Number(req.params.id));
  if (!order) { res.status(404).json({ error: 'Not found' }); return; }
  const items = db.prepare('SELECT * FROM order_items WHERE orderId = ?')
    .all(Number(req.params.id)).map(r => rowToJs(r as Record<string, unknown>));
  res.json({ order, items });
});

app.post('/api/orders', (req, res) => {
  const { order, items } = req.body;
  const orderData = jsToRow(order);

  const txn = db.transaction(() => {
    // 在 transaction 內原子生成訂單編號，避免 race condition
    const createdAt = (orderData.createdAt as string | undefined) ?? new Date().toISOString();
    const orderDate = new Date(createdAt);
    const dateStr = `${orderDate.getFullYear()}${String(orderDate.getMonth() + 1).padStart(2, '0')}${String(orderDate.getDate()).padStart(2, '0')}`;
    const dayStart = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate()).toISOString();
    const dayEnd = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate() + 1).toISOString();
    const todayCount = (db.prepare('SELECT COUNT(*) as c FROM orders WHERE createdAt >= ? AND createdAt < ?').get(dayStart, dayEnd) as { c: number }).c;
    const prefixRow = db.prepare("SELECT value FROM settings WHERE key = 'orderNumberPrefix'").get() as { value: string } | undefined;
    let prefixStr = '';
    try { prefixStr = prefixRow?.value ? JSON.parse(prefixRow.value) : ''; } catch { /* empty */ }
    const num = String(todayCount + 1).padStart(3, '0');
    const prefixPart = prefixStr ? `${prefixStr}-` : '';
    const orderNumber = `${prefixPart}${dateStr}-${num}`;

    const result = db.prepare(
      `INSERT INTO orders (orderNumber, tableId, tableName, status, employeeId, employeeName, subtotal, discount, total, cashReceived, changeGiven, note, createdAt, completedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderNumber, orderData.tableId, orderData.tableName ?? '',
      orderData.status ?? 'pending', orderData.employeeId, orderData.employeeName ?? '',
      orderData.subtotal ?? 0, orderData.discount ?? 0, orderData.total ?? 0,
      orderData.cashReceived ?? 0, orderData.changeGiven ?? 0, orderData.note ?? '',
      createdAt, orderData.completedAt ?? ''
    );
    const orderId = Number(result.lastInsertRowid);

    const insertItem = db.prepare(
      `INSERT INTO order_items (orderId, productId, productName, quantity, unitPrice, modifiers, modifiersTotal, subtotal, note, itemStatus, isCombo, comboItems)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const itemRows = (items ?? []).map((item: Record<string, unknown>) => jsToRow(item));
    for (const d of itemRows) {
      insertItem.run(
        orderId, d.productId, d.productName ?? '', d.quantity ?? 1, d.unitPrice ?? 0,
        d.modifiers ?? '[]', d.modifiersTotal ?? 0, d.subtotal ?? 0,
        d.note ?? '', d.itemStatus ?? 'pending', d.isCombo ?? 0, d.comboItems ?? '[]'
      );
    }

    const ingredientUsages = getOrderIngredientUsage(itemRows);
    if (ingredientUsages.length > 0) {
      applyInventoryUsageChanges({
        usages: ingredientUsages,
        employeeId: Number(orderData.employeeId ?? 0),
        orderId,
        note: `訂單 ${orderData.orderNumber ?? ''}`.trim(),
      });
    }

    // Update table status if dine-in
    if (orderData.tableId) {
      db.prepare('UPDATE dining_tables SET status = ?, currentOrderId = ? WHERE id = ?')
        .run('occupied', orderId, orderData.tableId);
    }

    return orderId;
  });

  const orderId = txn();
  const created = getById('orders', orderId);
  const createdItems = db.prepare('SELECT * FROM order_items WHERE orderId = ?')
    .all(orderId).map(r => rowToJs(r as Record<string, unknown>));
  res.json({ order: created, items: createdItems });
});

app.put('/api/orders/:id/status', (req, res) => {
  const orderId = Number(req.params.id);
  const { status } = req.body;
  const VALID_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
  if (!VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `無效的訂單狀態，必須是：${VALID_STATUSES.join(', ')}` });
    return;
  }
  const now = new Date().toISOString();

  db.transaction(() => {
    const completedAt = (status === 'completed' || status === 'cancelled') ? now : undefined;
    if (completedAt) {
      db.prepare('UPDATE orders SET status = ?, completedAt = ? WHERE id = ?').run(status, completedAt, orderId);
    } else {
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
    }

    // Update table when order is completed or cancelled
    if (status === 'completed' || status === 'cancelled') {
      const order = db.prepare('SELECT tableId FROM orders WHERE id = ?').get(orderId) as Record<string, unknown> | undefined;
      if (order?.tableId) {
        db.prepare('UPDATE dining_tables SET status = ?, currentOrderId = NULL WHERE id = ?')
          .run('cleaning', order.tableId);
      }
    }
  })();

  res.json(getById('orders', orderId));
});

app.post('/api/orders/:id/cancel', (req, res) => {
  const orderId = Number(req.params.id);
  const now = new Date().toISOString();

  // Idempotency guard: prevent double inventory restoration
  const existing = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as { status: string } | undefined;
  if (!existing) { res.status(404).json({ error: '找不到訂單' }); return; }
  if (existing.status === 'cancelled') { res.json({ success: true }); return; }

  db.transaction(() => {
    const items = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(orderId) as Array<Record<string, unknown>>;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown>;

    const ingredientUsages = getOrderIngredientUsage(items);
    if (ingredientUsages.length > 0) {
      applyInventoryUsageChanges({
        usages: ingredientUsages,
        employeeId: Number(order?.employeeId ?? 0),
        orderId,
        note: '訂單取消恢復庫存',
        restore: true,
      });
    }

    db.prepare('UPDATE orders SET status = ?, completedAt = ? WHERE id = ?').run('cancelled', now, orderId);

    if (order?.tableId) {
      db.prepare('UPDATE dining_tables SET status = ?, currentOrderId = NULL WHERE id = ?')
        .run('cleaning', order.tableId);
    }
  })();

  res.json({ success: true });
});

app.delete('/api/orders/:id', (req, res) => {
  const orderId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown> | undefined;
  if (!existing) { res.status(404).json({ error: '找不到訂單' }); return; }

  db.transaction(() => {
    // Restore inventory if order was not already cancelled
    if (existing.status !== 'cancelled') {
      const items = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(orderId) as Array<Record<string, unknown>>;
      const ingredientUsages = getOrderIngredientUsage(items);
      if (ingredientUsages.length > 0) {
        applyInventoryUsageChanges({
          usages: ingredientUsages,
          employeeId: Number(existing.employeeId ?? 0),
          orderId,
          note: '刪除訂單恢復庫存',
          restore: true,
        });
      }
    }

    // Free up table if occupied by this order
    if (existing.tableId) {
      const table = db.prepare('SELECT currentOrderId FROM dining_tables WHERE id = ?').get(existing.tableId) as Record<string, unknown> | undefined;
      if (table && Number(table.currentOrderId) === orderId) {
        db.prepare('UPDATE dining_tables SET status = ?, currentOrderId = NULL WHERE id = ?')
          .run('available', existing.tableId);
      }
    }

    // Delete order items then order
    db.prepare('DELETE FROM order_items WHERE orderId = ?').run(orderId);
    db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
  })();

  res.json({ success: true });
});

app.put('/api/orders/:id', (req, res) => {
  const orderId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown> | undefined;
  if (!existing) { res.status(404).json({ error: '找不到訂單' }); return; }

  const { order: orderUpdates, items: newItems } = req.body;

  db.transaction(() => {
    // Restore inventory from old items (unless already cancelled)
    if (existing.status !== 'cancelled') {
      const oldItems = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(orderId) as Array<Record<string, unknown>>;
      const oldUsages = getOrderIngredientUsage(oldItems);
      if (oldUsages.length > 0) {
        applyInventoryUsageChanges({
          usages: oldUsages,
          employeeId: Number(existing.employeeId ?? 0),
          orderId,
          note: '修改訂單恢復庫存',
          restore: true,
        });
      }
    }

    // Update order fields
    if (orderUpdates) {
      const u = jsToRow(orderUpdates);
      const newTableId = u.tableId !== undefined ? u.tableId : existing.tableId;
      const newTableName = u.tableName !== undefined ? u.tableName : existing.tableName;

      // 處理桌位切換：釋放舊桌位，佔用新桌位
      if (newTableId !== existing.tableId) {
        // 釋放舊桌位
        if (existing.tableId) {
          const oldTable = db.prepare('SELECT currentOrderId FROM dining_tables WHERE id = ?').get(existing.tableId) as Record<string, unknown> | undefined;
          if (oldTable && Number(oldTable.currentOrderId) === orderId) {
            db.prepare('UPDATE dining_tables SET status = ?, currentOrderId = NULL WHERE id = ?')
              .run('available', existing.tableId);
          }
        }
        // 佔用新桌位
        if (newTableId) {
          db.prepare('UPDATE dining_tables SET status = ?, currentOrderId = ? WHERE id = ?')
            .run('occupied', orderId, newTableId);
        }
      }

      db.prepare(
        `UPDATE orders SET tableId=?, tableName=?, subtotal=?, discount=?, total=?,
         cashReceived=?, changeGiven=?, note=? WHERE id=?`
      ).run(
        newTableId ?? null,
        newTableName ?? existing.tableName,
        u.subtotal ?? existing.subtotal,
        u.discount ?? existing.discount,
        u.total ?? existing.total,
        u.cashReceived ?? existing.cashReceived,
        u.changeGiven ?? existing.changeGiven,
        u.note ?? existing.note,
        orderId
      );
    }

    // Replace order items
    if (newItems) {
      db.prepare('DELETE FROM order_items WHERE orderId = ?').run(orderId);
      const insertItem = db.prepare(
        `INSERT INTO order_items (orderId, productId, productName, quantity, unitPrice, modifiers, modifiersTotal, subtotal, note, itemStatus, isCombo, comboItems)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const itemRows = (newItems as Array<Record<string, unknown>>).map((item) => jsToRow(item));
      for (const d of itemRows) {
        insertItem.run(
          orderId, d.productId, d.productName ?? '', d.quantity ?? 1, d.unitPrice ?? 0,
          d.modifiers ?? '[]', d.modifiersTotal ?? 0, d.subtotal ?? 0,
          d.note ?? '', d.itemStatus ?? 'pending', d.isCombo ?? 0, d.comboItems ?? '[]'
        );
      }

      // Deduct inventory for new items (unless cancelled)
      if (existing.status !== 'cancelled') {
        const newUsages = getOrderIngredientUsage(itemRows);
        if (newUsages.length > 0) {
          applyInventoryUsageChanges({
            usages: newUsages,
            employeeId: Number(existing.employeeId ?? 0),
            orderId,
            note: `修改訂單 ${existing.orderNumber ?? ''}`.trim(),
          });
        }
      }
    }
  })();

  const updatedOrder = getById('orders', orderId);
  const updatedItems = db.prepare('SELECT * FROM order_items WHERE orderId = ?')
    .all(orderId).map(r => rowToJs(r as Record<string, unknown>));
  res.json({ order: updatedOrder, items: updatedItems });
});

app.put('/api/order-items/:id/status', (req, res) => {
  const itemId = Number(req.params.id);
  const { status } = req.body;
  db.prepare('UPDATE order_items SET itemStatus = ? WHERE id = ?').run(status, itemId);

  // Auto-advance order status
  const item = db.prepare('SELECT orderId FROM order_items WHERE id = ?').get(itemId) as Record<string, unknown> | undefined;
  if (item) {
    const orderId = item.orderId as number;
    const allItems = db.prepare('SELECT itemStatus FROM order_items WHERE orderId = ?').all(orderId) as Array<{ itemStatus: string }>;
    const allCompleted = allItems.every(i => i.itemStatus === 'completed');
    if (allCompleted) {
      const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as { status: string } | undefined;
      if (order?.status === 'preparing') {
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('ready', orderId);
      }
    }
    // If at least one item is completed and order is pending, move to preparing
    const anyCompleted = allItems.some(i => i.itemStatus === 'completed');
    if (anyCompleted) {
      const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as { status: string } | undefined;
      if (order?.status === 'pending') {
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('preparing', orderId);
      }
    }
  }

  res.json({ success: true });
});

// ==================== EMPLOYEES ====================
app.get('/api/employees', (_req, res) => {
  // Don't send pin hashes to client
  const rows = db.prepare('SELECT id, username, name, role, isActive, createdAt FROM employees').all()
    .map(r => rowToJs(r as Record<string, unknown>));
  res.json(rows);
});

app.get('/api/employees/:id', (req, res) => {
  const row = db.prepare('SELECT id, username, name, role, isActive, createdAt FROM employees WHERE id = ?')
    .get(Number(req.params.id));
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(rowToJs(row as Record<string, unknown>));
});

app.post('/api/employees', (req, res) => {
  const data = req.body;
  if (!data.pin || !data.username || !data.name) {
    res.status(400).json({ error: '缺少必要欄位' }); return;
  }
  const now = new Date().toISOString();
  const pinHashed = hashPin(data.pin);
  const result = db.prepare(
    'INSERT INTO employees (username, pin, name, role, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(data.username, pinHashed, data.name, data.role ?? 'cashier', data.isActive !== false ? 1 : 0, now);
  res.json(getEmployeeById(Number(result.lastInsertRowid)));
});

app.put('/api/employees/:id', (req, res) => {
  const data = req.body;
  const id = Number(req.params.id);
  if (data.pin) {
    db.prepare('UPDATE employees SET username=?, pin=?, name=?, role=?, isActive=? WHERE id=?')
      .run(data.username, hashPin(data.pin), data.name, data.role, data.isActive !== false ? 1 : 0, id);
  } else {
    db.prepare('UPDATE employees SET username=?, name=?, role=?, isActive=? WHERE id=?')
      .run(data.username, data.name, data.role, data.isActive !== false ? 1 : 0, id);
  }
  res.json(getEmployeeById(id));
});

app.delete('/api/employees/:id', (req, res) => {
  db.prepare('DELETE FROM employees WHERE id = ?').run(Number(req.params.id));
  res.json({ success: true });
});

// ==================== TABLES ====================
app.get('/api/tables', (_req, res) => {
  res.json(allRows('dining_tables'));
});

app.post('/api/tables', (req, res) => {
  const data = jsToRow(req.body);
  const result = db.prepare(
    `INSERT INTO dining_tables (number, name, capacity, x, y, width, height, shape, status, currentOrderId, floor, isActive)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    data.number, data.name ?? '', data.capacity ?? 4, data.x ?? 0, data.y ?? 0,
    data.width ?? 100, data.height ?? 100, data.shape ?? 'square',
    data.status ?? 'available', data.currentOrderId ?? null, data.floor ?? 1, data.isActive ?? 1
  );
  res.json(getById('dining_tables', Number(result.lastInsertRowid)));
});

app.put('/api/tables/:id', (req, res) => {
  const data = jsToRow(req.body);
  db.prepare(
    `UPDATE dining_tables SET number=?, name=?, capacity=?, x=?, y=?, width=?, height=?, shape=?, status=?, currentOrderId=?, floor=?, isActive=? WHERE id=?`
  ).run(
    data.number, data.name, data.capacity, data.x, data.y, data.width, data.height,
    data.shape, data.status, data.currentOrderId, data.floor, data.isActive, Number(req.params.id)
  );
  res.json(getById('dining_tables', Number(req.params.id)));
});

app.delete('/api/tables/:id', (req, res) => {
  db.prepare('DELETE FROM dining_tables WHERE id = ?').run(Number(req.params.id));
  res.json({ success: true });
});

// ==================== INGREDIENTS ====================
app.get('/api/ingredients', (_req, res) => {
  res.json(allRows('ingredients'));
});

app.post('/api/ingredients', (req, res) => {
  const data = jsToRow(req.body);
  const now = new Date().toISOString();
  const currentStock = Number(data.currentStock ?? 0);
  const count = (db.prepare('SELECT COUNT(*) as c FROM ingredients').get() as { c: number }).c;
  const result = db.prepare(
    `INSERT INTO ingredients (
      name, unit, costPerUnit, lowStockThreshold, supplier, costPerServing, ingredientCategory, notes, isActive, sortOrder, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
  ).run(
    data.name,
    data.unit ?? '份',
    data.costPerUnit ?? 0,
    data.lowStockThreshold ?? 10,
    data.supplier ?? '',
    data.costPerServing ?? 0,
    data.ingredientCategory ?? '其他',
    data.notes ?? '',
    count + 1,
    now,
    now
  );

  const ingId = Number(result.lastInsertRowid);
  db.prepare(
    'INSERT INTO inventory (ingredientId, ingredientName, currentStock, lowStockThreshold, unit, lastUpdated) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(ingId, data.name, currentStock, data.lowStockThreshold ?? 10, data.unit ?? '份', now);

  res.json(getById('ingredients', ingId));
});

app.put('/api/ingredients/:id', (req, res) => {
  const data = jsToRow(req.body);
  const now = new Date().toISOString();
  const id = Number(req.params.id);
  db.prepare(
    `UPDATE ingredients
      SET name=?, unit=?, costPerUnit=?, lowStockThreshold=?, supplier=?, costPerServing=?, ingredientCategory=?, notes=?, isActive=?, updatedAt=?
      WHERE id=?`
  ).run(
    data.name,
    data.unit,
    data.costPerUnit,
    data.lowStockThreshold,
    data.supplier ?? '',
    data.costPerServing ?? 0,
    data.ingredientCategory ?? '其他',
    data.notes ?? '',
    data.isActive ?? 1,
    now,
    id
  );

  // Sync inventory and recipes
  db.prepare('UPDATE inventory SET ingredientName=?, lowStockThreshold=?, unit=?, lastUpdated=? WHERE ingredientId=?')
    .run(data.name, data.lowStockThreshold, data.unit, now, id);
  // Only update currentStock if explicitly provided
  if (data.currentStock != null) {
    db.prepare('UPDATE inventory SET currentStock = ? WHERE ingredientId = ?')
      .run(data.currentStock, id);
  }
  db.prepare('UPDATE product_recipes SET ingredientName=? WHERE ingredientId=?')
    .run(data.name, id);

  res.json(getById('ingredients', id));
});

// ==================== INVENTORY ====================
app.get('/api/inventory', (_req, res) => {
  res.json(allRows('inventory'));
});

app.get('/api/inventory/low-stock', (_req, res) => {
  const rows = db.prepare('SELECT * FROM inventory WHERE currentStock <= lowStockThreshold')
    .all().map(r => rowToJs(r as Record<string, unknown>));
  res.json(rows);
});

app.post('/api/inventory/:ingredientId/restock', (req, res) => {
  const ingredientId = Number(req.params.ingredientId);
  const { quantity, employeeId, note } = req.body;
  const now = new Date().toISOString();

  const inv = db.prepare('SELECT * FROM inventory WHERE ingredientId = ?').get(ingredientId) as Record<string, unknown> | undefined;
  if (!inv) { res.status(404).json({ error: 'Not found' }); return; }

  const prevStock = inv.currentStock as number;
  const newStock = prevStock + quantity;

  db.prepare('UPDATE inventory SET currentStock = ?, lastUpdated = ? WHERE ingredientId = ?')
    .run(newStock, now, ingredientId);
  db.prepare(
    `INSERT INTO inventory_transactions (ingredientId, ingredientName, type, quantity, previousStock, newStock, orderId, note, employeeId, createdAt)
     VALUES (?, ?, 'restock', ?, ?, ?, NULL, ?, ?, ?)`
  ).run(ingredientId, inv.ingredientName, quantity, prevStock, newStock, note ?? '', employeeId, now);

  res.json({ success: true, newStock });
});

app.post('/api/inventory/:ingredientId/adjust', (req, res) => {
  const ingredientId = Number(req.params.ingredientId);
  const { newQuantity, employeeId, note } = req.body;
  const now = new Date().toISOString();

  const inv = db.prepare('SELECT * FROM inventory WHERE ingredientId = ?').get(ingredientId) as Record<string, unknown> | undefined;
  if (!inv) { res.status(404).json({ error: 'Not found' }); return; }

  const prevStock = inv.currentStock as number;
  const diff = newQuantity - prevStock;

  db.prepare('UPDATE inventory SET currentStock = ?, lastUpdated = ? WHERE ingredientId = ?')
    .run(newQuantity, now, ingredientId);
  db.prepare(
    `INSERT INTO inventory_transactions (ingredientId, ingredientName, type, quantity, previousStock, newStock, orderId, note, employeeId, createdAt)
     VALUES (?, ?, 'adjustment', ?, ?, ?, NULL, ?, ?, ?)`
  ).run(ingredientId, inv.ingredientName, diff, prevStock, newQuantity, note ?? '', employeeId, now);

  res.json({ success: true, newStock: newQuantity });
});

app.post('/api/inventory/:ingredientId/waste', (req, res) => {
  const ingredientId = Number(req.params.ingredientId);
  const { quantity, employeeId, note } = req.body;
  const now = new Date().toISOString();

  const inv = db.prepare('SELECT * FROM inventory WHERE ingredientId = ?').get(ingredientId) as Record<string, unknown> | undefined;
  if (!inv) { res.status(404).json({ error: 'Not found' }); return; }

  const prevStock = inv.currentStock as number;
  const newStock = Math.max(0, prevStock - quantity);

  db.prepare('UPDATE inventory SET currentStock = ?, lastUpdated = ? WHERE ingredientId = ?')
    .run(newStock, now, ingredientId);
  db.prepare(
    `INSERT INTO inventory_transactions (ingredientId, ingredientName, type, quantity, previousStock, newStock, orderId, note, employeeId, createdAt)
     VALUES (?, ?, 'waste', ?, ?, ?, NULL, ?, ?, ?)`
  ).run(ingredientId, inv.ingredientName, -quantity, prevStock, newStock, note ?? '', employeeId, now);

  res.json({ success: true, newStock });
});

app.put('/api/inventory/:ingredientId/threshold', (req, res) => {
  const ingredientId = Number(req.params.ingredientId);
  const { threshold } = req.body;
  db.prepare('UPDATE inventory SET lowStockThreshold = ? WHERE ingredientId = ?').run(threshold, ingredientId);
  db.prepare('UPDATE ingredients SET lowStockThreshold = ? WHERE id = ?').run(threshold, ingredientId);
  res.json({ success: true });
});

app.get('/api/inventory/:ingredientId/transactions', (req, res) => {
  const ingredientId = Number(req.params.ingredientId);
  const limit = Number(req.query.limit) || 50;
  const rows = db.prepare('SELECT * FROM inventory_transactions WHERE ingredientId = ? ORDER BY createdAt DESC LIMIT ?')
    .all(ingredientId, limit).map(r => rowToJs(r as Record<string, unknown>));
  res.json(rows);
});

// ==================== INVENTORY DEDUCTION (for orders) ====================
app.post('/api/inventory/deduct', (req, res) => {
  const { usages, employeeId, note, orderId, restore } = req.body;

  db.transaction(() => {
    applyInventoryUsageChanges({
      usages: (usages ?? []) as IngredientUsage[],
      employeeId: Number(employeeId ?? 0),
      orderId: typeof orderId === 'number' ? orderId : null,
      note: note ?? '',
      restore: restore === true,
    });
  })();

  res.json({ success: true });
});

// ==================== RECIPES ====================
app.get('/api/recipes/:productId', (req, res) => {
  const rows = db.prepare('SELECT * FROM product_recipes WHERE productId = ?')
    .all(Number(req.params.productId)).map(r => rowToJs(r as Record<string, unknown>));
  res.json(rows);
});

app.put('/api/recipes/:productId', (req, res) => {
  const productId = Number(req.params.productId);
  const { items } = req.body;

  db.transaction(() => {
    db.prepare('DELETE FROM product_recipes WHERE productId = ?').run(productId);
    const insert = db.prepare(
      'INSERT INTO product_recipes (productId, ingredientId, ingredientName, quantity) VALUES (?, ?, ?, ?)'
    );
    for (const item of (items ?? [])) {
      insert.run(productId, item.ingredientId, item.ingredientName ?? '', item.quantity);
    }
  })();

  res.json({ success: true });
});

// ==================== SETTINGS ====================
app.get('/api/settings', (_req, res) => {
  res.json(getSettingsRows());
});

app.put('/api/settings', (req, res) => {
  const updates = req.body;
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) {
      upsert.run(key, JSON.stringify(value));
    }
  })();
  res.json({ success: true });
});

// ==================== SHIFTS ====================
app.get('/api/shifts', (_req, res) => {
  res.json(allRows('shifts'));
});

// ==================== ANALYTICS ====================
app.get('/api/analytics', (req, res) => {
  const startDate = req.query.start as string | undefined;
  const endDate = req.query.end as string | undefined;

  if (!startDate || !endDate) {
    res.status(400).json({ error: '缺少日期參數，請提供 start 和 end' });
    return;
  }

  const orders = db.prepare(
    `SELECT * FROM orders WHERE status = 'completed' AND createdAt >= ? AND createdAt <= ?`
  ).all(startDate, endDate).map(r => rowToJs(r as Record<string, unknown>));

  // 若無訂單，直接回傳空結果（避免後續查詢 IN () 語法錯誤）
  if (orders.length === 0) {
    res.json({
      totalRevenue: 0,
      totalCost: 0,
      grossProfit: 0,
      grossMarginPercent: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      topItems: [],
      revenueByDay: [],
      hourlyBreakdown: [],
    });
    return;
  }

  // 一次性取得所有相關 order_items，避免 N+1 查詢
  const orderIds = orders.map(o => o.id as number);
  const placeholders = orderIds.map(() => '?').join(',');
  const allOrderItems = db.prepare(
    `SELECT * FROM order_items WHERE orderId IN (${placeholders})`
  ).all(...orderIds) as Array<Record<string, unknown>>;

  // 在記憶體中按 orderId 分組
  const itemsByOrderId = new Map<number, Array<Record<string, unknown>>>();
  for (const item of allOrderItems) {
    const oid = item.orderId as number;
    if (!itemsByOrderId.has(oid)) itemsByOrderId.set(oid, []);
    itemsByOrderId.get(oid)!.push(item);
  }

  let totalRevenue = 0;
  const revenueByDay: Record<string, { revenue: number; orders: number }> = {};
  const hourlyBreakdown: Record<number, { orders: number; revenue: number }> = {};
  const itemCounts: Record<string, { name: string; quantity: number; revenue: number }> = {};

  for (const order of orders) {
    const total = order.total as number;
    totalRevenue += total;

    const date = (order.createdAt as string).slice(0, 10);
    if (!revenueByDay[date]) {
      revenueByDay[date] = { revenue: 0, orders: 0 };
    }
    revenueByDay[date].revenue += total;
    revenueByDay[date].orders += 1;

    const hour = new Date(order.createdAt as string).getHours();
    if (!hourlyBreakdown[hour]) hourlyBreakdown[hour] = { orders: 0, revenue: 0 };
    hourlyBreakdown[hour].orders++;
    hourlyBreakdown[hour].revenue += total;

    const items = itemsByOrderId.get(order.id as number) ?? [];
    for (const item of items) {
      const key = String(item.productId);
      if (!itemCounts[key]) itemCounts[key] = { name: item.productName as string, quantity: 0, revenue: 0 };
      itemCounts[key].quantity += item.quantity as number;
      itemCounts[key].revenue += item.subtotal as number;
    }
  }

  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 10)
    .map(([productId, data]) => ({ productId: Number(productId), ...data }));

  // Calculate total food cost from BOM recipes
  let totalCost = 0;
  const allRecipes = db.prepare('SELECT productId, ingredientId, quantity FROM product_recipes').all() as Array<{ productId: number; ingredientId: number; quantity: number }>;
  const allIngredients = db.prepare('SELECT id, costPerServing FROM ingredients').all() as Array<{ id: number; costPerServing: number }>;
  const ingredientCostMap = new Map(allIngredients.map(i => [i.id, i.costPerServing]));
  const productCostMap = new Map<number, number>();
  for (const recipe of allRecipes) {
    const cost = (ingredientCostMap.get(recipe.ingredientId) ?? 0) * recipe.quantity;
    productCostMap.set(recipe.productId, (productCostMap.get(recipe.productId) ?? 0) + cost);
  }

  // 使用已分組的 order_items 計算食材成本（不再重複查詢）
  for (const order of orders) {
    const items = itemsByOrderId.get(order.id as number) ?? [];
    for (const item of items) {
      totalCost += (productCostMap.get(item.productId as number) ?? 0) * (item.quantity as number);
    }
  }

  const grossProfit = totalRevenue - totalCost;
  const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  res.json({
    totalRevenue,
    totalCost: Math.round(totalCost),
    grossProfit: Math.round(grossProfit),
    grossMarginPercent: Math.round(grossMarginPercent * 10) / 10,
    totalOrders: orders.length,
    averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
    topItems,
    revenueByDay: Object.entries(revenueByDay)
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([date, data]) => ({ date, revenue: data.revenue, orders: data.orders })),
    hourlyBreakdown: Object.entries(hourlyBreakdown)
      .sort((left, right) => Number(left[0]) - Number(right[0]))
      .map(([hour, data]) => ({ hour: Number(hour), ...data })),
  });
});

// ==================== SYNC / EXPORT / IMPORT ====================
app.get('/api/sync/export', (_req, res) => {
  res.json(getSyncExportData());
});

app.get('/api/sync/menu-export', (_req, res) => {
  const data = getSyncExportData();
  res.json({
    categories: data.categories,
    products: data.products,
    ingredients: data.ingredients,
    productRecipes: data.productRecipes,
    modifierGroups: data.modifierGroups,
    modifiers: data.modifiers,
    modifierRecipes: data.modifierRecipes,
    inventory: data.inventory,
  });
});

app.post('/api/sync/import', (req, res) => {
  importSyncData(req.body as Record<string, unknown>);

  res.json({ success: true });
});

app.post('/api/sync/menu-import', (req, res) => {
  importSyncData(req.body as Record<string, unknown>, { menuOnly: true });
  res.json({ success: true });
});

app.post('/api/sync/inventory-import', (req, res) => {
  const data = req.body as Record<string, unknown>;

  db.transaction(() => {
    // Only clear and re-populate ingredients + inventory tables
    db.prepare('DELETE FROM inventory').run();
    db.prepare('DELETE FROM ingredients').run();

    const ingredients = data.ingredients as Array<Record<string, unknown>> | undefined;
    const inventory = data.inventory as Array<Record<string, unknown>> | undefined;

    if (ingredients?.length) {
      const stmt = db.prepare(
        'INSERT INTO ingredients (id, name, unit, costPerUnit, costPerServing, lowStockThreshold, isActive, sortOrder, supplier, ingredientCategory, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const row of ingredients) {
        const r = jsToRow(row);
        stmt.run(r.id, r.name, r.unit ?? '份', r.costPerUnit ?? 0, r.costPerServing ?? 0, r.lowStockThreshold ?? 10, r.isActive ?? 1, r.sortOrder ?? 0, r.supplier ?? '', r.ingredientCategory ?? '其他', r.notes ?? '', r.createdAt, r.updatedAt);
      }
    }

    if (inventory?.length) {
      const stmt = db.prepare(
        'INSERT INTO inventory (id, ingredientId, ingredientName, currentStock, lowStockThreshold, unit, lastUpdated) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      for (const row of inventory) {
        const r = jsToRow(row);
        stmt.run(r.id, r.ingredientId, r.ingredientName, r.currentStock ?? 0, r.lowStockThreshold ?? 10, r.unit ?? '份', r.lastUpdated);
      }
    }
  })();

  res.json({ success: true });
});

app.post('/api/sync/reset', (_req, res) => {
  const tables = ['settings', 'inventory_transactions', 'inventory', 'shifts', 'employees',
    'order_items', 'orders', 'dining_tables', 'modifier_recipes', 'modifiers', 'modifier_groups',
    'product_recipes', 'ingredients', 'products', 'categories', 'daily_summaries'];

  db.transaction(() => {
    for (const table of tables) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
  })();

  // Re-seed
  seedDatabase();
  res.json({ success: true });
});

// ==================== DAILY SUMMARIES ====================
app.get('/api/daily-summaries', (_req, res) => {
  res.json(allRows('daily_summaries'));
});

app.post('/api/daily-summaries', (req, res) => {
  const data = jsToRow(req.body);
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM daily_summaries WHERE date = ?').get(data.date) as { id: number } | undefined;
  if (existing) {
    db.prepare(
      'UPDATE daily_summaries SET totalOrders=?, totalRevenue=?, totalDiscount=?, averageOrderValue=?, topSellingItems=?, hourlyBreakdown=?, createdAt=? WHERE id=?'
    ).run(data.totalOrders, data.totalRevenue, data.totalDiscount, data.averageOrderValue, data.topSellingItems, data.hourlyBreakdown, now, existing.id);
    res.json(getById('daily_summaries', existing.id));
  } else {
    const result = db.prepare(
      'INSERT INTO daily_summaries (date, totalOrders, totalRevenue, totalDiscount, averageOrderValue, topSellingItems, hourlyBreakdown, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(data.date, data.totalOrders ?? 0, data.totalRevenue ?? 0, data.totalDiscount ?? 0, data.averageOrderValue ?? 0, data.topSellingItems ?? '[]', data.hourlyBreakdown ?? '[]', now);
    res.json(getById('daily_summaries', Number(result.lastInsertRowid)));
  }
});

// ==================== Serve static in production ====================
const distPath = path.join(__dirname, '..', '..', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Global error handler — Express requires all 4 params to identify it as an error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: '伺服器內部錯誤' });
});

const server = app.listen(PORT, () => {
  console.log(`POS Server running on http://localhost:${PORT}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}, shutting down gracefully`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
