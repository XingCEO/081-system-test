import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { restockProduct, adjustStock, wasteProduct, getTransactionHistory } from '../../services/inventoryService';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatDateTime } from '../../utils/date';
import { INVENTORY_TRANSACTION_LABELS } from '../../utils/constants';
import Modal from '../../components/ui/Modal';
import { IconPackage } from '../../components/ui/Icons';
import toast from 'react-hot-toast';
import type { InventoryRecord, InventoryTransaction } from '../../db/types';

export default function InventoryPage() {
  const { currentEmployee } = useAuthStore();
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [actionModal, setActionModal] = useState<{ record: InventoryRecord; action: 'restock' | 'adjust' | 'waste' } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ productId: number; productName: string } | null>(null);
  const [history, setHistory] = useState<InventoryTransaction[]>([]);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');

  const inventory = useLiveQuery(() => db.inventory.toArray());

  const filtered = inventory?.filter((inv) => {
    if (filter === 'low') return inv.currentStock > 0 && inv.currentStock <= inv.lowStockThreshold;
    if (filter === 'out') return inv.currentStock <= 0;
    return true;
  });

  const lowCount = inventory?.filter(i => i.currentStock > 0 && i.currentStock <= i.lowStockThreshold).length || 0;
  const outCount = inventory?.filter(i => i.currentStock <= 0).length || 0;

  const handleAction = async () => {
    if (!actionModal || !quantity) return;
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) return;

    const empId = currentEmployee?.id || 0;
    const { record, action } = actionModal;

    if (action === 'restock') {
      await restockProduct(record.productId, qty, empId, note || '進貨');
    } else if (action === 'adjust') {
      await adjustStock(record.productId, qty, empId, note || '手動調整');
    } else {
      await wasteProduct(record.productId, qty, empId, note || '報廢');
    }

    setActionModal(null);
    setQuantity('');
    setNote('');
    toast.success('庫存已更新');
  };

  const handleShowHistory = async (productId: number, productName: string) => {
    const h = await getTransactionHistory(productId) as InventoryTransaction[];
    setHistory(h);
    setHistoryModal({ productId, productName });
  };

  const getStatusBadge = (inv: InventoryRecord) => {
    if (inv.currentStock <= 0) return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">售完</span>;
    if (inv.currentStock <= inv.lowStockThreshold) return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">偏低</span>;
    return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-medium">正常</span>;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><IconPackage className="w-6 h-6 text-amber-500" /> 庫存管理</h1>
        <div className="flex gap-2 mt-3">
          <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-full text-sm font-medium ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            全部 ({inventory?.length || 0})
          </button>
          <button onClick={() => setFilter('low')} className={`px-4 py-1.5 rounded-full text-sm font-medium ${filter === 'low' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
            偏低 ({lowCount})
          </button>
          <button onClick={() => setFilter('out')} className={`px-4 py-1.5 rounded-full text-sm font-medium ${filter === 'out' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
            售完 ({outCount})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-2">
          {filtered?.map((inv) => (
            <div key={inv.id} className="card px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center min-w-[60px]">
                  <p className={`text-2xl font-bold ${inv.currentStock <= 0 ? 'text-red-600' : inv.currentStock <= inv.lowStockThreshold ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {inv.currentStock}
                  </p>
                  <p className="text-xs text-slate-400">{inv.unit}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{inv.productName}</h3>
                  <p className="text-sm text-slate-500">閾值：{inv.lowStockThreshold} {inv.unit}</p>
                </div>
                {getStatusBadge(inv)}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleShowHistory(inv.productId, inv.productName)} className="btn-secondary text-sm px-3 py-1.5">記錄</button>
                <button onClick={() => setActionModal({ record: inv, action: 'restock' })} className="btn-success text-sm px-3 py-1.5">進貨</button>
                <button onClick={() => setActionModal({ record: inv, action: 'adjust' })} className="btn-secondary text-sm px-3 py-1.5">調整</button>
                <button onClick={() => setActionModal({ record: inv, action: 'waste' })} className="btn-warning text-sm px-3 py-1.5">報廢</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Modal */}
      {actionModal && (
        <Modal open={true} onClose={() => setActionModal(null)} title={`${actionModal.action === 'restock' ? '進貨' : actionModal.action === 'adjust' ? '調整庫存' : '報廢'} - ${actionModal.record.productName}`} size="sm">
          <div className="space-y-4">
            <div className="text-center bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-500">目前庫存</p>
              <p className="text-3xl font-bold text-slate-900">{actionModal.record.currentStock} {actionModal.record.unit}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                {actionModal.action === 'adjust' ? '調整後數量' : '數量'}
              </label>
              <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} className="input-field text-lg" min={0} placeholder="輸入數量" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">備註</label>
              <input value={note} onChange={e => setNote(e.target.value)} className="input-field" placeholder="選填" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setActionModal(null)} className="btn-secondary flex-1">取消</button>
              <button onClick={handleAction} disabled={!quantity} className="btn-primary flex-1">確認</button>
            </div>
          </div>
        </Modal>
      )}

      {/* History Modal */}
      {historyModal && (
        <Modal open={true} onClose={() => setHistoryModal(null)} title={`${historyModal.productName} - 異動記錄`} size="lg">
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {history.length === 0 ? (
              <p className="text-center text-slate-400 py-8">尚無記錄</p>
            ) : (
              history.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      tx.type === 'sale' ? 'bg-red-100 text-red-700' :
                      tx.type === 'restock' ? 'bg-emerald-100 text-emerald-700' :
                      tx.type === 'waste' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {INVENTORY_TRANSACTION_LABELS[tx.type]}
                    </span>
                    <div>
                      <span className={`font-semibold ${tx.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                      </span>
                      <span className="text-sm text-slate-500 ml-2">{tx.previousStock} → {tx.newStock}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">{formatDateTime(tx.createdAt)}</p>
                    {tx.note && <p className="text-xs text-slate-500">{tx.note}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
