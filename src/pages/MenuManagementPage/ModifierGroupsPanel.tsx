import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { IconPencil, IconSparkles, IconTrash } from '../../components/ui/Icons';
import Modal from '../../components/ui/Modal';
import { db } from '../../db/database';
import type { Modifier, ModifierGroup } from '../../db/types';
import {
  deleteModifierGroup,
  saveModifierGroup,
  type ModifierDraft,
  type ModifierGroupDraft,
} from '../../services/modifierGroupService';
import { formatPriceDelta } from '../../utils/currency';

interface ModifierGroupViewModel {
  group: ModifierGroup;
  modifiers: Modifier[];
  productCount: number;
}

interface ModifierOptionFormValue {
  localId: string;
  id?: number;
  name: string;
  price: string;
  isActive: boolean;
}

export default function ModifierGroupsPanel() {
  const [editTarget, setEditTarget] = useState<ModifierGroupViewModel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModifierGroupViewModel | null>(null);
  const [showForm, setShowForm] = useState(false);

  const groups = useLiveQuery(async () => {
    const [modifierGroups, modifiers, products] = await Promise.all([
      db.modifierGroups.orderBy('name').toArray(),
      db.modifiers.toArray(),
      db.products.filter((product) => product.isActive).toArray(),
    ]);

    return modifierGroups.map((group) => ({
      group,
      modifiers: modifiers
        .filter((modifier) => modifier.groupId === group.id)
        .sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name, 'zh-Hant')),
      productCount: products.filter((product) => product.modifierGroupIds.includes(group.id!)).length,
    }));
  }, []);

  const handleSave = async (draft: ModifierGroupDraft) => {
    try {
      await saveModifierGroup(editTarget?.group.id, draft);
      toast.success(editTarget ? '加料群組已更新' : '加料群組已新增');
      setShowForm(false);
      setEditTarget(null);
    } catch {
      toast.error('加料群組儲存失敗');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.group.id) {
      return;
    }

    try {
      await deleteModifierGroup(deleteTarget.group.id);
      toast.success('加料群組已刪除');
      setDeleteTarget(null);
    } catch {
      toast.error('加料群組刪除失敗');
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="card p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <IconSparkles className="w-5 h-5 text-amber-500" />
              自訂加料群組
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              可自行管理必選/多選規則與加料品項，商品即可直接套用。
            </p>
          </div>
          <button
            onClick={() => {
              setEditTarget(null);
              setShowForm(true);
            }}
            className="btn-primary text-sm self-start md:self-auto"
          >
            + 新增加料群組
          </button>
        </div>

        {groups === undefined ? (
          <div className="card p-6 text-slate-500 dark:text-slate-400">讀取中...</div>
        ) : groups.length === 0 ? (
          <div className="card p-10 text-center text-slate-500 dark:text-slate-400">
            尚未建立任何加料群組。
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((entry, index) => (
              <div
                key={entry.group.id}
                className={`card p-5 animate-slide-up stagger-${Math.min(index + 1, 6)}`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {entry.group.name}
                      </h3>
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {entry.group.required ? '必選' : '可選'}
                      </span>
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {entry.group.multiSelect
                          ? `多選，最多 ${entry.group.maxSelections} 項`
                          : '單選'}
                      </span>
                      <span className="rounded-full bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                        套用商品 {entry.productCount}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {entry.modifiers.map((modifier) => (
                        <span
                          key={modifier.id}
                          className={`rounded-lg border px-3 py-1.5 text-sm ${
                            modifier.isActive
                              ? 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                              : 'border-slate-200/70 text-slate-400 dark:border-slate-800 dark:text-slate-500'
                          }`}
                        >
                          {modifier.name}
                          {modifier.price !== 0 && ` (${formatPriceDelta(modifier.price)})`}
                          {!modifier.isActive && ' · 停用'}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 self-start">
                    <button
                      onClick={() => {
                        setEditTarget(entry);
                        setShowForm(true);
                      }}
                      className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1.5"
                    >
                      <IconPencil className="w-4 h-4" />
                      編輯
                    </button>
                    <button
                      onClick={() => setDeleteTarget(entry)}
                      className="btn-danger text-sm px-3 py-1.5 flex items-center gap-1.5"
                    >
                      <IconTrash className="w-4 h-4" />
                      刪除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <ModifierGroupFormModal
          group={editTarget}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditTarget(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="刪除加料群組"
        message={
          deleteTarget
            ? `確定要刪除「${deleteTarget.group.name}」？刪除後會同步移除 ${deleteTarget.productCount} 個商品上的套用設定。`
            : ''
        }
        confirmText="確認刪除"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

function createOptionValue(modifier?: Modifier): ModifierOptionFormValue {
  return {
    localId: typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    id: modifier?.id,
    name: modifier?.name ?? '',
    price: modifier ? String(modifier.price) : '0',
    isActive: modifier?.isActive ?? true,
  };
}

function ModifierGroupFormModal({
  group,
  onSave,
  onClose,
}: {
  group: ModifierGroupViewModel | null;
  onSave: (draft: ModifierGroupDraft) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.group.name ?? '');
  const [required, setRequired] = useState(group?.group.required ?? false);
  const [multiSelect, setMultiSelect] = useState(group?.group.multiSelect ?? false);
  const [maxSelections, setMaxSelections] = useState(String(group?.group.maxSelections ?? 2));
  const [options, setOptions] = useState<ModifierOptionFormValue[]>(
    group?.modifiers.length
      ? group.modifiers.map((modifier) => createOptionValue(modifier))
      : [createOptionValue()]
  );

  const validOptionCount = options.filter((option) => option.name.trim() !== '').length;
  const activeOptionCount = options.filter(
    (option) => option.name.trim() !== '' && option.isActive
  ).length;
  const canSave = name.trim() !== '' && validOptionCount > 0 && activeOptionCount > 0;

  const updateOption = (
    localId: string,
    updates: Partial<Pick<ModifierOptionFormValue, 'name' | 'price' | 'isActive'>>
  ) => {
    setOptions((current) =>
      current.map((option) =>
        option.localId === localId ? { ...option, ...updates } : option
      )
    );
  };

  const removeOption = (localId: string) => {
    setOptions((current) => current.filter((option) => option.localId !== localId));
  };

  const handleSubmit = () => {
    if (!canSave) {
      return;
    }

    const draftModifiers: ModifierDraft[] = options
      .map((option) => ({
        id: option.id,
        name: option.name.trim(),
        price: Number(option.price || 0),
        isActive: option.isActive,
      }))
      .filter((option) => option.name !== '');

    onSave({
      name: name.trim(),
      required,
      multiSelect,
      maxSelections: multiSelect ? Number(maxSelections || 1) : 1,
      modifiers: draftModifiers,
    });
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={group ? '編輯加料群組' : '新增加料群組'}
      size="lg"
    >
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">
            群組名稱 *
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="input-field"
            placeholder="例如：加蛋 / 甜度冰塊 / 配菜升級"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3">
            <input
              type="checkbox"
              checked={required}
              onChange={(event) => setRequired(event.target.checked)}
              className="w-5 h-5 rounded"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              此群組為必選
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3">
            <input
              type="checkbox"
              checked={multiSelect}
              onChange={(event) => setMultiSelect(event.target.checked)}
              className="w-5 h-5 rounded"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              允許多選
            </span>
          </label>
        </div>

        {multiSelect && (
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">
              最多可選數量
            </label>
            <input
              type="number"
              min={1}
              value={maxSelections}
              onChange={(event) => setMaxSelections(event.target.value)}
              className="input-field max-w-xs"
            />
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">加料選項</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                可設定加價或折扣，負數代表折扣。
              </p>
            </div>
            <button
              onClick={() => setOptions((current) => [...current, createOptionValue()])}
              className="btn-secondary text-sm"
            >
              + 新增選項
            </button>
          </div>

          <div className="space-y-2">
            {options.map((option) => (
              <div
                key={option.localId}
                className="grid gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3 md:grid-cols-[minmax(0,1fr)_140px_auto_auto]"
              >
                <input
                  value={option.name}
                  onChange={(event) => updateOption(option.localId, { name: event.target.value })}
                  className="input-field"
                  placeholder="例如：加蛋 / 半糖 / 去冰"
                />
                <input
                  type="number"
                  value={option.price}
                  onChange={(event) => updateOption(option.localId, { price: event.target.value })}
                  className="input-field"
                  placeholder="0"
                />
                <label className="flex items-center gap-2 justify-center text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={option.isActive}
                    onChange={(event) =>
                      updateOption(option.localId, { isActive: event.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  啟用
                </label>
                <button
                  onClick={() => removeOption(option.localId)}
                  className="text-sm font-medium text-red-500 hover:text-red-600"
                >
                  移除
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            至少需要保留一個啟用中的選項，商品才能在 POS 端正常使用這個群組。
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            取消
          </button>
          <button onClick={handleSubmit} disabled={!canSave} className="btn-primary flex-1">
            {group ? '儲存加料群組' : '新增加料群組'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
