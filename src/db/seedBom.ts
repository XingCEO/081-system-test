import { db } from './database';
import type { Ingredient, ProductRecipeItem } from './types';

interface SeedIngredientInput {
  name: string;
  unit: string;
  costPerUnit: number;
  lowStockThreshold: number;
  currentStock: number;
}

const SEED_INGREDIENTS: SeedIngredientInput[] = [
  { name: '白飯', unit: '碗', costPerUnit: 12, lowStockThreshold: 20, currentStock: 120 },
  { name: '滷肉', unit: '份', costPerUnit: 18, lowStockThreshold: 15, currentStock: 80 },
  { name: '雞腿排', unit: '片', costPerUnit: 45, lowStockThreshold: 10, currentStock: 40 },
  { name: '排骨', unit: '片', costPerUnit: 42, lowStockThreshold: 10, currentStock: 40 },
  { name: '控肉', unit: '份', costPerUnit: 38, lowStockThreshold: 10, currentStock: 35 },
  { name: '魚排', unit: '片', costPerUnit: 36, lowStockThreshold: 10, currentStock: 35 },
  { name: '麵條', unit: '球', costPerUnit: 10, lowStockThreshold: 20, currentStock: 100 },
  { name: '牛肉', unit: '份', costPerUnit: 52, lowStockThreshold: 10, currentStock: 30 },
  { name: '炸醬', unit: '份', costPerUnit: 15, lowStockThreshold: 12, currentStock: 50 },
  { name: '青菜', unit: '份', costPerUnit: 9, lowStockThreshold: 15, currentStock: 60 },
  { name: '雞蛋', unit: '顆', costPerUnit: 6, lowStockThreshold: 20, currentStock: 100 },
  { name: '豆干', unit: '份', costPerUnit: 12, lowStockThreshold: 12, currentStock: 45 },
  { name: '海帶', unit: '份', costPerUnit: 10, lowStockThreshold: 12, currentStock: 45 },
  { name: '水餃', unit: '顆', costPerUnit: 2, lowStockThreshold: 80, currentStock: 500 },
  { name: '珍珠', unit: '杯份', costPerUnit: 8, lowStockThreshold: 15, currentStock: 50 },
  { name: '奶茶基底', unit: '杯份', costPerUnit: 12, lowStockThreshold: 15, currentStock: 50 },
  { name: '茶葉', unit: '杯份', costPerUnit: 6, lowStockThreshold: 20, currentStock: 80 },
  { name: '冬瓜茶磚', unit: '杯份', costPerUnit: 7, lowStockThreshold: 15, currentStock: 50 },
  { name: '味噌', unit: '碗份', costPerUnit: 9, lowStockThreshold: 12, currentStock: 40 },
  { name: '豆花', unit: '碗份', costPerUnit: 14, lowStockThreshold: 12, currentStock: 40 },
  { name: '仙草凍', unit: '碗份', costPerUnit: 13, lowStockThreshold: 12, currentStock: 40 },
  { name: '芋圓', unit: '碗份', costPerUnit: 15, lowStockThreshold: 12, currentStock: 40 },
  { name: '糖水', unit: '碗份', costPerUnit: 4, lowStockThreshold: 20, currentStock: 80 },
];

const PRODUCT_RECIPES_BY_INDEX: Array<Array<{ ingredient: string; quantity: number }>> = [
  [{ ingredient: '白飯', quantity: 1 }, { ingredient: '滷肉', quantity: 1 }],
  [{ ingredient: '白飯', quantity: 1 }, { ingredient: '雞腿排', quantity: 1 }],
  [{ ingredient: '白飯', quantity: 1 }, { ingredient: '排骨', quantity: 1 }],
  [{ ingredient: '白飯', quantity: 1 }, { ingredient: '控肉', quantity: 1 }],
  [{ ingredient: '白飯', quantity: 1 }, { ingredient: '魚排', quantity: 1 }],
  [{ ingredient: '麵條', quantity: 1 }, { ingredient: '牛肉', quantity: 1 }, { ingredient: '青菜', quantity: 0.2 }],
  [{ ingredient: '麵條', quantity: 1 }],
  [{ ingredient: '麵條', quantity: 1 }, { ingredient: '炸醬', quantity: 1 }],
  [{ ingredient: '麵條', quantity: 1 }, { ingredient: '滷肉', quantity: 0.4 }],
  [{ ingredient: '青菜', quantity: 1 }],
  [{ ingredient: '雞蛋', quantity: 1 }],
  [{ ingredient: '豆干', quantity: 1 }],
  [{ ingredient: '海帶', quantity: 1 }],
  [{ ingredient: '水餃', quantity: 10 }],
  [{ ingredient: '珍珠', quantity: 1 }, { ingredient: '奶茶基底', quantity: 1 }],
  [{ ingredient: '茶葉', quantity: 1 }],
  [{ ingredient: '茶葉', quantity: 1 }],
  [{ ingredient: '冬瓜茶磚', quantity: 1 }],
  [{ ingredient: '味噌', quantity: 1 }, { ingredient: '雞蛋', quantity: 0.3 }],
  [{ ingredient: '豆花', quantity: 1 }, { ingredient: '糖水', quantity: 0.2 }],
  [{ ingredient: '仙草凍', quantity: 1 }, { ingredient: '糖水', quantity: 0.2 }],
  [{ ingredient: '芋圓', quantity: 1 }, { ingredient: '糖水', quantity: 0.2 }],
];

export async function seedIngredientData(now: string): Promise<void> {
  if ((await db.ingredients.count()) > 0) {
    return;
  }

  await db.ingredients.bulkAdd(
    SEED_INGREDIENTS.map((ingredient, index): Ingredient => ({
      ...ingredient,
      isActive: true,
      sortOrder: index + 1,
      createdAt: now,
      updatedAt: now,
    }))
  );

  const ingredients = await db.ingredients.orderBy('sortOrder').toArray();
  const ingredientIdByName = new Map(
    ingredients.map((ingredient) => [ingredient.name, ingredient.id ?? 0])
  );

  await db.inventory.bulkAdd(
    ingredients.map((ingredient) => ({
      ingredientId: ingredient.id!,
      ingredientName: ingredient.name,
      currentStock: SEED_INGREDIENTS.find((item) => item.name === ingredient.name)?.currentStock ?? 0,
      lowStockThreshold: ingredient.lowStockThreshold,
      unit: ingredient.unit,
      lastUpdated: now,
    }))
  );

  const products = await db.products.orderBy('sortOrder').toArray();
  const recipeItems: ProductRecipeItem[] = [];

  products.forEach((product, index) => {
    if (!product.id || !product.trackInventory || product.isCombo) {
      return;
    }

    (PRODUCT_RECIPES_BY_INDEX[index] ?? []).forEach((item) => {
      const ingredientId = ingredientIdByName.get(item.ingredient);
      if (!ingredientId) {
        return;
      }

      recipeItems.push({
        productId: product.id!,
        ingredientId,
        ingredientName: item.ingredient,
        quantity: item.quantity,
      });
    });
  });

  if (recipeItems.length > 0) {
    await db.productRecipes.bulkAdd(recipeItems);
  }
}
