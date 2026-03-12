import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'pos.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ==================== Schema ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    sortOrder INTEGER DEFAULT 0,
    isActive INTEGER DEFAULT 1,
    icon TEXT DEFAULT 'restaurant',
    color TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoryId INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price REAL NOT NULL,
    imageUrl TEXT DEFAULT '',
    isActive INTEGER DEFAULT 1,
    modifierGroupIds TEXT DEFAULT '[]',
    trackInventory INTEGER DEFAULT 0,
    sortOrder INTEGER DEFAULT 0,
    isCombo INTEGER DEFAULT 0,
    comboItems TEXT DEFAULT '[]',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit TEXT DEFAULT '份',
    costPerUnit REAL DEFAULT 0,
    lowStockThreshold REAL DEFAULT 10,
    isActive INTEGER DEFAULT 1,
    sortOrder INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS product_recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    ingredientId INTEGER NOT NULL,
    ingredientName TEXT DEFAULT '',
    quantity REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS modifier_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    required INTEGER DEFAULT 0,
    multiSelect INTEGER DEFAULT 0,
    maxSelections INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS modifiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    groupId INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL DEFAULT 0,
    isActive INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS dining_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT NOT NULL,
    name TEXT DEFAULT '',
    capacity INTEGER DEFAULT 4,
    x REAL DEFAULT 0,
    y REAL DEFAULT 0,
    width REAL DEFAULT 100,
    height REAL DEFAULT 100,
    shape TEXT DEFAULT 'square',
    status TEXT DEFAULT 'available',
    currentOrderId INTEGER,
    floor INTEGER DEFAULT 1,
    isActive INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderNumber TEXT UNIQUE NOT NULL,
    tableId INTEGER,
    tableName TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    employeeId INTEGER NOT NULL,
    employeeName TEXT DEFAULT '',
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    cashReceived REAL DEFAULT 0,
    changeGiven REAL DEFAULT 0,
    note TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    completedAt TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    productName TEXT DEFAULT '',
    quantity INTEGER DEFAULT 1,
    unitPrice REAL DEFAULT 0,
    modifiers TEXT DEFAULT '[]',
    modifiersTotal REAL DEFAULT 0,
    subtotal REAL DEFAULT 0,
    note TEXT DEFAULT '',
    itemStatus TEXT DEFAULT 'pending',
    isCombo INTEGER DEFAULT 0,
    comboItems TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    pin TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'cashier',
    isActive INTEGER DEFAULT 1,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employeeId INTEGER NOT NULL,
    employeeName TEXT DEFAULT '',
    startTime TEXT NOT NULL,
    endTime TEXT DEFAULT '',
    totalOrders INTEGER DEFAULT 0,
    totalRevenue REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredientId INTEGER UNIQUE NOT NULL,
    ingredientName TEXT DEFAULT '',
    currentStock REAL DEFAULT 0,
    lowStockThreshold REAL DEFAULT 10,
    unit TEXT DEFAULT '份',
    lastUpdated TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredientId INTEGER NOT NULL,
    ingredientName TEXT DEFAULT '',
    type TEXT NOT NULL,
    quantity REAL NOT NULL,
    previousStock REAL DEFAULT 0,
    newStock REAL DEFAULT 0,
    orderId INTEGER,
    note TEXT DEFAULT '',
    employeeId INTEGER NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS daily_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    totalOrders INTEGER DEFAULT 0,
    totalRevenue REAL DEFAULT 0,
    totalDiscount REAL DEFAULT 0,
    averageOrderValue REAL DEFAULT 0,
    topSellingItems TEXT DEFAULT '[]',
    hourlyBreakdown TEXT DEFAULT '[]',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_products_category ON products(categoryId);
  CREATE INDEX IF NOT EXISTS idx_products_active ON products(isActive);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(createdAt);
  CREATE INDEX IF NOT EXISTS idx_orders_employee ON orders(employeeId);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(orderId);
  CREATE INDEX IF NOT EXISTS idx_modifiers_group ON modifiers(groupId);
  CREATE INDEX IF NOT EXISTS idx_inventory_ingredient ON inventory(ingredientId);
  CREATE INDEX IF NOT EXISTS idx_inv_trans_ingredient ON inventory_transactions(ingredientId);
  CREATE INDEX IF NOT EXISTS idx_recipes_product ON product_recipes(productId);
  CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shifts(employeeId);
`);

// ==================== Helpers ====================

// Convert SQLite row (integers for booleans, JSON strings) to JS object
export function rowToJs(row: Record<string, unknown>): Record<string, unknown> {
  if (!row) return row;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (['isActive', 'required', 'multiSelect', 'trackInventory', 'isCombo'].includes(key)) {
      result[key] = value === 1;
    } else if (['modifierGroupIds', 'comboItems', 'modifiers', 'topSellingItems', 'hourlyBreakdown'].includes(key)) {
      try {
        result[key] = typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        result[key] = [];
      }
    } else if (key === 'value' && typeof value === 'string') {
      // settings table — try parse, fallback to raw string
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Convert JS object to SQLite row (booleans to integers, arrays to JSON)
export function jsToRow(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'boolean') {
      result[key] = value ? 1 : 0;
    } else if (Array.isArray(value)) {
      result[key] = JSON.stringify(value);
    } else if (key === 'value' && typeof value !== 'string') {
      result[key] = JSON.stringify(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export default db;
