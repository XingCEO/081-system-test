import { useCartStore } from '../../stores/useCartStore';
import { useAppSettingsStore } from '../../stores/useAppSettingsStore';
import { formatPrice, formatPriceDelta } from '../../utils/currency';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import { IconCart, IconMapPin, IconBag, IconChair, IconNote } from '../../components/ui/Icons';

interface CartPanelProps {
  onCheckout: () => void;
}

export default function CartPanel({ onCheckout }: CartPanelProps) {
  useAppSettingsStore((state) => state.settings.currency);
  const { items, removeItem, updateQuantity, setTable, tableId, tableName, clearCart, getSubtotal, getItemCount } = useCartStore();
  const [showTableSelect, setShowTableSelect] = useState(false);
  const subtotal = getSubtotal();
  const itemCount = getItemCount();

  const tables = useLiveQuery(() => db.diningTables.filter(t => t.isActive).toArray());

  return (
    <>
      <div className="w-full lg:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full transition-colors">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">
            當前訂單 {itemCount > 0 && <span className="text-blue-600 dark:text-blue-400">({itemCount})</span>}
          </h2>
          <button
            onClick={() => setShowTableSelect(true)}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 active:scale-95 ${
              tableId
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-900'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            <IconMapPin className="w-3.5 h-3.5" />
            {tableId ? tableName : '外帶'}
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600 p-8">
              <IconCart className="w-12 h-12 mb-3" />
              <p className="text-lg font-medium">尚未加入商品</p>
              <p className="text-sm mt-1">從左側菜單選擇商品</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item) => (
                <div key={item.cartItemId} className="px-4 py-3 animate-fade-in">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-medium text-slate-900 dark:text-white truncate text-sm">
                          {item.productName}
                        </h4>
                        {item.isCombo && (
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            套餐
                          </span>
                        )}
                      </div>
                      {item.isCombo && item.comboItems && item.comboItems.length > 0 && (
                        <div className="mt-1 ml-2 space-y-0.5">
                          {item.comboItems.map((sub, si) => (
                            <p key={si} className="text-xs text-slate-500 dark:text-slate-400">
                              └ {sub.quantity}x {sub.productName}
                            </p>
                          ))}
                        </div>
                      )}
                      {item.modifiers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.modifiers.map((mod, i) => (
                            <span
                              key={i}
                              className="text-xs bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded"
                            >
                              +{mod.name}
                              {mod.price !== 0 && ` ${formatPriceDelta(mod.price)}`}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.note && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                          <IconNote className="w-3 h-3 inline" /> {item.note}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">
                        {formatPrice((item.unitPrice + item.modifiersTotal) * item.quantity)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(item.cartItemId, -1)}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-lg font-bold text-slate-600 dark:text-slate-400 active:scale-90 transition-all"
                      >
                        −
                      </button>
                      <span className="w-10 text-center font-semibold text-base text-slate-900 dark:text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.cartItemId, 1)}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-lg font-bold text-slate-600 dark:text-slate-400 active:scale-90 transition-all"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.cartItemId)}
                      className="text-red-400 hover:text-red-600 dark:hover:text-red-400 text-sm font-medium transition-colors"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex justify-between text-lg font-bold">
              <span className="text-slate-700 dark:text-slate-300">總計</span>
              <span className="text-blue-600 dark:text-blue-400">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={clearCart} className="btn-secondary flex-1">
                清除
              </button>
              <button onClick={onCheckout} className="btn-primary flex-[2]">
                結帳 ({formatPrice(subtotal)})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table Select Modal */}
      <Modal
        open={showTableSelect}
        onClose={() => setShowTableSelect(false)}
        title="選擇桌位"
        size="md"
      >
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => {
              setTable(null, '');
              setShowTableSelect(false);
            }}
            className={`p-4 rounded-xl border-2 text-center font-medium transition-all active:scale-95 ${
              !tableId
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                : 'border-slate-200 hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-600'
            }`}
          >
            <IconBag className="w-6 h-6 mx-auto mb-1" />
            <span className="dark:text-slate-300">外帶</span>
          </button>
          {tables?.filter(t => t.status === 'available' || t.id === tableId).map((table) => (
            <button
              key={table.id}
              onClick={() => {
                setTable(table.id!, `${table.number} ${table.name}`);
                setShowTableSelect(false);
              }}
              className={`p-4 rounded-xl border-2 text-center font-medium transition-all active:scale-95 ${
                tableId === table.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                  : 'border-slate-200 hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-600'
              }`}
            >
              <IconChair className="w-6 h-6 mx-auto mb-1" />
              <span className="dark:text-slate-300">{table.number}</span>
              <span className="block text-xs text-slate-400 dark:text-slate-500">{table.name}</span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
