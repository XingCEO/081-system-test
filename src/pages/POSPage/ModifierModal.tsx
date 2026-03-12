import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { db } from '../../db/database';
import { useCartStore } from '../../stores/useCartStore';
import { useAppSettingsStore } from '../../stores/useAppSettingsStore';
import { formatPrice, formatPriceDelta } from '../../utils/currency';
import Modal from '../../components/ui/Modal';
import type { Product, SelectedModifier } from '../../db/types';

interface ModifierModalProps {
  product: Product;
  onClose: () => void;
}

export default function ModifierModal({ product, onClose }: ModifierModalProps) {
  useAppSettingsStore((state) => state.settings.currency);
  const [selected, setSelected] = useState<Map<number, SelectedModifier[]>>(new Map());
  const [note, setNote] = useState('');

  const groups = useLiveQuery(async () => {
    const gs = await db.modifierGroups
      .where('id')
      .anyOf(product.modifierGroupIds)
      .toArray();
    const result = [];
    for (const g of gs) {
      const mods = await db.modifiers
        .where('groupId').equals(g.id!)
        .filter(m => m.isActive)
        .toArray();
      result.push({ group: g, modifiers: mods });
    }
    return result;
  }, [product.id]);

  const handleToggle = (
    groupId: number,
    mod: SelectedModifier,
    multiSelect: boolean,
    maxSelections: number
  ) => {
    const current = selected.get(groupId) || [];
    const exists = current.find((item) => item.modifierId === mod.modifierId);

    if (multiSelect && !exists && current.length >= Math.max(1, maxSelections)) {
      toast.error(`此群組最多可選 ${Math.max(1, maxSelections)} 項`);
      return;
    }

    setSelected((prev) => {
      const next = new Map(prev);
      const currentItems = next.get(groupId) || [];

      if (multiSelect) {
        const selectedModifier = currentItems.find((m) => m.modifierId === mod.modifierId);
        if (selectedModifier) {
          next.set(groupId, currentItems.filter((m) => m.modifierId !== mod.modifierId));
        } else {
          next.set(groupId, [...currentItems, mod]);
        }
      } else {
        const selectedModifier = currentItems.find((m) => m.modifierId === mod.modifierId);
        if (selectedModifier) {
          next.set(groupId, []);
        } else {
          next.set(groupId, [mod]);
        }
      }

      return next;
    });
  };

  const allModifiers = Array.from(selected.values()).flat();
  const modifiersTotal = allModifiers.reduce((sum, m) => sum + m.price, 0);
  const totalPrice = product.price + modifiersTotal;
  const missingRequiredGroups =
    groups?.filter(({ group }) => group.required && (selected.get(group.id!)?.length ?? 0) === 0) ?? [];

  const handleConfirm = () => {
    if (missingRequiredGroups.length > 0) {
      toast.error(`請先完成必選項目：${missingRequiredGroups.map(({ group }) => group.name).join('、')}`);
      return;
    }

    useCartStore.getState().addItem({
      productId: product.id!,
      productName: product.name,
      unitPrice: product.price,
      modifiers: allModifiers,
      note,
    });
    onClose();
  };

  return (
    <Modal open={true} onClose={onClose} title={product.name} size="md">
      <div className="space-y-5">
        <div className="text-center">
          <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatPrice(product.price)}
          </span>
          {product.description && (
            <p className="text-gray-500 dark:text-slate-400 mt-1">{product.description}</p>
          )}
        </div>

        {groups?.map(({ group, modifiers }) => (
          <div key={group.id}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-semibold text-gray-800 dark:text-slate-50">{group.name}</h3>
              <span className="text-xs bg-gray-100 text-gray-500 dark:bg-[#131c2e] dark:text-slate-400 px-2 py-0.5 rounded-full">
                {group.required ? '必選' : '可選'}
                {group.multiSelect ? ` · 最多 ${Math.max(1, group.maxSelections)} 項` : ' · 單選'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {modifiers.map((mod) => {
                const isSelected = selected
                  .get(group.id!)
                  ?.some((m) => m.modifierId === mod.id!);
                return (
                  <button
                    key={mod.id}
                    onClick={() =>
                      handleToggle(group.id!, {
                        modifierId: mod.id!,
                        name: mod.name,
                        price: mod.price,
                      }, group.multiSelect, group.maxSelections)
                    }
                    className={`p-3 rounded-xl border-2 text-left transition-all active:scale-[0.97] ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-400'
                        : 'border-gray-200 hover:border-indigo-300 dark:border-[#2a3a54] dark:hover:border-indigo-500'
                    }`}
                  >
                    <span className="font-medium text-gray-800 dark:text-slate-50">{mod.name}</span>
                    {mod.price !== 0 && (
                      <span className={`text-sm ml-1 ${mod.price > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {formatPriceDelta(mod.price)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {missingRequiredGroups.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
            請先選擇必選群組：{missingRequiredGroups.map(({ group }) => group.name).join('、')}
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-slate-300 mb-1 block">備註</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="輸入備註..."
            className="input-field"
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-[#1e2d4a]">
          <div>
            <span className="text-gray-500 dark:text-slate-400 text-sm">總計</span>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatPrice(totalPrice)}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary px-6">
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={groups === undefined || missingRequiredGroups.length > 0}
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
