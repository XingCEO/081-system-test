import { useState, useRef } from 'react';
import { useCartStore } from '../../stores/useCartStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { createOrder } from '../../services/orderService';
import { formatPrice } from '../../utils/currency';
import { CASH_DENOMINATIONS } from '../../utils/constants';
import Modal from '../../components/ui/Modal';
import NumberPad from '../../components/ui/NumberPad';
import { IconCheck, IconPrinter, IconMapPin } from '../../components/ui/Icons';
import toast from 'react-hot-toast';
import type { Order } from '../../db/types';

interface CheckoutModalProps {
  onClose: () => void;
}

export default function CheckoutModal({ onClose }: CheckoutModalProps) {
  const { items, tableId, tableName, note, getSubtotal, clearCart } = useCartStore();
  const { currentEmployee } = useAuthStore();
  const [cashInput, setCashInput] = useState('');
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const total = getSubtotal();
  const cashReceived = parseInt(cashInput) || 0;
  const change = cashReceived - total;

  const handleConfirm = async () => {
    if (cashReceived < total) {
      toast.error('金額不足！');
      return;
    }

    try {
      const order = await createOrder({
        items,
        employeeId: currentEmployee?.id || 0,
        employeeName: currentEmployee?.name || '',
        tableId,
        tableName: tableName || '外帶',
        discount: 0,
        cashReceived,
        note,
      });

      setCompletedOrder(order);
      clearCart();
      toast.success('付款成功！');
    } catch {
      toast.error('結帳失敗，請重試');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (completedOrder) {
    return (
      <Modal open={true} onClose={onClose} title="付款成功" size="md">
        <div className="text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <IconCheck className="w-10 h-10 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-bold text-emerald-600 mb-2">付款完成！</h3>
          <p className="text-slate-600 mb-1">訂單編號：{completedOrder.orderNumber}</p>
          <p className="text-slate-600 mb-1">
            {completedOrder.tableName !== '外帶' && `桌位：${completedOrder.tableName} · `}
            總計：{formatPrice(completedOrder.total)}
          </p>
          <p className="text-slate-600">
            收款：{formatPrice(completedOrder.cashReceived)} · 找零：{formatPrice(completedOrder.changeGiven)}
          </p>

          {/* Receipt for printing */}
          <div ref={receiptRef} className="receipt-print hidden print:block text-left mt-4 font-mono text-xs">
            <div className="text-center mb-2">
              <p className="font-bold text-sm">美味餐廳</p>
              <p>================================</p>
            </div>
            <p>訂單：{completedOrder.orderNumber}</p>
            <p>桌位：{completedOrder.tableName}</p>
            <p>員工：{completedOrder.employeeName}</p>
            <p>時間：{new Date(completedOrder.createdAt).toLocaleString('zh-TW')}</p>
            <p>--------------------------------</p>
            {items.map((item, i) => (
              <div key={i}>
                <p>{item.productName} x{item.quantity}  ${(item.unitPrice + item.modifiersTotal) * item.quantity}</p>
                {item.modifiers.map((m, j) => (
                  <p key={j} className="pl-2">  +{m.name} {m.price > 0 ? `+$${m.price}` : ''}</p>
                ))}
              </div>
            ))}
            <p>================================</p>
            <p className="font-bold">總計：{formatPrice(completedOrder.total)}</p>
            <p>收款：{formatPrice(completedOrder.cashReceived)}</p>
            <p>找零：{formatPrice(completedOrder.changeGiven)}</p>
            <p>================================</p>
            <p className="text-center mt-2">謝謝光臨，歡迎再來！</p>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={handlePrint} className="btn-secondary flex-1 flex items-center justify-center gap-1.5">
              <IconPrinter className="w-4 h-4" /> 列印收據
            </button>
            <button onClick={onClose} className="btn-primary flex-1">
              完成
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={true} onClose={onClose} title="結帳" size="md">
      <div className="space-y-6">
        {/* Amount Due */}
        <div className="text-center bg-blue-50 rounded-2xl p-6">
          <p className="text-slate-600 text-sm">應收金額</p>
          <p className="text-4xl font-bold text-blue-600 mt-1">{formatPrice(total)}</p>
          {tableId && (
            <p className="text-slate-500 text-sm mt-1 flex items-center justify-center gap-1"><IconMapPin className="w-3.5 h-3.5 inline" /> {tableName}</p>
          )}
        </div>

        {/* Cash Input Display */}
        <div className="text-center">
          <p className="text-slate-600 text-sm">收到金額</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            {cashInput ? formatPrice(cashReceived) : 'NT$0'}
          </p>
        </div>

        {/* Quick Amount Buttons */}
        <div className="flex gap-2">
          {CASH_DENOMINATIONS.map((amount) => (
            <button
              key={amount}
              onClick={() => setCashInput(String(amount))}
              className="btn-secondary flex-1 text-lg"
            >
              ${amount}
            </button>
          ))}
          <button
            onClick={() => setCashInput(String(total))}
            className="btn-secondary flex-1 text-sm"
          >
            剛好
          </button>
        </div>

        {/* Number Pad */}
        <NumberPad value={cashInput} onChange={setCashInput} maxLength={6} />

        {/* Change */}
        {cashReceived > 0 && (
          <div className={`text-center p-4 rounded-xl ${
            change >= 0 ? 'bg-emerald-50' : 'bg-red-50'
          }`}>
            <p className={`text-sm ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {change >= 0 ? '找零' : '金額不足'}
            </p>
            <p className={`text-2xl font-bold ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {change >= 0 ? formatPrice(change) : formatPrice(Math.abs(change))}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={cashReceived < total}
            className="btn-success flex-[2] text-lg py-3"
          >
            確認收款
          </button>
        </div>
      </div>
    </Modal>
  );
}
