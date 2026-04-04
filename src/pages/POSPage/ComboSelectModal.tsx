import { useState } from 'react';
import { useCartStore } from '../../stores/useCartStore';
import { useAppSettingsStore } from '../../stores/useAppSettingsStore';
import { formatPrice } from '../../utils/currency';
import Modal from '../../components/ui/Modal';
import type { ComboItem, Product } from '../../db/types';

interface ComboSelectModalProps {
  product: Product;
  onClose: () => void;
}

export default function ComboSelectModal({ product, onClose }: ComboSelectModalProps) {
  useAppSettingsStore((state) => state.settings.currency);
  const pickCount = product.comboPickCount || 1;
  const available = product.comboItems || [];
  const [selected, setSelected] = useState<Map<number, number>>(new Map());

  const totalSelected = Array.from(selected.values()).reduce((sum, qty) => sum + qty, 0);
  const isFull = totalSelected >= pickCount;

  const handleToggle = (item: ComboItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const current = next.get(item.productId) || 0;

      if (current > 0) {
        next.delete(item.productId);
      } else {
        if (totalSelected >= pickCount) return prev;
        next.set(item.productId, 1);
      }
      return next;
    });
  };

  const handleQty = (productId: number, delta: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const current = next.get(productId) || 0;
      const newQty = current + delta;

      if (delta > 0 && totalSelected >= pickCount) return prev;

      if (newQty <= 0) {
        next.delete(productId);
      } else {
        next.set(productId, newQty);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const pickedItems: ComboItem[] = [];
    for (const [productId, qty] of selected) {
      const item = available.find((i) => i.productId === productId);
      if (item) {
        pickedItems.push({ ...item, quantity: qty });
      }
    }

    useCartStore.getState().addItem({
      productId: product.id!,
      productName: product.name,
      unitPrice: product.price,
      modifiers: [],
      isCombo: true,
      comboItems: pickedItems,
    });
    onClose();
  };

  return (
    <Modal open={true} onClose={onClose} title={product.name} size="md">
      <div className="space-y-4">
        <div className="text-center">
          <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {formatPrice(product.price)}
          </span>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            請選擇 {pickCount} 項
            <span className="ml-2 font-semibold text-purple-600 dark:text-purple-400">
              ({totalSelected}/{pickCount})
            </span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
          {available.map((item) => {
            const qty = selected.get(item.productId) || 0;
            const isSelected = qty > 0;
            const isDisabled = !isSelected && isFull;

            return (
              <div
                key={item.productId}
                className={`rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 dark:border-purple-400'
                    : isDisabled
                      ? 'border-gray-200 dark:border-[#2a3a54] opacity-40'
                      : 'border-gray-200 hover:border-purple-300 dark:border-[#2a3a54] dark:hover:border-purple-500'
                }`}
              >
                <button
                  onClick={() => handleToggle(item)}
                  disabled={isDisabled}
                  className="w-full p-3 text-left"
                >
                  <span className={`font-medium ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-gray-800 dark:text-slate-50'}`}>
                    {item.productName}
                  </span>
                </button>

                {isSelected && pickCount > 1 && (
                  <div className="flex items-center justify-center gap-2 pb-2">
                    <button
                      onClick={() => handleQty(item.productId, -1)}
                      className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 dark:bg-[#1a2540] dark:hover:bg-gray-600 flex items-center justify-center text-sm font-bold"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-semibold text-sm">{qty}</span>
                    <button
                      onClick={() => handleQty(item.productId, 1)}
                      disabled={isFull}
                      className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 dark:bg-[#1a2540] dark:hover:bg-gray-600 flex items-center justify-center text-sm font-bold disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-[#1e2d4a]">
          <div>
            <span className="text-gray-500 dark:text-slate-400 text-sm">已選 {totalSelected} / {pickCount} 項</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary px-6">取消</button>
            <button
              onClick={handleConfirm}
              disabled={totalSelected === 0}
              className="btn-primary px-6 disabled:opacity-50"
            >
              加入訂單
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
