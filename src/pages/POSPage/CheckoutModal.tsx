import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { CartItem, Order } from '../../db/types';
import { IconCheck, IconMapPin, IconPrinter } from '../../components/ui/Icons';
import Modal from '../../components/ui/Modal';
import NumberPad from '../../components/ui/NumberPad';
import { createOrder } from '../../services/orderService';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCartStore } from '../../stores/useCartStore';
import { useAppSettingsStore } from '../../stores/useAppSettingsStore';
import { CASH_DENOMINATIONS } from '../../utils/constants';
import { formatPrice, formatPriceDelta, formatPriceShort } from '../../utils/currency';

interface CheckoutModalProps {
  onClose: () => void;
}

export default function CheckoutModal({ onClose }: CheckoutModalProps) {
  const { clearCart, getSubtotal, items, note, tableId, tableName } = useCartStore();
  const { currentEmployee } = useAuthStore();
  const { receiptFooter, receiptHeader, storeAddress, storeName, storePhone } = useAppSettingsStore(
    (state) => state.settings
  );
  const [cashInput, setCashInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{ order: Order; items: CartItem[] } | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const total = getSubtotal();
  const cashReceived = Number.parseInt(cashInput, 10) || 0;
  const change = cashReceived - total;

  const handleConfirm = async () => {
    if (total <= 0) {
      toast.error('訂單金額需大於 0 才能結帳');
      return;
    }

    if (isSubmitting) {
      return;
    }

    if (cashReceived < total) {
      toast.error('收款金額不足');
      return;
    }

    setIsSubmitting(true);
    try {
      const receiptItems = items.map((item) => ({
        ...item,
        modifiers: (item.modifiers ?? []).map((modifier) => ({ ...modifier })),
        comboItems: item.comboItems?.map((comboItem) => ({ ...comboItem })),
      }));

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

      setCompletedOrder({ order, items: receiptItems });
      clearCart();
      toast.success('付款成功');
    } catch {
      toast.error('結帳失敗：訂單建立失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (completedOrder) {
    const { order, items: receiptItems } = completedOrder;

    return (
      <Modal open={true} onClose={onClose} title="付款成功" size="md">
        <div className="text-center">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-in">
            <IconCheck className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">付款完成</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-1">訂單編號：{order.orderNumber}</p>
          <p className="text-slate-600 dark:text-slate-400 mb-1">
            {order.tableName !== '外帶' && `桌位：${order.tableName} · `}
            總計：{formatPrice(order.total)}
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            收款：{formatPrice(order.cashReceived)} · 找零：{formatPrice(order.changeGiven)}
          </p>

          <div ref={receiptRef} className="receipt-print hidden print:block text-left mt-4 font-mono text-xs">
            <div className="text-center mb-2">
              <p className="font-bold text-sm">{storeName}</p>
              {receiptHeader && <p>{receiptHeader}</p>}
              {storeAddress && <p>{storeAddress}</p>}
              {storePhone && <p>{storePhone}</p>}
              <p>================================</p>
            </div>

            <p>訂單：{order.orderNumber}</p>
            <p>桌位：{order.tableName}</p>
            <p>員工：{order.employeeName}</p>
            <p>時間：{new Date(order.createdAt).toLocaleString('zh-TW')}</p>
            <p>--------------------------------</p>

            {receiptItems.map((item) => (
              <div key={item.cartItemId} className="mb-1">
                <p>{item.productName} x{item.quantity}  {formatPrice((item.unitPrice + (item.modifiersTotal ?? 0)) * item.quantity)}</p>
                {item.modifiers?.map((modifier) => (
                  <p key={`${item.cartItemId}-${modifier.modifierId}`} className="pl-2">
                    +{modifier.name} {formatPriceDelta(modifier.price)}
                  </p>
                ))}
                {item.note && <p className="pl-2">備註：{item.note}</p>}
              </div>
            ))}

            <p>================================</p>
            <p className="font-bold">總計：{formatPrice(order.total)}</p>
            <p>收款：{formatPrice(order.cashReceived)}</p>
            <p>找零：{formatPrice(order.changeGiven)}</p>
            <p>================================</p>
            {receiptFooter && <p className="text-center mt-2">{receiptFooter}</p>}
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
      <div className="space-y-5">
        <div className="text-center rounded-2xl p-5" style={{ backgroundColor: 'var(--theme-primary-soft)' }}>
          <p className="text-slate-600 dark:text-slate-400 text-sm">應收金額</p>
          <p className="text-4xl font-bold mt-1" style={{ color: 'var(--theme-primary)' }}>
            {formatPrice(total)}
          </p>
          {tableId && (
            <p className="text-slate-500 dark:text-slate-500 text-sm mt-1 flex items-center justify-center gap-1">
              <IconMapPin className="w-3.5 h-3.5 inline" /> {tableName}
            </p>
          )}
        </div>

        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400 text-sm">收款金額</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-50 mt-1">
            {cashInput ? formatPrice(cashReceived) : formatPrice(0)}
          </p>
        </div>

        <div className="flex gap-2">
          {CASH_DENOMINATIONS.map((amount) => (
            <button
              key={amount}
              onClick={() => setCashInput(String(amount))}
              className="btn-secondary flex-1 text-base"
            >
              {formatPriceShort(amount)}
            </button>
          ))}
          <button
            onClick={() => setCashInput(String(total))}
            className="btn-secondary flex-1 text-sm"
          >
            剛好
          </button>
        </div>

        <NumberPad value={cashInput} onChange={setCashInput} maxLength={6} />

        {cashReceived > 0 && (
          <div className={`text-center p-4 rounded-xl animate-fade-in ${
            change >= 0
              ? 'bg-emerald-50 dark:bg-emerald-950/50'
              : 'bg-red-50 dark:bg-red-950/50'
          }`}>
            <p className={`text-sm ${change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {change >= 0 ? '找零' : '收款不足'}
            </p>
            <p className={`text-2xl font-bold ${change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatPrice(Math.abs(change))}
            </p>
          </div>
        )}

        {(cashReceived === 0 || cashReceived < total) && total > 0 && (
          <p className="text-center text-sm text-amber-600 dark:text-amber-400 font-medium animate-fade-in">
            請輸入收款金額
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={total <= 0 || cashReceived < total || isSubmitting}
            className="btn-success flex-[2] text-lg py-3"
          >
            {isSubmitting ? '處理中...' : '確認付款'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
