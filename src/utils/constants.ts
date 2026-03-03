export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '待處理',
  preparing: '製作中',
  ready: '已完成',
  completed: '已結帳',
  cancelled: '已取消',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-red-100 text-red-700',
  preparing: 'bg-amber-100 text-amber-700',
  ready: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-slate-100 text-slate-400',
};

export const TABLE_STATUS_LABELS: Record<string, string> = {
  available: '空桌',
  occupied: '用餐中',
  cleaning: '待清理',
  reserved: '已預約',
};

export const TABLE_STATUS_COLORS: Record<string, string> = {
  available: 'table-available',
  occupied: 'table-occupied',
  cleaning: 'table-cleaning',
  reserved: 'table-reserved',
};

export const ROLE_LABELS: Record<string, string> = {
  admin: '管理員',
  cashier: '收銀員',
  kitchen: '廚房',
};

export const CASH_DENOMINATIONS = [100, 500, 1000];

export const INVENTORY_TRANSACTION_LABELS: Record<string, string> = {
  sale: '銷售扣減',
  restock: '進貨',
  adjustment: '手動調整',
  waste: '報廢',
};
