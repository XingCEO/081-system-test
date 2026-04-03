import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { IconPencil, IconSparkles, IconTrash } from '../../components/ui/Icons';
import Modal from '../../components/ui/Modal';
import { api } from '../../api/client';
import { db } from '../../db/database';
import type { Modifier, ModifierGroup, ModifierRecipeItem } from '../../db/types';
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
  ingredientId: number | null;
  ingredientQuantity: string;
}

interface ModifierRecipeInfo {
  modifierName: string;
  modifierId?: number;
  ingredientId: number | null;
  ingredientName: string;
  quantity: number;
}

export default function ModifierGroupsPanel() {
  const [editTarget, setEditTarget] = useState<ModifierGroupViewModel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModifierGroupViewModel | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const groups = useLiveQuery(async () => {
    const [modifierGroups, modifiers, modifierRecipes, ingredients, products] = await Promise.all([
      db.modifierGroups.orderBy('name').toArray(),
      db.modifiers.toArray(),
      db.modifierRecipes.toArray(),
      db.ingredients.filter((i) => i.isActive).toArray(),
      db.products.filter((product) => product.isActive).toArray(),
    ]);

    const ingredientMap = new Map(ingredients.map((i) => [i.id!, i.name]));

    return modifierGroups.map((group) => ({
      group,
      modifiers: modifiers
        .filter((modifier) => modifier.groupId === group.id)
        .sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name, 'zh-Hant')),
      modifierRecipes,
      ingredientMap,
      productCount: products.filter((product) => product.modifierGroupIds.includes(group.id!)).length,
    }));
  }, []);

  const handleSave = async (draft: ModifierGroupDraft, recipes: ModifierRecipeInfo[]) => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    let rolledBack = false;

    try {
      const isEditing = typeof editTarget?.group.id === 'number';
      const savedGroupId = await saveModifierGroup(editTarget?.group.id, draft);

      try {
        const savedModifiers = await db.modifiers.where('groupId').equals(savedGroupId).toArray();
        for (const recipe of recipes) {
          const modifier = recipe.modifierId
            ? savedModifiers.find((m) => m.id === recipe.modifierId)
            : savedModifiers.find((m) => m.name === recipe.modifierName);
          if (!modifier?.id) continue;

          if (recipe.ingredientId) {
            await api.put(`/modifier-recipes/${modifier.id}`, [{
              ingredientId: recipe.ingredientId,
              ingredientName: recipe.ingredientName,
              quantity: recipe.quantity,
            }]);
          } else {
            await api.put(`/modifier-recipes/${modifier.id}`, []);
          }
        }
      } catch {
        if (!isEditing) {
          rolledBack = true;
          try {
            await deleteModifierGroup(savedGroupId);
          } catch {
            await db.transaction('rw', db.modifierGroups, db.modifiers, async () => {
              await db.modifiers.where('groupId').equals(savedGroupId).delete();
              await db.modifierGroups.delete(savedGroupId);
            });
          }
        }

        throw new Error('MODIFIER_RECIPE_SAVE_FAILED');
      }

      toast.success(editTarget ? '加料群組已更新' : '加料群組已新增');
      setShowForm(false);
      setEditTarget(null);
    } catch {
      toast.error(rolledBack ? '加料群組儲存失敗：配方儲存失敗，已回滾群組' : '加料群組儲存失敗，請稍後再試');
    } finally {
      setIsSaving(false);
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
            <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-50 flex items-center gap-2">
              <IconSparkles className="w-5 h-5 text-amber-500" />
              自訂加料群組
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              可自行管理必選/多選規則與加料品項，商品即可直接套用。
            </p>
          </div>
          <button
            onClick={() => {
              setEditTarget(null);
              setShowForm(true);
            }}
            disabled={isSaving}
            className="btn-primary text-sm self-start md:self-auto disabled:opacity-50"
          >
            + 新增加料群組
          </button>
        </div>

        {groups === undefined ? (
          <div className="card p-6 text-gray-500 dark:text-slate-400">讀取中...</div>
        ) : groups.length === 0 ? (
          <div className="card p-10 text-center text-gray-500 dark:text-slate-400">
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
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-50">
                        {entry.group.name}
                      </h3>
                      <span className="rounded-full bg-gray-100 dark:bg-[#131c2e] px-2.5 py-1 text-xs font-medium text-gray-500 dark:text-slate-300">
                        {entry.group.required ? '必選' : '可選'}
                      </span>
                      <span className="rounded-full bg-gray-100 dark:bg-[#131c2e] px-2.5 py-1 text-xs font-medium text-gray-500 dark:text-slate-300">
                        {entry.group.multiSelect
                          ? `多選，最多 ${entry.group.maxSelections} 項`
                          : '單選'}
                      </span>
                      <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:text-blue-300">
                        套用商品 {entry.productCount}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {entry.modifiers.map((modifier) => {
                        const recipe = entry.modifierRecipes.find((r) => r.modifierId === modifier.id);
                        const ingredientName = recipe ? entry.ingredientMap.get(recipe.ingredientId) : null;
                        return (
                          <span
                            key={modifier.id}
                            className={`rounded-lg border px-3 py-1.5 text-sm ${
                              modifier.isActive
                                ? 'border-gray-200 text-gray-600 dark:border-[#2a3a54] dark:text-slate-300'
                                : 'border-gray-200/70 text-gray-400 dark:border-[#1e2d4a] dark:text-slate-500'
                            }`}
                          >
                            {modifier.name}
                            {modifier.price !== 0 && ` (${formatPriceDelta(modifier.price)})`}
                            {ingredientName && <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">→ {ingredientName} {recipe!.quantity}</span>}
                            {!modifier.isActive && ' · 停用'}
                          </span>
                        );
                      })}
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
          isSaving={isSaving}
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

function createOptionValue(modifier?: Modifier, recipe?: ModifierRecipeItem): ModifierOptionFormValue {
  return {
    localId: typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    id: modifier?.id,
    name: modifier?.name ?? '',
    price: modifier ? String(modifier.price) : '0',
    isActive: modifier?.isActive ?? true,
    ingredientId: recipe?.ingredientId ?? null,
    ingredientQuantity: recipe ? String(recipe.quantity) : '1',
  };
}

function ModifierGroupFormModal({
  group,
  onSave,
  isSaving,
  onClose,
}: {
  group: ModifierGroupViewModel | null;
  onSave: (draft: ModifierGroupDraft, recipes: ModifierRecipeInfo[]) => void;
  isSaving: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const ingredients = useLiveQuery(() => db.ingredients.filter((i) => i.isActive).sortBy('sortOrder'));
  const hasIngredients = ingredients && ingredients.length > 0;
  const [name, setName] = useState(group?.group.name ?? '');
  const [required, setRequired] = useState(group?.group.required ?? false);
  const [multiSelect, setMultiSelect] = useState(group?.group.multiSelect ?? false);
  const [maxSelections, setMaxSelections] = useState(String(group?.group.maxSelections ?? 2));
  const [options, setOptions] = useState<ModifierOptionFormValue[]>([createOptionValue()]);
  const [recipesLoaded, setRecipesLoaded] = useState(!group?.modifiers.length);

  useEffect(() => {
    if (recipesLoaded) return;
    if (!group?.modifiers.length) return;

    async function loadRecipes() {
      const allRecipes = await db.modifierRecipes.toArray();
      setOptions(
        group!.modifiers.map((modifier) => {
          const recipe = allRecipes.find((r) => r.modifierId === modifier.id);
          return createOptionValue(modifier, recipe);
        })
      );
      setRecipesLoaded(true);
    }

    void loadRecipes();
  }, [group, recipesLoaded]);

  const validOptionCount = options.filter((option) => option.name.trim() !== '').length;
  const activeOptionCount = options.filter(
    (option) => option.name.trim() !== '' && option.isActive
  ).length;
  const canSave = name.trim() !== '' && validOptionCount > 0 && activeOptionCount > 0;

  const updateOption = (
    localId: string,
    updates: Partial<Pick<ModifierOptionFormValue, 'name' | 'price' | 'isActive' | 'ingredientId' | 'ingredientQuantity'>>
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

  const handleSubmit = async () => {
    if (!canSave) {
      return;
    }

    const validOptions = options.filter((option) => option.name.trim() !== '');

    const draftModifiers: ModifierDraft[] = validOptions.map((option) => ({
      id: option.id,
      name: option.name.trim(),
      price: Number(option.price || 0),
      isActive: option.isActive,
    }));

    const recipeInfos: ModifierRecipeInfo[] = validOptions.map((option) => ({
      modifierName: option.name.trim(),
      modifierId: option.id,
      ingredientId: option.ingredientId,
      ingredientName: ingredients?.find((i) => i.id === option.ingredientId)?.name ?? '',
      quantity: Number(option.ingredientQuantity) || 1,
    }));

    onSave({
      name: name.trim(),
      required,
      multiSelect,
      maxSelections: multiSelect ? Number(maxSelections || 1) : 1,
      modifiers: draftModifiers,
    }, recipeInfos);
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={group ? '編輯加料群組' : '新增加料群組'}
      size="lg"
    >
      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">
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
          <label className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-[#1e2d4a] px-4 py-3">
            <input
              type="checkbox"
              checked={required}
              onChange={(event) => setRequired(event.target.checked)}
              className="w-5 h-5 rounded"
            />
            <span className="text-sm font-medium text-gray-600 dark:text-slate-300">
              此群組為必選
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-[#1e2d4a] px-4 py-3">
            <input
              type="checkbox"
              checked={multiSelect}
              onChange={(event) => setMultiSelect(event.target.checked)}
              className="w-5 h-5 rounded"
            />
            <span className="text-sm font-medium text-gray-600 dark:text-slate-300">
              允許多選
            </span>
          </label>
        </div>

        {multiSelect && (
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">
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
              <h3 className="font-semibold text-gray-800 dark:text-slate-50">加料選項</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
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
                className="rounded-xl border border-gray-200 dark:border-[#1e2d4a] p-3 space-y-2"
              >
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_auto_auto]">
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
                    placeholder="加價 0"
                  />
                  <label className="flex items-center gap-2 justify-center text-sm text-gray-500 dark:text-slate-300">
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
                {hasIngredients ? (
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_100px]">
                    <select
                      value={option.ingredientId ?? ''}
                      onChange={(event) => updateOption(option.localId, {
                        ingredientId: event.target.value ? Number(event.target.value) : null,
                      })}
                      className="input-field text-sm"
                    >
                      <option value="">不扣庫存</option>
                      {ingredients.map((ingredient) => (
                        <option key={ingredient.id} value={ingredient.id}>
                          扣庫存：{ingredient.name}（{ingredient.unit}）
                        </option>
                      ))}
                    </select>
                    {option.ingredientId && (
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={option.ingredientQuantity}
                        onChange={(event) => updateOption(option.localId, { ingredientQuantity: event.target.value })}
                        className="input-field text-sm"
                        placeholder="數量"
                      />
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    不扣庫存（尚未新增食材，請先到
                    <button
                      type="button"
                      onClick={() => { onClose(); navigate('/inventory'); }}
                      className="text-indigo-500 hover:text-indigo-600 underline mx-0.5"
                    >
                      食材庫存
                    </button>
                    頁面新增食材後即可設定扣庫存）
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            至少需要保留一個啟用中的選項。{hasIngredients ? '選擇「扣庫存」可在點餐時自動扣除對應食材。' : '新增食材後可設定自動扣庫存。'}
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            取消
          </button>
          <button onClick={handleSubmit} disabled={isSaving || !canSave} className="btn-primary flex-1">
            {isSaving ? '處理中...' : group ? '儲存加料群組' : '新增加料群組'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
