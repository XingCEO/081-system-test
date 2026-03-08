// ==================== 分類 ====================
export interface Category {
  id?: number;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== 套餐子項 ====================
export interface ComboItem {
  productId: number;
  productName: string;
  quantity: number;
}

// ==================== 商品 ====================
export interface Product {
  id?: number;
  categoryId: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isActive: boolean;
  modifierGroupIds: number[];
  trackInventory: boolean;
  sortOrder: number;
  isCombo?: boolean;
  comboItems?: ComboItem[];
  createdAt: string;
  updatedAt: string;
}

// ==================== 食材 & BOM ====================
export interface Ingredient {
  id?: number;
  name: string;
  unit: string;
  costPerUnit: number;
  lowStockThreshold: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductRecipeItem {
  id?: number;
  productId: number;
  ingredientId: number;
  ingredientName: string;
  quantity: number;
}

// ==================== 修改群組 & 修改選項 ====================
export interface ModifierGroup {
  id?: number;
  name: string;
  required: boolean;
  multiSelect: boolean;
  maxSelections: number;
}

export interface Modifier {
  id?: number;
  groupId: number;
  name: string;
  price: number;
  isActive: boolean;
}

export interface SelectedModifier {
  modifierId: number;
  name: string;
  price: number;
}

// ==================== 桌位 ====================
export type TableStatus = 'available' | 'occupied' | 'cleaning' | 'reserved';
export type TableShape = 'square' | 'round' | 'rectangle';

export interface RestaurantTable {
  id?: number;
  number: string;
  name: string;
  capacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: TableShape;
  status: TableStatus;
  currentOrderId: number | null;
  floor: number;
  isActive: boolean;
}

// ==================== 訂單 ====================
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type OrderItemStatus = 'pending' | 'completed';

export interface Order {
  id?: number;
  orderNumber: string;
  tableId: number | null;
  tableName: string;
  status: OrderStatus;
  employeeId: number;
  employeeName: string;
  subtotal: number;
  discount: number;
  total: number;
  cashReceived: number;
  changeGiven: number;
  note: string;
  createdAt: string;
  completedAt: string;
}

// ==================== 訂單明細 ====================
export interface OrderItem {
  id?: number;
  orderId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  modifiers: SelectedModifier[];
  modifiersTotal: number;
  subtotal: number;
  note: string;
  itemStatus?: OrderItemStatus;
  isCombo?: boolean;
  comboItems?: ComboItem[];
}

// ==================== 員工 ====================
export type EmployeeRole = 'admin' | 'cashier' | 'kitchen';

export interface Employee {
  id?: number;
  username: string;
  pin: string;
  name: string;
  role: EmployeeRole;
  isActive: boolean;
  createdAt: string;
}

// ==================== 班次 ====================
export interface Shift {
  id?: number;
  employeeId: number;
  employeeName: string;
  startTime: string;
  endTime: string;
  totalOrders: number;
  totalRevenue: number;
}

// ==================== 庫存 ====================
export interface InventoryRecord {
  id?: number;
  ingredientId: number;
  ingredientName: string;
  currentStock: number;
  lowStockThreshold: number;
  unit: string;
  lastUpdated: string;
}

export type InventoryTransactionType = 'sale' | 'restock' | 'adjustment' | 'waste';

export interface InventoryTransaction {
  id?: number;
  ingredientId: number;
  ingredientName: string;
  type: InventoryTransactionType;
  quantity: number;
  previousStock: number;
  newStock: number;
  orderId: number | null;
  note: string;
  employeeId: number;
  createdAt: string;
}

// ==================== 每日摘要 ====================
export interface DailySummary {
  id?: number;
  date: string;
  totalOrders: number;
  totalRevenue: number;
  totalDiscount: number;
  averageOrderValue: number;
  topSellingItems: { productId: number; name: string; quantity: number }[];
  hourlyBreakdown: { hour: number; orders: number; revenue: number }[];
  createdAt: string;
}

// ==================== 同步佇列 ====================
export interface SyncQueueItem {
  id?: number;
  table: string;
  recordId: number;
  operation: 'create' | 'update' | 'delete';
  data: unknown;
  createdAt: string;
  synced: boolean;
}

// ==================== 設定 ====================
export interface AppSetting {
  key: string;
  value: unknown;
}

// ==================== 購物車 ====================
export interface CartItem {
  cartItemId: string;
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  modifiers: SelectedModifier[];
  modifiersTotal: number;
  note: string;
  isCombo?: boolean;
  comboItems?: ComboItem[];
}
