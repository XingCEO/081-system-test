import { db } from './database';
import type { Ingredient, IngredientCategory, ProductRecipeItem } from './types';

interface SeedIngredientInput {
  name: string;
  unit: string;
  costPerUnit: number;
  costPerServing: number;
  lowStockThreshold: number;
  currentStock: number;
  supplier: string;
  ingredientCategory: IngredientCategory;
  notes: string;
}

const d = { costPerServing: 0, supplier: '', ingredientCategory: '其他' as IngredientCategory, notes: '' };

const SEED_INGREDIENTS: SeedIngredientInput[] = [
  { name: '白飯', unit: '碗', costPerUnit: 12, lowStockThreshold: 20, currentStock: 120, ...d, ingredientCategory: '主食' },
  { name: '滷肉', unit: '份', costPerUnit: 18, lowStockThreshold: 15, currentStock: 80, ...d, ingredientCategory: '蛋白質' },
  { name: '雞腿排', unit: '片', costPerUnit: 45, lowStockThreshold: 10, currentStock: 40, ...d, ingredientCategory: '蛋白質' },
  { name: '排骨', unit: '片', costPerUnit: 42, lowStockThreshold: 10, currentStock: 40, ...d, ingredientCategory: '蛋白質' },
  { name: '控肉', unit: '份', costPerUnit: 38, lowStockThreshold: 10, currentStock: 35, ...d, ingredientCategory: '蛋白質' },
  { name: '魚排', unit: '片', costPerUnit: 36, lowStockThreshold: 10, currentStock: 35, ...d, ingredientCategory: '蛋白質' },
  { name: '麵條', unit: '球', costPerUnit: 10, lowStockThreshold: 20, currentStock: 100, ...d, ingredientCategory: '主食' },
  { name: '牛肉', unit: '份', costPerUnit: 52, lowStockThreshold: 10, currentStock: 30, ...d, ingredientCategory: '蛋白質' },
  { name: '炸醬', unit: '份', costPerUnit: 15, lowStockThreshold: 12, currentStock: 50, ...d, ingredientCategory: '醬料' },
  { name: '青菜', unit: '份', costPerUnit: 9, lowStockThreshold: 15, currentStock: 60, ...d, ingredientCategory: '蔬菜' },
  { name: '雞蛋', unit: '顆', costPerUnit: 6, lowStockThreshold: 20, currentStock: 100, ...d, ingredientCategory: '配料' },
  { name: '豆干', unit: '份', costPerUnit: 12, lowStockThreshold: 12, currentStock: 45, ...d, ingredientCategory: '配料' },
  { name: '海帶', unit: '份', costPerUnit: 10, lowStockThreshold: 12, currentStock: 45, ...d, ingredientCategory: '配料' },
  { name: '水餃', unit: '顆', costPerUnit: 2, lowStockThreshold: 80, currentStock: 500, ...d, ingredientCategory: '主食' },
  { name: '珍珠', unit: '杯份', costPerUnit: 8, lowStockThreshold: 15, currentStock: 50, ...d, ingredientCategory: '飲品' },
  { name: '奶茶基底', unit: '杯份', costPerUnit: 12, lowStockThreshold: 15, currentStock: 50, ...d, ingredientCategory: '飲品' },
  { name: '茶葉', unit: '杯份', costPerUnit: 6, lowStockThreshold: 20, currentStock: 80, ...d, ingredientCategory: '飲品' },
  { name: '冬瓜茶磚', unit: '杯份', costPerUnit: 7, lowStockThreshold: 15, currentStock: 50, ...d, ingredientCategory: '飲品' },
  { name: '味噌', unit: '碗份', costPerUnit: 9, lowStockThreshold: 12, currentStock: 40, ...d, ingredientCategory: '醬料' },
  { name: '豆花', unit: '碗份', costPerUnit: 14, lowStockThreshold: 12, currentStock: 40, ...d, ingredientCategory: '配料' },
  { name: '仙草凍', unit: '碗份', costPerUnit: 13, lowStockThreshold: 12, currentStock: 40, ...d, ingredientCategory: '配料' },
  { name: '芋圓', unit: '碗份', costPerUnit: 15, lowStockThreshold: 12, currentStock: 40, ...d, ingredientCategory: '配料' },
  { name: '糖水', unit: '碗份', costPerUnit: 4, lowStockThreshold: 20, currentStock: 80, ...d, ingredientCategory: '配料' },
];

const SEED_COST_INGREDIENTS: SeedIngredientInput[] = [
  { name: '黑胡椒醬+調粉', unit: '份', costPerUnit: 184, costPerServing: 3.1, lowStockThreshold: 15, currentStock: 59, supplier: '青沄', ingredientCategory: '醬料', notes: '調粉(一般+香蒜粉)' },
  { name: '醬油膏', unit: 'g', costPerUnit: 42, costPerServing: 0.024, lowStockThreshold: 500, currentStock: 1750, supplier: '青沄', ingredientCategory: '醬料', notes: '4.5罐塑膠瓶' },
  { name: '青醬包+調味品', unit: '份', costPerUnit: 141, costPerServing: 6.4, lowStockThreshold: 5, currentStock: 22, supplier: '青沄', ingredientCategory: '醬料', notes: '' },
  { name: '紅醬包+調味品', unit: '份', costPerUnit: 197, costPerServing: 8.9, lowStockThreshold: 5, currentStock: 22, supplier: '青沄', ingredientCategory: '醬料', notes: '' },
  { name: '白醬包+調味品', unit: '份', costPerUnit: 197, costPerServing: 6.6, lowStockThreshold: 8, currentStock: 30, supplier: '青沄', ingredientCategory: '醬料', notes: '' },
  { name: '義大利麵', unit: '份', costPerUnit: 164, costPerServing: 5.5, lowStockThreshold: 8, currentStock: 30, supplier: '', ingredientCategory: '主食', notes: '175g/份' },
  { name: '有機黎麥飯', unit: '份', costPerUnit: 74, costPerServing: 5.3, lowStockThreshold: 4, currentStock: 14, supplier: '青沄', ingredientCategory: '主食', notes: '175g/份' },
  { name: '花蛤調味品', unit: 'g', costPerUnit: 7, costPerServing: 0.1, lowStockThreshold: 30, currentStock: 120, supplier: '青沄', ingredientCategory: '醬料', notes: '1平匙=2g/碗(1/2平匙)' },
  { name: '鹽水', unit: 'g', costPerUnit: 1, costPerServing: 0, lowStockThreshold: 100, currentStock: 370, supplier: '', ingredientCategory: '配料', notes: '20g調味品+350g過濾水' },
  { name: '番茄沙拉醬', unit: '份', costPerUnit: 4, costPerServing: 0.4, lowStockThreshold: 3, currentStock: 10, supplier: '', ingredientCategory: '醬料', notes: '' },
  { name: '清檸合風醬', unit: '份', costPerUnit: 6, costPerServing: 0.6, lowStockThreshold: 3, currentStock: 10, supplier: '', ingredientCategory: '醬料', notes: '' },
  { name: '高麗菜罐', unit: '份', costPerUnit: 2, costPerServing: 2.2, lowStockThreshold: 1, currentStock: 1, supplier: '', ingredientCategory: '蔬菜', notes: '' },
  { name: '脆薯', unit: '份', costPerUnit: 202, costPerServing: 11.9, lowStockThreshold: 5, currentStock: 17, supplier: '', ingredientCategory: '配料', notes: '' },
  { name: '鮪魚玉米', unit: '份', costPerUnit: 139, costPerServing: 6.9, lowStockThreshold: 5, currentStock: 20, supplier: '', ingredientCategory: '配料', notes: '' },
  { name: '花生香油醬', unit: 'g', costPerUnit: 26.73, costPerServing: 0.24, lowStockThreshold: 30, currentStock: 110, supplier: '', ingredientCategory: '醬料', notes: '' },
  { name: '雞條', unit: '份', costPerUnit: 750, costPerServing: 9.9, lowStockThreshold: 20, currentStock: 76, supplier: '', ingredientCategory: '蛋白質', notes: '' },
  { name: '梅花豬片', unit: '份', costPerUnit: 223, costPerServing: 8.9, lowStockThreshold: 6, currentStock: 25, supplier: '', ingredientCategory: '蛋白質', notes: '' },
  { name: '草原牛', unit: '份', costPerUnit: 380, costPerServing: 12.7, lowStockThreshold: 8, currentStock: 30, supplier: '', ingredientCategory: '蛋白質', notes: '' },
  { name: '百香果汁', unit: '份', costPerUnit: 176, costPerServing: 11, lowStockThreshold: 4, currentStock: 16, supplier: '', ingredientCategory: '飲品', notes: '' },
  { name: '檸檬汁', unit: '份', costPerUnit: 156, costPerServing: 4.1, lowStockThreshold: 10, currentStock: 38, supplier: '', ingredientCategory: '飲品', notes: '' },
  { name: '牛肋條醬+調粉', unit: '份', costPerUnit: 414, costPerServing: 24.3, lowStockThreshold: 4, currentStock: 17, supplier: '', ingredientCategory: '醬料', notes: '' },
  { name: '梅花豬醬+調粉', unit: '份', costPerUnit: 275, costPerServing: 18.3, lowStockThreshold: 4, currentStock: 15, supplier: '', ingredientCategory: '醬料', notes: '' },
  { name: '冬瓜飲', unit: '份', costPerUnit: 64, costPerServing: 3.2, lowStockThreshold: 5, currentStock: 20, supplier: '', ingredientCategory: '飲品', notes: '' },
  { name: '洛神花乾', unit: '份', costPerUnit: 250, costPerServing: 2.1, lowStockThreshold: 30, currentStock: 120, supplier: '', ingredientCategory: '飲品', notes: '' },
  { name: '花蛤包', unit: '份', costPerUnit: 50, costPerServing: 8.3, lowStockThreshold: 2, currentStock: 6, supplier: '', ingredientCategory: '蛋白質', notes: '' },
  { name: '地瓜', unit: '份', costPerUnit: 110, costPerServing: 5.5, lowStockThreshold: 5, currentStock: 20, supplier: '', ingredientCategory: '蔬菜', notes: '' },
  { name: '醬燒雞腿', unit: '份', costPerUnit: 266, costPerServing: 13.3, lowStockThreshold: 5, currentStock: 20, supplier: '', ingredientCategory: '蛋白質', notes: '' },
  { name: '菇菇', unit: '份', costPerUnit: 150, costPerServing: 2.5, lowStockThreshold: 15, currentStock: 60, supplier: '', ingredientCategory: '蔬菜', notes: '' },
  { name: '雞條調味粉', unit: 'g', costPerUnit: 39, costPerServing: 0.2, lowStockThreshold: 50, currentStock: 180, supplier: '', ingredientCategory: '醬料', notes: '' },
  { name: '油炸物(吸+耗油)', unit: 'g', costPerUnit: 0.05, costPerServing: 4.1, lowStockThreshold: 20, currentStock: 80, supplier: '', ingredientCategory: '配料', notes: '' },
  { name: '肉醬包', unit: '包', costPerUnit: 289, costPerServing: 7.6, lowStockThreshold: 10, currentStock: 38, supplier: '', ingredientCategory: '醬料', notes: '' },
  { name: '松子粒', unit: '份', costPerUnit: 720, costPerServing: 7.2, lowStockThreshold: 25, currentStock: 100, supplier: '', ingredientCategory: '配料', notes: '' },
  { name: '起司片', unit: '片', costPerUnit: 310, costPerServing: 3.7, lowStockThreshold: 20, currentStock: 84, supplier: '', ingredientCategory: '配料', notes: '' },
  { name: '蛋餅皮', unit: '份', costPerUnit: 65, costPerServing: 4.3, lowStockThreshold: 4, currentStock: 15, supplier: '', ingredientCategory: '主食', notes: '1份=2片' },
  { name: '薯餅', unit: '片', costPerUnit: 125, costPerServing: 6.3, lowStockThreshold: 5, currentStock: 20, supplier: '', ingredientCategory: '配料', notes: '' },
  { name: '蘿蔔糕', unit: '份', costPerUnit: 60, costPerServing: 12, lowStockThreshold: 2, currentStock: 5, supplier: '', ingredientCategory: '主食', notes: '1份=2片' },
  { name: '吐司', unit: '份', costPerUnit: 38, costPerServing: 4.8, lowStockThreshold: 2, currentStock: 8, supplier: '', ingredientCategory: '主食', notes: '1份=3片' },
  { name: '雞胸', unit: '片', costPerUnit: 36, costPerServing: 36, lowStockThreshold: 1, currentStock: 1, supplier: '', ingredientCategory: '蛋白質', notes: '' },
  { name: '烏麵', unit: '包', costPerUnit: 1170, costPerServing: 11.7, lowStockThreshold: 25, currentStock: 100, supplier: '', ingredientCategory: '主食', notes: '' },
  { name: '豆漿', unit: '份', costPerUnit: 45, costPerServing: 5.6, lowStockThreshold: 2, currentStock: 8, supplier: '', ingredientCategory: '飲品', notes: '' },
  { name: '鳳梨汁', unit: '份', costPerUnit: 180, costPerServing: 7.4, lowStockThreshold: 6, currentStock: 24, supplier: '', ingredientCategory: '飲品', notes: '' },
  { name: '玉米筍', unit: '份', costPerUnit: 95, costPerServing: 0.7, lowStockThreshold: 35, currentStock: 143, supplier: '', ingredientCategory: '蔬菜', notes: '1包' },
  { name: '花椰', unit: '份', costPerUnit: 60, costPerServing: 0.5, lowStockThreshold: 28, currentStock: 111, supplier: '', ingredientCategory: '蔬菜', notes: '(意麵/燉飯4份)(飯3份)(小沙拉3份)(大沙拉套餐4份)' },
  { name: '沙拉', unit: '份', costPerUnit: 85, costPerServing: 1.7, lowStockThreshold: 12, currentStock: 50, supplier: '', ingredientCategory: '蔬菜', notes: '(吐司3份)(番茄沙醬3份)' },
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

  const allSeedItems = [...SEED_INGREDIENTS, ...SEED_COST_INGREDIENTS];

  await db.ingredients.bulkAdd(
    allSeedItems.map((ingredient, index): Ingredient => ({
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
      currentStock: allSeedItems.find((item) => item.name === ingredient.name)?.currentStock ?? 0,
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
