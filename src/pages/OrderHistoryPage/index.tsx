import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { cancelOrder, getOrderWithItems } from '../../services/orderService';
import { formatPrice } from '../../utils/currency';
import { formatDateTime } from '../../utils/date';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../utils/constants';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { IconClipboard, IconMapPin, IconBag } from '../../components/ui/Icons';
import toast from 'react-hot-toast';
import type { Order, OrderItem, OrderStatus } from '../../db/types';

export default function OrderHistoryPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

  const orders = useLiveQuery(
    () => {
      if (statusFilter === 'all') {
        return db.orders.orderBy('createdAt').reverse().limit(200).toArray();
      }
      return db.orders.where('status').equals(statusFilter).reverse().sortBy('createdAt');
    },
    [statusFilter]
  );

  const handleViewDetail = async (order: Order) => {
    if (!order.id) return;
    const detail = await getOrderWithItems(order.id);
    if (detail) setSelectedOrder(detail);
  };

  const handleCancel = async () => {
    if (!cancelTarget?.id) return;
    await cancelOrder(cancelTarget.id);
    setCancelTarget(null);
    toast.success('訂單已取消');
  };

  const statuses: (OrderStatus | 'all')[] = ['all', 'pending', 'preparing', 'ready', 'completed', 'cancelled'];

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><IconClipboard className="w-6 h-6 text-blue-500" /> 訂單記錄</h1>
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s === 'all' ? '全部' : ORDER_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!orders?.length ? (
          <div className="text-center py-16 text-slate-400">
            <IconClipboard className="w-10 h-10 mx-auto mb-2" />
            <p>尚無訂單</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => handleViewDetail(order)}
                className="card px-4 py-3 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-slate-900">
                    #{order.orderNumber.split('-')[1]}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                  <span className="text-sm text-slate-500">
                    <span className="inline-flex items-center gap-0.5">
                      {order.tableName !== '外帶' ? <><IconMapPin className="w-3.5 h-3.5 inline" />{order.tableName}</> : <><IconBag className="w-3.5 h-3.5 inline" />外帶</>}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-blue-600">{formatPrice(order.total)}</span>
                  <span className="text-sm text-slate-400">{formatDateTime(order.createdAt)}</span>
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
                <span className="text-slate-500">狀態</span>
                <p className={`font-medium mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs ${ORDER_STATUS_COLORS[selectedOrder.order.status]}`}>
                  {ORDER_STATUS_LABELS[selectedOrder.order.status]}
                </p>
              </div>
              <div>
                <span className="text-slate-500">桌位</span>
                <p className="font-medium">{selectedOrder.order.tableName}</p>
              </div>
              <div>
                <span className="text-slate-500">經手人</span>
                <p className="font-medium">{selectedOrder.order.employeeName}</p>
              </div>
              <div>
                <span className="text-slate-500">時間</span>
                <p className="font-medium">{formatDateTime(selectedOrder.order.createdAt)}</p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="font-semibold mb-3">訂單明細</h3>
              <div className="space-y-2">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <div>
                      <span className="font-medium">{item.quantity}x {item.productName}</span>
                      {item.modifiers.length > 0 && (
                        <span className="text-xs text-slate-500 ml-1">
                          ({item.modifiers.map(m => m.name).join(', ')})
                        </span>
                      )}
                    </div>
                    <span className="font-medium">{formatPrice(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-1">
              <div className="flex justify-between font-bold text-lg">
                <span>總計</span>
                <span className="text-blue-600">{formatPrice(selectedOrder.order.total)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>收款</span>
                <span>{formatPrice(selectedOrder.order.cashReceived)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>找零</span>
                <span>{formatPrice(selectedOrder.order.changeGiven)}</span>
              </div>
            </div>

            {selectedOrder.order.status === 'pending' && (
              <button
                onClick={() => setCancelTarget(selectedOrder.order)}
                className="btn-danger w-full mt-4"
              >
                取消訂單
              </button>
            )}
          </div>
        </Modal>
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
    </div>
  );
}
