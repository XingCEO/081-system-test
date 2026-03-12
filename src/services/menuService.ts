import { api } from '../api/client';
import { db } from '../db/database';
import type { Category, Product } from '../db/types';

type CategoryInput = Partial<Category>;
type ProductInput = Partial<Product>;

async function getNextCategorySortOrder(): Promise<number> {
  const last = await db.categories.orderBy('sortOrder').last();
  return (last?.sortOrder ?? 0) + 1;
}

async function getNextProductSortOrder(): Promise<number> {
  const last = await db.products.orderBy('sortOrder').last();
  return (last?.sortOrder ?? 0) + 1;
}

export async function saveCategory(
  categoryId: number | undefined,
  input: CategoryInput
): Promise<Category> {
  const now = new Date().toISOString();
  const existing = typeof categoryId === 'number'
    ? await db.categories.get(categoryId)
    : undefined;

  const next: Category = {
    id: categoryId,
    name: input.name?.trim() ?? existing?.name ?? '',
    description: input.description ?? existing?.description ?? '',
    sortOrder: input.sortOrder ?? existing?.sortOrder ?? await getNextCategorySortOrder(),
    isActive: input.isActive ?? existing?.isActive ?? true,
    icon: input.icon ?? existing?.icon ?? 'restaurant',
    color: input.color ?? existing?.color ?? '',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  try {
    const category = typeof categoryId === 'number'
      ? await api.put<Category>(`/categories/${categoryId}`, next)
      : await api.post<Category>('/categories', next);

    await db.categories.put(category);
    return category;
  } catch {
    if (typeof categoryId === 'number') {
      await db.categories.put(next);
      return next;
    }

    const id = await db.categories.add(next);
    const category = { ...next, id: id as number };
    await db.categories.put(category);
    return category;
  }
}

export async function archiveCategory(categoryId: number): Promise<void> {
  const category = await db.categories.get(categoryId);
  if (!category) {
    throw new Error('Category not found');
  }

  await saveCategory(categoryId, { ...category, isActive: false });
}

export async function saveProduct(
  productId: number | undefined,
  input: ProductInput
): Promise<Product> {
  const now = new Date().toISOString();
  const existing = typeof productId === 'number'
    ? await db.products.get(productId)
    : undefined;

  const next: Product = {
    id: productId,
    categoryId: input.categoryId ?? existing?.categoryId ?? 0,
    name: input.name?.trim() ?? existing?.name ?? '',
    description: input.description ?? existing?.description ?? '',
    price: input.price ?? existing?.price ?? 0,
    imageUrl: input.imageUrl ?? existing?.imageUrl ?? '',
    isActive: input.isActive ?? existing?.isActive ?? true,
    modifierGroupIds: input.modifierGroupIds ?? existing?.modifierGroupIds ?? [],
    trackInventory: input.trackInventory ?? existing?.trackInventory ?? false,
    sortOrder: input.sortOrder ?? existing?.sortOrder ?? await getNextProductSortOrder(),
    isCombo: input.isCombo ?? existing?.isCombo ?? false,
    comboItems: input.comboItems ?? existing?.comboItems ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  try {
    const product = typeof productId === 'number'
      ? await api.put<Product>(`/products/${productId}`, next)
      : await api.post<Product>('/products', next);

    await db.products.put(product);
    return product;
  } catch {
    if (typeof productId === 'number') {
      await db.products.put(next);
      return next;
    }

    const id = await db.products.add(next);
    const product = { ...next, id: id as number };
    await db.products.put(product);
    return product;
  }
}

export async function archiveProduct(productId: number): Promise<void> {
  const product = await db.products.get(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  await saveProduct(productId, { ...product, isActive: false });
}
