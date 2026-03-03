import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { useCartStore } from '../../stores/useCartStore';
import { formatPrice } from '../../utils/currency';
import Modal from '../../components/ui/Modal';
import type { Product, SelectedModifier } from '../../db/types';

interface ModifierModalProps {
  product: Product;
  onClose: () => void;
}

export default function ModifierModal({ product, onClose }: ModifierModalProps) {
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

  const handleToggle = (groupId: number, mod: SelectedModifier, multiSelect: boolean) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const current = next.get(groupId) || [];

      if (multiSelect) {
        const exists = current.find((m) => m.modifierId === mod.modifierId);
        if (exists) {
          next.set(groupId, current.filter((m) => m.modifierId !== mod.modifierId));
        } else {
          next.set(groupId, [...current, mod]);
        }
      } else {
        const exists = current.find((m) => m.modifierId === mod.modifierId);
        if (exists) {
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

  const handleConfirm = () => {
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
      <div className="space-y-6">
        <div className="text-center">
          <span className="text-3xl font-bold text-blue-600">
            {formatPrice(product.price)}
          </span>
          {product.description && (
            <p className="text-slate-500 mt-1">{product.description}</p>
          )}
        </div>

        {groups?.map(({ group, modifiers }) => (
          <div key={group.id}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-semibold text-slate-900">{group.name}</h3>
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {group.required ? '必選' : '可選'}
                {group.multiSelect ? ' · 可多選' : ''}
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
                      }, group.multiSelect)
                    }
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <span className="font-medium text-slate-900">{mod.name}</span>
                    {mod.price !== 0 && (
                      <span className={`text-sm ml-1 ${mod.price > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {mod.price > 0 ? '+' : ''}{formatPrice(mod.price)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">備註</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="輸入備註..."
            className="input-field"
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div>
            <span className="text-slate-500 text-sm">總計</span>
            <p className="text-2xl font-bold text-blue-600">{formatPrice(totalPrice)}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary px-6">
              取消
            </button>
            <button onClick={handleConfirm} className="btn-primary px-6">
              加入訂單
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
