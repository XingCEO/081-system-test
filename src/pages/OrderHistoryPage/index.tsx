import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { cancelOrder, deleteOrder, getOrderWithItems, updateOrderWithItems } from '../../services/orderService';
import { useAppSettingsStore } from '../../stores/useAppSettingsStore';
import { formatPrice } from '../../utils/currency';
import { formatDateTime } from '../../utils/date';
import { getShortOrderNumber } from '../../utils/orderNumber';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../utils/constants';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { IconClipboard, IconMapPin, IconBag } from '../../components/ui/Icons';
import toast from 'react-hot-toast';
import type { Order, OrderItem, OrderStatus } from '../../db/types';

export default function OrderHistoryPage() {
  useAppSettingsStore((state) => state.settings.currency);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<{ order: Order; items: OrderItem[] } | null>(null);

  const orders = useLiveQuery(
    async () => {
      if (statusFilter === 'all') {
        return db.orders.orderBy('createdAt').reverse().limit(200).toArray();
      }
      const results = await db.orders.where('status').equals(statusFilter).sortBy('createdAt');
      return results.reverse();
    },
    [statusFilter]
  );

  const handleViewDetail = async (order: Order) => {
    if (!order.id) return;
    try {
      const detail = await getOrderWithItems(order.id);
      if (detail) setSelectedOrder(detail);
    } catch {
      toast.error('無法載入訂單詳情');
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget?.id) return;
    try {
      await cancelOrder(cancelTarget.id);
      setCancelTarget(null);
      setSelectedOrder(null);
      toast.success('訂單已取消');
    } catch {
      toast.error('取消訂單失敗');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      await deleteOrder(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedOrder(null);
      toast.success('訂單已刪除');
    } catch {
      toast.error('刪除訂單失敗');
    }
  };

  const handleStartEdit = () => {
    if (!selectedOrder) return;
    setEditingOrder({
      order: selectedOrder.order,
      items: selectedOrder.items.map((item) => ({ ...item })),
    });
    setSelectedOrder(null);
  };

  const statuses: (OrderStatus | 'all')[] = ['all', 'pending', 'preparing', 'ready', 'completed', 'cancelled'];

  return (
    <div className="h-full flex flex-col">
      <div className="page-header">
        <h1 className="text-xl font-bold text-gray-800 dark:text-slate-50 flex items-center gap-2"><IconClipboard className="w-6 h-6 text-indigo-500" /> 訂單記錄</h1>
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                statusFilter === s
                  ? 'bg-indigo-600 text-white shadow-md dark:bg-indigo-500'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-[#131c2e] dark:text-slate-400 dark:hover:bg-[#243552]'
              }`}
            >
              {s === 'all' ? '全部' : ORDER_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!orders?.length ? (
          <div className="text-center py-16 text-gray-400 dark:text-slate-500 animate-fade-in">
            <IconClipboard className="w-12 h-12 mx-auto mb-3" />
            <p className="text-lg font-medium">尚無訂單</p>
            <p className="text-sm mt-1">訂單記錄將顯示在此</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order, i) => (
              <div
                key={order.id}
                onClick={() => handleViewDetail(order)}
                className={`card px-4 py-3 flex items-center justify-between cursor-pointer hover:shadow-md transition-all animate-slide-up stagger-${Math.min(i + 1, 6)}`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-gray-800 dark:text-slate-50">
                    #{getShortOrderNumber(order.orderNumber)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-0.5">
                      {order.tableName !== '外帶' ? <><IconMapPin className="w-3.5 h-3.5 inline" />{order.tableName}</> : <><IconBag className="w-3.5 h-3.5 inline" />外帶</>}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatPrice(order.total)}</span>
                  <span className="text-sm text-gray-400 dark:text-slate-500 hidden sm:inline">{formatDateTime(order.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <Modal
          open={true}
          onClose={() => setSelectedOrder(null)}
          title={`訂單 #${selectedOrder.order.orderNumber}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-slate-400">狀態</span>
                <p className={`font-medium mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs ${ORDER_STATUS_COLORS[selectedOrder.order.status]}`}>
                  {ORDER_STATUS_LABELS[selectedOrder.order.status]}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-slate-400">桌位</span>
                <p className="font-medium text-gray-800 dark:text-slate-50">{selectedOrder.order.tableName}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-slate-400">經手人</span>
                <p className="font-medium text-gray-800 dark:text-slate-50">{selectedOrder.order.employeeName}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-slate-400">時間</span>
                <p className="font-medium text-gray-800 dark:text-slate-50">{formatDateTime(selectedOrder.order.createdAt)}</p>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-[#1e2d4a] pt-4">
              <h3 className="font-semibold mb-3 text-gray-800 dark:text-slate-50">訂單明細</h3>
              <div className="space-y-2">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <div>
                      <span className="font-medium text-gray-800 dark:text-slate-50">{item.quantity}x {item.productName}</span>
                      {item.modifiers.length > 0 && (
                        <span className="text-xs text-gray-500 dark:text-slate-400 ml-1">
                          ({item.modifiers.map(m => m.name).join(', ')})
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-gray-800 dark:text-slate-50">{formatPrice(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-[#1e2d4a] pt-4 space-y-1">
              <div className="flex justify-between font-bold text-lg">
                <span className="text-gray-800 dark:text-slate-50">總計</span>
                <span className="text-indigo-600 dark:text-indigo-400">{formatPrice(selectedOrder.order.total)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500 dark:text-slate-400">
                <span>收款</span>
                <span>{formatPrice(selectedOrder.order.cashReceived)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500 dark:text-slate-400">
                <span>找零</span>
                <span>{formatPrice(selectedOrder.order.changeGiven)}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              {selectedOrder.order.status !== 'cancelled' && selectedOrder.order.status !== 'completed' && (
                <button
                  onClick={handleStartEdit}
                  className="btn-secondary flex-1"
                >
                  修改訂單
                </button>
              )}
              {selectedOrder.order.status === 'pending' && (
                <button
                  onClick={() => setCancelTarget(selectedOrder.order)}
                  className="btn-warning flex-1"
                >
                  取消訂單
                </button>
              )}
              <button
                onClick={() => setDeleteTarget(selectedOrder.order)}
                className="btn-danger flex-1"
              >
                刪除訂單
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <OrderEditModal
          order={editingOrder.order}
          items={editingOrder.items}
          onClose={() => setEditingOrder(null)}
          onSaved={() => {
            setEditingOrder(null);
            toast.success('訂單已更新');
          }}
        />
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        title="取消訂單"
        message={`確定要取消訂單 #${cancelTarget?.orderNumber}？庫存將自動回補。`}
        confirmText="確定取消"
        variant="danger"
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="刪除訂單"
        message={`確定要永久刪除訂單 #${deleteTarget?.orderNumber}？此操作無法復原，庫存將自動回補。`}
        confirmText="確定刪除"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function OrderEditModal({
  order,
  items,
  onClose,
  onSaved,
}: {
  order: Order;
  items: OrderItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editItems, setEditItems] = useState(
    items.map((item) => ({
      ...item,
      quantity: item.quantity,
    }))
  );
  const [orderNote, setOrderNote] = useState(order.note);
  const [cashReceived, setCashReceived] = useState(String(order.cashReceived));
  const [saving, setSaving] = useState(false);

  const subtotal = editItems.reduce(
    (sum, item) => sum + (item.unitPrice + (item.modifiersTotal ?? 0)) * item.quantity,
    0
  );
  const total = subtotal - order.discount;
  const cash = Number(cashReceived) || 0;
  const changeGiven = cash - total;

  const handleQuantityChange = (index: number, delta: number) => {
    setEditItems((prev) => {
      const next = [...prev];
      const newQty = next[index].quantity + delta;
      if (newQty <= 0) {
        // Remove item
        next.splice(index, 1);
      } else {
        next[index] = {
          ...next[index],
          quantity: newQty,
          subtotal: (next[index].unitPrice + (next[index].modifiersTotal ?? 0)) * newQty,
        };
      }
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (editItems.length === 0) {
      toast.error('訂單至少需要一個品項');
      return;
    }
    setSaving(true);
    try {
      await updateOrderWithItems(order.id!, {
        items: editItems.map((item) => ({
          ...item,
          subtotal: (item.unitPrice + (item.modifiersTotal ?? 0)) * item.quantity,
        })),
        note: orderNote,
        subtotal,
        total,
        discount: order.discount,
        cashReceived: cash,
        changeGiven,
      });
      onSaved();
    } catch {
      toast.error('更新訂單失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={`修改訂單 #${order.orderNumber}`} size="md">
      <div className="space-y-4">
        <div className="space-y-2 max-h-[40vh] overflow-auto">
          {editItems.map((item, index) => (
            <div key={`${item.id}-${index}`} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#1e2d4a]">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-800 dark:text-slate-50">{item.productName}</span>
                {item.modifiers.length > 0 && (
                  <span className="text-xs text-gray-500 dark:text-slate-400 ml-1">
                    ({item.modifiers.map(m => m.name).join(', ')})
                  </span>
                )}
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {formatPrice(item.unitPrice + (item.modifiersTotal ?? 0))} x {item.quantity} = {formatPrice((item.unitPrice + (item.modifiersTotal ?? 0)) * item.quantity)}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <button
                  onClick={() => handleQuantityChange(index, -1)}
                  className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#131c2e] text-gray-600 dark:text-slate-300 font-bold hover:bg-gray-200 dark:hover:bg-[#1a2540] transition-colors"
                >
                  −
                </button>
                <span className="w-8 text-center font-bold text-gray-800 dark:text-slate-50">{item.quantity}</span>
                <button
                  onClick={() => handleQuantityChange(index, 1)}
                  className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#131c2e] text-gray-600 dark:text-slate-300 font-bold hover:bg-gray-200 dark:hover:bg-[#1a2540] transition-colors"
                >
                  +
                </button>
                <button
                  onClick={() => handleRemoveItem(index)}
                  className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {editItems.length === 0 && (
            <p className="text-center text-gray-400 dark:text-slate-500 py-4">沒有品項</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">備註</label>
          <input
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            className="input-field"
            placeholder="訂單備註"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">收款金額</label>
          <input
            type="number"
            value={cashReceived}
            onChange={(e) => setCashReceived(e.target.value)}
            className="input-field"
            min={0}
          />
        </div>

        <div className="border-t border-gray-200 dark:border-[#1e2d4a] pt-4 space-y-1">
          <div className="flex justify-between font-bold text-lg">
            <span className="text-gray-800 dark:text-slate-50">總計</span>
            <span className="text-indigo-600 dark:text-indigo-400">{formatPrice(total)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500 dark:text-slate-400">
            <span>找零</span>
            <span className={changeGiven < 0 ? 'text-red-500' : ''}>{formatPrice(changeGiven)}</span>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || editItems.length === 0}
            className="btn-primary flex-1"
          >
            {saving ? '儲存中...' : '儲存修改'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
