import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { db } from '../../db/database';
import type { IngredientCategory, InventoryTransaction } from '../../db/types';
import Modal from '../../components/ui/Modal';
import { IconClipboard, IconDownload, IconPackage, IconUpload, IconWarning } from '../../components/ui/Icons';
import {
  adjustIngredientStock,
  createIngredient,
  getTransactionHistory,
  restockIngredient,
  updateIngredient,
  wasteIngredient,
} from '../../services/inventoryService';
import { useAppSettingsStore } from '../../stores/useAppSettingsStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatPrice } from '../../utils/currency';
import { formatDateTime } from '../../utils/date';
import {
  buildPurchaseSuggestions,
  formatInventoryQuantity,
  formatPurchaseListText,
  summarizePurchaseSuggestions,
} from '../../utils/inventory';
import { INVENTORY_TRANSACTION_LABELS } from '../../utils/constants';

type FilterType = 'all' | 'low' | 'out' | 'cost';
type InventoryAction = 'restock' | 'adjust' | 'waste';

interface IngredientRow {
  ingredientId: number;
  ingredientName: string;
  currentStock: number;
  lowStockThreshold: number;
  unit: string;
  costPerUnit: number;
  costPerServing: number;
  supplier: string;
  ingredientCategory: IngredientCategory;
  notes: string;
}

export default function InventoryPage() {
  const { currentEmployee } = useAuthStore();
  const currency = useAppSettingsStore((state) => state.settings.currency);
  const defaultLowStockThreshold = useAppSettingsStore(
    (state) => state.settings.lowStockDefaultThreshold
  );
  const storeName = useAppSettingsStore((state) => state.settings.storeName);
  const [filter, setFilter] = useState<FilterType>('all');
  const [actionModal, setActionModal] = useState<{ row: IngredientRow; action: InventoryAction } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ ingredientId: number; ingredientName: string } | null>(null);
  const [ingredientModal, setIngredientModal] = useState<IngredientRow | null | 'create'>(null);
  const [purchaseListOpen, setPurchaseListOpen] = useState(false);
  const [history, setHistory] = useState<InventoryTransaction[]>([]);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const inventoryRows = useLiveQuery(async () => {
    const [ingredients, inventory] = await Promise.all([
      db.ingredients.filter((ingredient) => ingredient.isActive).sortBy('sortOrder'),
      db.inventory.toArray(),
    ]);

    const inventoryByIngredientId = new Map(
      inventory.map((record) => [record.ingredientId, record])
    );

    return ingredients.map((ingredient) => {
      const record = inventoryByIngredientId.get(ingredient.id!);
      return {
        ingredientId: ingredient.id!,
        ingredientName: ingredient.name,
        currentStock: record?.currentStock ?? 0,
        lowStockThreshold: record?.lowStockThreshold ?? ingredient.lowStockThreshold,
        unit: record?.unit ?? ingredient.unit,
        costPerUnit: ingredient.costPerUnit,
        costPerServing: ingredient.costPerServing,
        supplier: ingredient.supplier,
        ingredientCategory: ingredient.ingredientCategory,
        notes: ingredient.notes,
      } satisfies IngredientRow;
    });
  });

  const filteredRows = inventoryRows?.filter((row) => {
    if (filter === 'low') {
      return row.currentStock > 0 && row.currentStock <= row.lowStockThreshold;
    }
    if (filter === 'out') {
      return row.currentStock <= 0;
    }
    return true;
  });

  const lowCount = inventoryRows?.filter((row) => row.currentStock > 0 && row.currentStock <= row.lowStockThreshold).length || 0;
  const outCount = inventoryRows?.filter((row) => row.currentStock <= 0).length || 0;
  const purchaseSuggestions = useMemo(
    () => buildPurchaseSuggestions(inventoryRows ?? []),
    [inventoryRows]
  );
  const purchaseSummary = useMemo(
    () => summarizePurchaseSuggestions(purchaseSuggestions),
    [purchaseSuggestions]
  );

  const handleAction = async () => {
    if (!actionModal || !quantity) {
      return;
    }

    const qty = Number.parseFloat(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return;
    }

    const employeeId = currentEmployee?.id || 0;
    const { action, row } = actionModal;

    try {
      if (action === 'restock') {
        await restockIngredient(row.ingredientId, qty, employeeId, note || '進貨');
      } else if (action === 'adjust') {
        await adjustIngredientStock(row.ingredientId, qty, employeeId, note || '手動調整');
      } else {
        await wasteIngredient(row.ingredientId, qty, employeeId, note || '報廢');
      }

      setActionModal(null);
      setQuantity('');
      setNote('');
      toast.success('食材庫存已更新');
    } catch {
      toast.error('庫存操作失敗');
    }
  };

  const handleShowHistory = async (ingredientId: number, ingredientName: string) => {
    try {
      const transactionHistory = await getTransactionHistory(ingredientId);
      setHistory(transactionHistory);
      setHistoryModal({ ingredientId, ingredientName });
    } catch {
      toast.error('無法載入歷史記錄');
    }
  };

  const handleCopyPurchaseList = async () => {
    try {
      await navigator.clipboard.writeText(
        formatPurchaseListText({
          storeName,
          currency,
          suggestions: purchaseSuggestions,
        })
      );
      toast.success('採購清單已複製');
    } catch {
      toast.error('無法複製採購清單');
    }
  };

  const handleExportInventory = async () => {
    try {
      const [ingredients, inventory] = await Promise.all([
        db.ingredients.toArray(),
        db.inventory.toArray(),
      ]);
      const data = {
        version: 'inventory-v1',
        exportedAt: new Date().toISOString(),
        ingredients,
        inventory,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('庫存已匯出');
    } catch {
      toast.error('匯出失敗');
    }
  };

  const handleImportInventory = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('JSON 格式無效');
      }

      const ingredients = data.ingredients as Array<Record<string, unknown>> | undefined;
      const inventory = data.inventory as Array<Record<string, unknown>> | undefined;

      if (!ingredients?.length && !inventory?.length) {
        throw new Error('找不到庫存資料');
      }

      // Try API first — uses inventory-only endpoint to avoid touching menu data
      try {
        const { api } = await import('../../api/client');
        await api.post('/sync/inventory-import', {
          ingredients: ingredients ?? [],
          inventory: inventory ?? [],
        });
        const { pullFromServer } = await import('../../api/sync');
        await pullFromServer();
      } catch {
        // Fallback to local Dexie
        await db.transaction('rw', [db.ingredients, db.inventory], async () => {
          if (ingredients?.length) {
            await db.ingredients.clear();
            await db.ingredients.bulkPut(ingredients as unknown as Parameters<typeof db.ingredients.bulkPut>[0]);
          }
          if (inventory?.length) {
            await db.inventory.clear();
            await db.inventory.bulkPut(inventory as unknown as Parameters<typeof db.inventory.bulkPut>[0]);
          }
        });
      }

      toast.success('庫存已匯入');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '匯入失敗');
    }

    if (importRef.current) {
      importRef.current.value = '';
    }
  };

  const getStatusBadge = (row: IngredientRow) => {
    if (row.currentStock <= 0) {
      return <span className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 px-2 py-0.5 rounded-full text-xs font-medium">缺貨</span>;
    }
    if (row.currentStock <= row.lowStockThreshold) {
      return <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-2 py-0.5 rounded-full text-xs font-medium">低庫存</span>;
    }
    return <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 px-2 py-0.5 rounded-full text-xs font-medium">充足</span>;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="page-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-50 flex items-center gap-2">
              <IconPackage className="w-6 h-6 text-amber-500" /> 食材庫存
            </h1>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'all' ? 'bg-indigo-600 text-white shadow-md dark:bg-indigo-500' : 'bg-gray-100 text-gray-500 dark:bg-[#131c2e] dark:text-slate-400'}`}>
                全部 ({inventoryRows?.length || 0})
              </button>
              <button onClick={() => setFilter('low')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'low' ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-500 dark:bg-[#131c2e] dark:text-slate-400'}`}>
                低庫存 ({lowCount})
              </button>
              <button onClick={() => setFilter('out')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'out' ? 'bg-red-500 text-white shadow-md' : 'bg-gray-100 text-gray-500 dark:bg-[#131c2e] dark:text-slate-400'}`}>
                缺貨 ({outCount})
              </button>
              <button onClick={() => setFilter('cost')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'cost' ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 dark:bg-[#131c2e] dark:text-slate-400'}`}>
                成本分析
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleExportInventory} className="btn-secondary text-sm flex items-center gap-1.5">
              <IconUpload className="w-4 h-4" /> 匯出
            </button>
            <button onClick={() => importRef.current?.click()} className="btn-secondary text-sm flex items-center gap-1.5">
              <IconDownload className="w-4 h-4" /> 匯入
            </button>
            <input ref={importRef} type="file" accept=".json" onChange={handleImportInventory} className="hidden" />
            <button onClick={() => setIngredientModal('create')} className="btn-primary text-sm">
              + 新增食材
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {purchaseSuggestions.length > 0 && (
          <div className="grid gap-3 mb-4 lg:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))]">
            <div className="card p-4 border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <IconWarning className="w-4 h-4" />
                    補貨提醒
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-gray-800 dark:text-slate-50">
                    {purchaseSuggestions.length} 項食材需要補貨
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                    系統會以低庫存門檻的 2 倍作為建議安全庫存，協助快速產生採購清單。
                  </p>
                </div>
                <button
                  onClick={() => setPurchaseListOpen(true)}
                  className="btn-primary whitespace-nowrap"
                >
                  查看採購清單
                </button>
              </div>
            </div>

            <div className="card p-4">
              <p className="text-sm text-gray-500 dark:text-slate-400">建議採購量</p>
              <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-slate-50">
                {formatInventoryQuantity(purchaseSummary.totalSuggestedQuantity)}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                缺貨 {purchaseSummary.outOfStockCount} 項，低庫存 {purchaseSummary.lowStockCount} 項
              </p>
            </div>

            <div className="card p-4">
              <p className="text-sm text-gray-500 dark:text-slate-400">預估採購成本</p>
              <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-slate-50">
                {formatPrice(purchaseSummary.totalEstimatedCost)}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                依食材成本自動估算
              </p>
            </div>
          </div>
        )}

        {filter === 'cost' ? (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-slate-400">食材總數</p>
                <p className="text-2xl font-bold text-gray-800 dark:text-slate-50">{inventoryRows?.length ?? 0}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-slate-400">有供應商</p>
                <p className="text-2xl font-bold text-gray-800 dark:text-slate-50">{inventoryRows?.filter(r => r.supplier).length ?? 0}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-slate-400">庫存總價值</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(inventoryRows?.reduce((s, r) => s + r.costPerUnit * r.currentStock, 0) ?? 0)}</p>
              </div>
            </div>

            {(() => {
              const groups = new Map<string, { items: IngredientRow[]; totalCost: number }>();
              for (const row of inventoryRows ?? []) {
                const cat = row.ingredientCategory || '其他';
                if (!groups.has(cat)) groups.set(cat, { items: [], totalCost: 0 });
                const g = groups.get(cat)!;
                g.items.push(row);
                g.totalCost += row.costPerUnit * row.currentStock;
              }
              const sorted = Array.from(groups.entries()).sort((a, b) => b[1].totalCost - a[1].totalCost);

              return sorted.map(([category, group]) => (
                <div key={category} className="card overflow-hidden animate-slide-up">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-[#131c2e] border-b border-gray-200 dark:border-[#1e2d4a] flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${category === '醬料' ? 'bg-orange-500' : category === '主食' ? 'bg-blue-500' : category === '蛋白質' ? 'bg-red-500' : category === '飲品' ? 'bg-purple-500' : category === '蔬菜' ? 'bg-green-500' : category === '配料' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                      <h3 className="font-bold text-gray-800 dark:text-slate-50">{category}</h3>
                      <span className="text-xs text-gray-400">({group.items.length})</span>
                    </div>
                    <span className="text-sm font-medium text-gray-500 dark:text-slate-400">
                      庫存價值 {formatPrice(group.totalCost)}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-[#1e2d4a]">
                    {group.items.map((item) => (
                      <div key={item.ingredientId} className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-[#131c2e] transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-800 dark:text-slate-50 truncate">{item.ingredientName}</p>
                            {item.supplier && (
                              <span className="text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 px-2 py-0.5 rounded-full flex-shrink-0">{item.supplier}</span>
                            )}
                          </div>
                          {item.notes && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">{item.notes}</p>}
                        </div>
                        <div className="flex items-center gap-6 text-sm flex-shrink-0">
                          <div className="text-right">
                            <p className="text-gray-500 dark:text-slate-400">庫存</p>
                            <p className="font-medium text-gray-800 dark:text-slate-50">{item.currentStock} {item.unit}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-500 dark:text-slate-400">每份成本</p>
                            <p className="font-medium text-gray-800 dark:text-slate-50">{formatPrice(item.costPerServing)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        ) : !filteredRows?.length ? (
          <div className="text-center py-16 text-gray-400 dark:text-slate-500 animate-fade-in">
            <IconPackage className="w-12 h-12 mx-auto mb-3" />
            <p className="text-lg font-medium">目前沒有符合條件的食材</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRows.map((row, index) => (
              <div key={row.ingredientId} className={`card px-4 py-3 flex items-center justify-between animate-slide-up stagger-${Math.min(index + 1, 6)}`}>
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[72px]">
                    <p className={`text-2xl font-bold ${row.currentStock <= 0 ? 'text-red-600 dark:text-red-400' : row.currentStock <= row.lowStockThreshold ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {row.currentStock}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{row.unit}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-slate-50">{row.ingredientName}</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      低庫存門檻 {row.lowStockThreshold} {row.unit} · 成本 {row.costPerUnit.toLocaleString()} / {row.unit}
                    </p>
                  </div>

                  {getStatusBadge(row)}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setIngredientModal(row)} className="btn-secondary text-sm px-3 py-1.5">編輯</button>
                  <button onClick={() => handleShowHistory(row.ingredientId, row.ingredientName)} className="btn-secondary text-sm px-3 py-1.5">記錄</button>
                  <button onClick={() => setActionModal({ row, action: 'restock' })} className="btn-success text-sm px-3 py-1.5">進貨</button>
                  <button onClick={() => setActionModal({ row, action: 'adjust' })} className="btn-secondary text-sm px-3 py-1.5">調整</button>
                  <button onClick={() => {
                    if (window.confirm(`確定要將「${row.ingredientName}」標記為報廢？此操作將扣減庫存。`)) {
                      setActionModal({ row, action: 'waste' });
                    }
                  }} className="btn-warning text-sm px-3 py-1.5">報廢</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {actionModal && (
        <Modal open={true} onClose={() => setActionModal(null)} title={`${actionModal.action === 'restock' ? '進貨' : actionModal.action === 'adjust' ? '調整庫存' : '報廢'} - ${actionModal.row.ingredientName}`} size="sm">
          <div className="space-y-4">
            <div className="text-center bg-gray-50 dark:bg-[#131c2e] rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-slate-400">目前庫存</p>
              <p className="text-3xl font-bold text-gray-800 dark:text-slate-50">{actionModal.row.currentStock} {actionModal.row.unit}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">
                {actionModal.action === 'adjust' ? '調整後庫存' : '數量'}
              </label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="input-field text-lg"
                min={0}
                step="0.1"
                placeholder="請輸入數量"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">備註</label>
              <input value={note} onChange={(event) => setNote(event.target.value)} className="input-field" placeholder="例如：每日盤點" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setActionModal(null)} className="btn-secondary flex-1">取消</button>
              <button onClick={handleAction} disabled={!quantity} className="btn-primary flex-1">確認</button>
            </div>
          </div>
        </Modal>
      )}

      {historyModal && (
        <Modal open={true} onClose={() => setHistoryModal(null)} title={`${historyModal.ingredientName} - 異動記錄`} size="lg">
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {history.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-slate-500 py-8">尚無異動記錄</p>
            ) : (
              history.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#1e2d4a]">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      transaction.type === 'sale' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' :
                      transaction.type === 'restock' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' :
                      transaction.type === 'waste' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400' :
                      'bg-gray-100 text-gray-600 dark:bg-[#131c2e] dark:text-slate-400'
                    }`}>
                      {INVENTORY_TRANSACTION_LABELS[transaction.type]}
                    </span>
                    <div>
                      <span className={`font-semibold ${transaction.quantity > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {transaction.quantity > 0 ? '+' : ''}{transaction.quantity}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-slate-400 ml-2">
                        {transaction.previousStock} → {transaction.newStock}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 dark:text-slate-500">{formatDateTime(transaction.createdAt)}</p>
                    {transaction.note && <p className="text-xs text-gray-500 dark:text-slate-400">{transaction.note}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {purchaseListOpen && (
        <Modal
          open={true}
          onClose={() => setPurchaseListOpen(false)}
          title="低庫存採購清單"
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-gray-50 dark:bg-[#131c2e] px-4 py-3">
                <p className="text-xs text-gray-500 dark:text-slate-400">待補貨品項</p>
                <p className="mt-1 text-xl font-bold text-gray-800 dark:text-slate-50">
                  {purchaseSuggestions.length}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 dark:bg-[#131c2e] px-4 py-3">
                <p className="text-xs text-gray-500 dark:text-slate-400">建議採購量</p>
                <p className="mt-1 text-xl font-bold text-gray-800 dark:text-slate-50">
                  {formatInventoryQuantity(purchaseSummary.totalSuggestedQuantity)}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 dark:bg-[#131c2e] px-4 py-3">
                <p className="text-xs text-gray-500 dark:text-slate-400">預估採購成本</p>
                <p className="mt-1 text-xl font-bold text-gray-800 dark:text-slate-50">
                  {formatPrice(purchaseSummary.totalEstimatedCost)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCopyPurchaseList}
                className="btn-secondary flex items-center gap-1.5"
              >
                <IconClipboard className="w-4 h-4" />
                複製清單
              </button>
              <button
                onClick={() => {
                  setFilter('out');
                  setPurchaseListOpen(false);
                }}
                className="btn-secondary"
              >
                查看缺貨食材
              </button>
              <button
                onClick={() => {
                  setFilter('low');
                  setPurchaseListOpen(false);
                }}
                className="btn-secondary"
              >
                查看低庫存食材
              </button>
            </div>

            <div className="space-y-2 max-h-[55vh] overflow-auto">
              {purchaseSuggestions.map((suggestion) => (
                <div
                  key={suggestion.ingredientId}
                  className="rounded-2xl border border-gray-200 dark:border-[#1e2d4a] px-4 py-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-800 dark:text-slate-50">
                          {suggestion.ingredientName}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            suggestion.status === 'out'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
                          }`}
                        >
                          {suggestion.status === 'out' ? '缺貨' : '低庫存'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                        目前 {formatInventoryQuantity(suggestion.currentStock)} {suggestion.unit}
                        {' · '}
                        門檻 {formatInventoryQuantity(suggestion.lowStockThreshold)} {suggestion.unit}
                        {' · '}
                        建議補到 {formatInventoryQuantity(suggestion.recommendedTargetStock)} {suggestion.unit}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-sm text-gray-500 dark:text-slate-400">建議補貨</p>
                      <p className="text-lg font-bold text-gray-800 dark:text-slate-50">
                        {formatInventoryQuantity(suggestion.recommendedOrderQuantity)} {suggestion.unit}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        預估 {formatPrice(suggestion.estimatedCost)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {ingredientModal && (
        <IngredientFormModal
          ingredient={ingredientModal === 'create' ? null : ingredientModal}
          defaultLowStockThreshold={defaultLowStockThreshold}
          onClose={() => setIngredientModal(null)}
          onSave={async (input) => {
            if (ingredientModal === 'create') {
              await createIngredient(input);
              toast.success('食材已新增');
            } else if (ingredientModal) {
              await updateIngredient(ingredientModal.ingredientId, input);
              toast.success('食材已更新');
            }
            setIngredientModal(null);
          }}
        />
      )}
    </div>
  );
}

function IngredientFormModal({
  ingredient,
  defaultLowStockThreshold,
  onClose,
  onSave,
}: {
  ingredient: IngredientRow | null;
  defaultLowStockThreshold: number;
  onClose: () => void;
  onSave: (input: {
    name: string;
    unit: string;
    costPerUnit: number;
    costPerServing?: number;
    lowStockThreshold: number;
    currentStock: number;
    supplier?: string;
    ingredientCategory?: IngredientCategory;
    notes?: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(ingredient?.ingredientName || '');
  const [unit, setUnit] = useState(ingredient?.unit || '份');
  const [costPerUnit, setCostPerUnit] = useState(String(ingredient?.costPerUnit ?? 0));
  const [costPerServing, setCostPerServing] = useState(String(ingredient?.costPerServing ?? 0));
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(ingredient?.lowStockThreshold ?? defaultLowStockThreshold)
  );
  const [currentStock, setCurrentStock] = useState(String(ingredient?.currentStock ?? 0));
  const [supplier, setSupplier] = useState(ingredient?.supplier || '');
  const [ingredientCategory, setIngredientCategory] = useState<IngredientCategory>(ingredient?.ingredientCategory || '其他');
  const [notes, setNotes] = useState(ingredient?.notes || '');

  const handleSubmit = async () => {
    if (!name.trim()) {
      return;
    }

    await onSave({
      name: name.trim(),
      unit: unit.trim() || '份',
      costPerUnit: Number(costPerUnit) || 0,
      costPerServing: Number(costPerServing) || 0,
      lowStockThreshold: Number(lowStockThreshold) || 0,
      currentStock: Number(currentStock) || 0,
      supplier: supplier.trim(),
      ingredientCategory,
      notes: notes.trim(),
    });
  };

  return (
    <Modal open={true} onClose={onClose} title={ingredient ? '編輯食材' : '新增食材'} size="sm">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">食材名稱</label>
          <input value={name} onChange={(event) => setName(event.target.value)} className="input-field" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">單位</label>
            <input value={unit} onChange={(event) => setUnit(event.target.value)} className="input-field" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">單位成本</label>
            <input type="number" min={0} step="0.1" value={costPerUnit} onChange={(event) => setCostPerUnit(event.target.value)} className="input-field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">每份成本</label>
            <input type="number" min={0} step="0.1" value={costPerServing} onChange={(event) => setCostPerServing(event.target.value)} className="input-field" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">供應商</label>
            <input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="例: 青沄" className="input-field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">食材分類</label>
            <select value={ingredientCategory} onChange={(event) => setIngredientCategory(event.target.value as IngredientCategory)} className="input-field">
              <option value="醬料">醬料</option>
              <option value="主食">主食</option>
              <option value="蛋白質">蛋白質</option>
              <option value="飲品">飲品</option>
              <option value="蔬菜">蔬菜</option>
              <option value="配料">配料</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">低庫存門檻</label>
            <input type="number" min={0} step="0.1" value={lowStockThreshold} onChange={(event) => setLowStockThreshold(event.target.value)} className="input-field" />
            {!ingredient && (
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                預設值來自系統設定
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">目前庫存</label>
            <input type="number" min={0} step="0.1" value={currentStock} onChange={(event) => setCurrentStock(event.target.value)} className="input-field" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">備註</label>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="備註" className="input-field" />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button onClick={() => void handleSubmit()} className="btn-primary flex-1">儲存</button>
        </div>
      </div>
    </Modal>
  );
}
