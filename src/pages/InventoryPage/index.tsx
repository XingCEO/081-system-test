import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { db } from '../../db/database';
import type { InventoryTransaction } from '../../db/types';
import Modal from '../../components/ui/Modal';
import { IconClipboard, IconPackage, IconWarning } from '../../components/ui/Icons';
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

type FilterType = 'all' | 'low' | 'out';
type InventoryAction = 'restock' | 'adjust' | 'waste';

interface IngredientRow {
  ingredientId: number;
  ingredientName: string;
  currentStock: number;
  lowStockThreshold: number;
  unit: string;
  costPerUnit: number;
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
  };

  const handleShowHistory = async (ingredientId: number, ingredientName: string) => {
    const transactionHistory = await getTransactionHistory(ingredientId);
    setHistory(transactionHistory);
    setHistoryModal({ ingredientId, ingredientName });
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
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <IconPackage className="w-6 h-6 text-amber-500" /> 食材庫存
            </h1>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'all' ? 'bg-blue-600 text-white shadow-md dark:bg-blue-500' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                全部 ({inventoryRows?.length || 0})
              </button>
              <button onClick={() => setFilter('low')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'low' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                低庫存 ({lowCount})
              </button>
              <button onClick={() => setFilter('out')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'out' ? 'bg-red-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                缺貨 ({outCount})
              </button>
            </div>
          </div>

          <button onClick={() => setIngredientModal('create')} className="btn-primary text-sm">
            + 新增食材
          </button>
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
                  <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                    {purchaseSuggestions.length} 項食材需要補貨
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
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
              <p className="text-sm text-slate-500 dark:text-slate-400">建議採購量</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {formatInventoryQuantity(purchaseSummary.totalSuggestedQuantity)}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                缺貨 {purchaseSummary.outOfStockCount} 項，低庫存 {purchaseSummary.lowStockCount} 項
              </p>
            </div>

            <div className="card p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">預估採購成本</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {formatPrice(purchaseSummary.totalEstimatedCost)}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                依食材單位成本自動估算
              </p>
            </div>
          </div>
        )}

        {!filteredRows?.length ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-600 animate-fade-in">
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
                    <p className="text-xs text-slate-400 dark:text-slate-500">{row.unit}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{row.ingredientName}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      低庫存門檻 {row.lowStockThreshold} {row.unit} · 成本 {row.costPerUnit.toLocaleString()} / {row.unit}
                    </p>
                  </div>

                  {getStatusBadge(row)}
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setIngredientModal(row)} className="btn-secondary text-sm px-3 py-1.5">編輯</button>
                  <button onClick={() => handleShowHistory(row.ingredientId, row.ingredientName)} className="btn-secondary text-sm px-3 py-1.5">記錄</button>
                  <button onClick={() => setActionModal({ row, action: 'restock' })} className="btn-success text-sm px-3 py-1.5">進貨</button>
                  <button onClick={() => setActionModal({ row, action: 'adjust' })} className="btn-secondary text-sm px-3 py-1.5">調整</button>
                  <button onClick={() => setActionModal({ row, action: 'waste' })} className="btn-warning text-sm px-3 py-1.5">報廢</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {actionModal && (
        <Modal open={true} onClose={() => setActionModal(null)} title={`${actionModal.action === 'restock' ? '進貨' : actionModal.action === 'adjust' ? '調整庫存' : '報廢'} - ${actionModal.row.ingredientName}`} size="sm">
          <div className="space-y-4">
            <div className="text-center bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">目前庫存</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{actionModal.row.currentStock} {actionModal.row.unit}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">
                {actionModal.action === 'adjust' ? '調整後庫存' : '數量'}
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="input-field text-lg"
                min={0}
                step="0.1"
                placeholder="請輸入數量"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">備註</label>
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
              <p className="text-center text-slate-400 dark:text-slate-600 py-8">尚無異動記錄</p>
            ) : (
              history.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      transaction.type === 'sale' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' :
                      transaction.type === 'restock' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' :
                      transaction.type === 'waste' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400' :
                      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {INVENTORY_TRANSACTION_LABELS[transaction.type]}
                    </span>
                    <div>
                      <span className={`font-semibold ${transaction.quantity > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {transaction.quantity > 0 ? '+' : ''}{transaction.quantity}
                      </span>
                      <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
                        {transaction.previousStock} → {transaction.newStock}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(transaction.createdAt)}</p>
                    {transaction.note && <p className="text-xs text-slate-500 dark:text-slate-400">{transaction.note}</p>}
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
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 px-4 py-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">待補貨品項</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {purchaseSuggestions.length}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 px-4 py-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">建議採購量</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {formatInventoryQuantity(purchaseSummary.totalSuggestedQuantity)}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 px-4 py-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">預估採購成本</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
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
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
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
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        目前 {formatInventoryQuantity(suggestion.currentStock)} {suggestion.unit}
                        {' · '}
                        門檻 {formatInventoryQuantity(suggestion.lowStockThreshold)} {suggestion.unit}
                        {' · '}
                        建議補到 {formatInventoryQuantity(suggestion.recommendedTargetStock)} {suggestion.unit}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-sm text-slate-500 dark:text-slate-400">建議補貨</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatInventoryQuantity(suggestion.recommendedOrderQuantity)} {suggestion.unit}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
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
    lowStockThreshold: number;
    currentStock: number;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(ingredient?.ingredientName || '');
  const [unit, setUnit] = useState(ingredient?.unit || '份');
  const [costPerUnit, setCostPerUnit] = useState(String(ingredient?.costPerUnit ?? 0));
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(ingredient?.lowStockThreshold ?? defaultLowStockThreshold)
  );
  const [currentStock, setCurrentStock] = useState(String(ingredient?.currentStock ?? 0));

  const handleSubmit = async () => {
    if (!name.trim()) {
      return;
    }

    await onSave({
      name: name.trim(),
      unit: unit.trim() || '份',
      costPerUnit: Number(costPerUnit) || 0,
      lowStockThreshold: Number(lowStockThreshold) || 0,
      currentStock: Number(currentStock) || 0,
    });
  };

  return (
    <Modal open={true} onClose={onClose} title={ingredient ? '編輯食材' : '新增食材'} size="sm">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">食材名稱</label>
          <input value={name} onChange={(event) => setName(event.target.value)} className="input-field" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">單位</label>
            <input value={unit} onChange={(event) => setUnit(event.target.value)} className="input-field" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">每單位成本</label>
            <input type="number" min={0} step="0.1" value={costPerUnit} onChange={(event) => setCostPerUnit(event.target.value)} className="input-field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">低庫存門檻</label>
            <input type="number" min={0} step="0.1" value={lowStockThreshold} onChange={(event) => setLowStockThreshold(event.target.value)} className="input-field" />
            {!ingredient && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                預設值來自系統設定
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">目前庫存</label>
            <input type="number" min={0} step="0.1" value={currentStock} onChange={(event) => setCurrentStock(event.target.value)} className="input-field" />
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
