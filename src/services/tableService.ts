import { api } from '../api/client';
import { db } from '../db/database';
import type { RestaurantTable } from '../db/types';

export type TableInput = Omit<RestaurantTable, 'id'>;

async function persistTable(table: RestaurantTable): Promise<RestaurantTable> {
  await db.diningTables.put(table);
  return table;
}

export async function createTable(input: TableInput): Promise<RestaurantTable> {
  try {
    const table = await api.post<RestaurantTable>('/tables', input);
    return persistTable(table);
  } catch {
    const id = await db.diningTables.add(input);
    const table = { ...input, id: id as number };
    await db.diningTables.put(table);
    return table;
  }
}

export async function updateTable(
  tableId: number,
  updates: Partial<RestaurantTable>
): Promise<RestaurantTable> {
  const existing = await db.diningTables.get(tableId);
  if (!existing) {
    throw new Error('Table not found');
  }

  const next: RestaurantTable = {
    ...existing,
    ...updates,
    id: tableId,
  };

  try {
    const table = await api.put<RestaurantTable>(`/tables/${tableId}`, next);
    return persistTable(table);
  } catch {
    await db.diningTables.put(next);
    return next;
  }
}

export async function deleteTable(tableId: number): Promise<void> {
  try {
    await api.del(`/tables/${tableId}`);
  } catch {
    // Fall through to local delete.
  }

  await db.diningTables.delete(tableId);
}
