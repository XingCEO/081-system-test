import { api } from '../api/client';
import { db } from '../db/database';
import type { Modifier, ModifierGroup } from '../db/types';

export interface ModifierDraft {
  id?: number;
  name: string;
  price: number;
  isActive: boolean;
}

export interface ModifierGroupDraft {
  name: string;
  required: boolean;
  multiSelect: boolean;
  maxSelections: number;
  modifiers: ModifierDraft[];
}

function normalizeModifierGroupDraft(draft: ModifierGroupDraft): ModifierGroupDraft {
  const modifiers = draft.modifiers
    .map((modifier) => ({
      id: modifier.id,
      name: modifier.name.trim(),
      price: Number.isFinite(modifier.price) ? modifier.price : 0,
      isActive: modifier.isActive,
    }))
    .filter((modifier) => modifier.name !== '');

  const normalizedMultiSelect = draft.multiSelect;
  const normalizedMaxSelections = normalizedMultiSelect
    ? Math.max(1, Math.min(draft.maxSelections || 1, Math.max(modifiers.length, 1)))
    : 1;

  return {
    name: draft.name.trim(),
    required: draft.required,
    multiSelect: normalizedMultiSelect,
    maxSelections: normalizedMaxSelections,
    modifiers,
  };
}

async function persistModifierGroup(
  group: ModifierGroup,
  modifiers: Modifier[]
): Promise<void> {
  await db.transaction('rw', db.modifierGroups, db.modifiers, async () => {
    await db.modifierGroups.put(group);
    await db.modifiers.where('groupId').equals(group.id!).delete();

    if (modifiers.length > 0) {
      await db.modifiers.bulkPut(modifiers);
    }
  });
}

export async function saveModifierGroup(
  groupId: number | undefined,
  draft: ModifierGroupDraft
): Promise<number> {
  const normalized = normalizeModifierGroupDraft(draft);
  const activeModifierCount = normalized.modifiers.filter((modifier) => modifier.isActive).length;
  if (!normalized.name || normalized.modifiers.length === 0 || activeModifierCount === 0) {
    throw new Error('Modifier group requires a name and at least one active modifier.');
  }

  try {
    const payload = {
      group: {
        name: normalized.name,
        required: normalized.required,
        multiSelect: normalized.multiSelect,
        maxSelections: normalized.maxSelections,
      },
      modifiers: normalized.modifiers.map((modifier) => ({
        id: modifier.id,
        name: modifier.name,
        price: modifier.price,
        isActive: modifier.isActive,
      })),
    };

    const savedGroup = typeof groupId === 'number'
      ? await api.put<ModifierGroup>(`/modifier-groups/${groupId}`, payload)
      : await api.post<ModifierGroup>('/modifier-groups', payload);

    const modifiers = await api.get<Modifier[]>(`/modifiers?groupId=${savedGroup.id}`);
    await persistModifierGroup(savedGroup, modifiers);
    return savedGroup.id!;
  } catch {
    return db.transaction('rw', db.modifierGroups, db.modifiers, async () => {
      const nextGroupId =
        typeof groupId === 'number'
          ? groupId
          : ((await db.modifierGroups.add({
              name: normalized.name,
              required: normalized.required,
              multiSelect: normalized.multiSelect,
              maxSelections: normalized.maxSelections,
            })) as number);

      if (typeof groupId === 'number') {
        await db.modifierGroups.update(groupId, {
          name: normalized.name,
          required: normalized.required,
          multiSelect: normalized.multiSelect,
          maxSelections: normalized.maxSelections,
        });
      }

      const existingModifiers = await db.modifiers.where('groupId').equals(nextGroupId).toArray();
      const keepIds = new Set(
        normalized.modifiers
          .filter((modifier): modifier is ModifierDraft & { id: number } => typeof modifier.id === 'number')
          .map((modifier) => modifier.id)
      );

      await Promise.all(
        existingModifiers
          .filter((modifier) => modifier.id && !keepIds.has(modifier.id))
          .map((modifier) => db.modifiers.delete(modifier.id!))
      );

      for (const modifier of normalized.modifiers) {
        if (typeof modifier.id === 'number') {
          await db.modifiers.update(modifier.id, {
            name: modifier.name,
            price: modifier.price,
            isActive: modifier.isActive,
          });
        } else {
          await db.modifiers.add({
            groupId: nextGroupId,
            name: modifier.name,
            price: modifier.price,
            isActive: modifier.isActive,
          });
        }
      }

      return nextGroupId;
    });
  }
}

export async function deleteModifierGroup(groupId: number): Promise<void> {
  let apiSuccess = false;
  try {
    await api.del(`/modifier-groups/${groupId}`);
    apiSuccess = true;
  } catch {
    // Will fall through to local-only cleanup
  }

  // Only clean up local Dexie if API succeeded or as offline fallback
  if (apiSuccess) {
    // Sync will handle cleanup, but update locally for immediate reactivity
    await db.transaction('rw', db.modifierGroups, db.modifiers, db.products, async () => {
      await db.modifiers.where('groupId').equals(groupId).delete();

      await db.products.toCollection().modify((product) => {
        if (!Array.isArray(product.modifierGroupIds)) {
          return;
        }

        product.modifierGroupIds = product.modifierGroupIds.filter(
          (modifierGroupId: number) => modifierGroupId !== groupId
        );
      });

      await db.modifierGroups.delete(groupId);
    });
  } else {
    throw new Error('無法刪除調味群組，伺服器無回應');
  }
}
