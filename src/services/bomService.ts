import { db } from '../db/database';
import type {
  InventoryRecord,
  InventoryTransactionType,
  Product,
  ProductRecipeItem,
} from '../db/types';

export interface RecipeDraftItem {
  ingredientId: number;
  ingredientName: string;
  quantity: number;
}

export type IngredientUsage = RecipeDraftItem;

export interface ProductAvailability {
  availableQuantity: number | null;
  isSoldOut: boolean;
  isLowStock: boolean;
}

export async function getProductRecipe(productId: number): Promise<ProductRecipeItem[]> {
  return db.productRecipes.where('productId').equals(productId).toArray();
}

export async function replaceProductRecipe(
  productId: number,
  items: RecipeDraftItem[]
): Promise<void> {
  await db.transaction('rw', db.productRecipes, async () => {
    await db.productRecipes.where('productId').equals(productId).delete();

    if (items.length === 0) {
      return;
    }

    await db.productRecipes.bulkAdd(
      items.map((item) => ({
        productId,
        ingredientId: item.ingredientId,
        ingredientName: item.ingredientName,
        quantity: item.quantity,
      }))
    );
  });
}

export function mergeIngredientUsages(usages: IngredientUsage[]): IngredientUsage[] {
  const map = new Map<number, IngredientUsage>();

  usages.forEach((usage) => {
    const existing = map.get(usage.ingredientId);
    if (existing) {
      existing.quantity += usage.quantity;
      return;
    }

    map.set(usage.ingredientId, { ...usage });
  });

  return Array.from(map.values());
}

export async function getIngredientUsageForProduct(
  productId: number,
  multiplier = 1
): Promise<IngredientUsage[]> {
  const recipe = await getProductRecipe(productId);
  return recipe.map((item) => ({
    ingredientId: item.ingredientId,
    ingredientName: item.ingredientName,
    quantity: item.quantity * multiplier,
  }));
}

export async function applyIngredientStockChange(params: {
  usages: IngredientUsage[];
  employeeId: number;
  note: string;
  orderId: number | null;
  type: InventoryTransactionType;
  restore?: boolean;
}): Promise<void> {
  const now = new Date().toISOString();
  const normalizedUsages = mergeIngredientUsages(params.usages);

  for (const usage of normalizedUsages) {
    const record = await db.inventory.where('ingredientId').equals(usage.ingredientId).first();
    if (!record?.id) {
      continue;
    }

    const previousStock = record.currentStock;
    const quantityDelta = params.restore ? usage.quantity : -usage.quantity;
    const newStock = params.restore
      ? previousStock + usage.quantity
      : Math.max(0, previousStock - usage.quantity);

    await db.inventory.update(record.id, {
      currentStock: newStock,
      lastUpdated: now,
    });

    await db.inventoryTransactions.add({
      ingredientId: usage.ingredientId,
      ingredientName: usage.ingredientName,
      type: params.type,
      quantity: quantityDelta,
      previousStock,
      newStock,
      orderId: params.orderId,
      note: params.note,
      employeeId: params.employeeId,
      createdAt: now,
    });
  }
}

function buildUsageMap(
  products: Product[],
  recipes: ProductRecipeItem[]
): Map<number, IngredientUsage[]> {
  const recipeByProduct = new Map<number, IngredientUsage[]>();
  const productById = new Map(products.filter((product) => product.id).map((product) => [product.id!, product]));

  const directRecipeMap = new Map<number, IngredientUsage[]>();
  recipes.forEach((recipe) => {
    const existing = directRecipeMap.get(recipe.productId) ?? [];
    existing.push({
      ingredientId: recipe.ingredientId,
      ingredientName: recipe.ingredientName,
      quantity: recipe.quantity,
    });
    directRecipeMap.set(recipe.productId, existing);
  });

  const resolveProductUsage = (productId: number): IngredientUsage[] => {
    const cached = recipeByProduct.get(productId);
    if (cached) {
      return cached;
    }

    const product = productById.get(productId);
    if (!product || !product.trackInventory) {
      recipeByProduct.set(productId, []);
      return [];
    }

    if (product.isCombo && product.comboItems?.length) {
      const comboUsage = mergeIngredientUsages(
        product.comboItems.flatMap((item) =>
          resolveProductUsage(item.productId).map((usage) => ({
            ...usage,
            quantity: usage.quantity * item.quantity,
          }))
        )
      );
      recipeByProduct.set(productId, comboUsage);
      return comboUsage;
    }

    const directUsage = directRecipeMap.get(productId) ?? [];
    recipeByProduct.set(productId, directUsage);
    return directUsage;
  };

  products.forEach((product) => {
    if (product.id) {
      resolveProductUsage(product.id);
    }
  });

  return recipeByProduct;
}

function calculateAvailabilityForUsage(
  usage: IngredientUsage[],
  inventoryByIngredientId: Map<number, InventoryRecord>
): ProductAvailability {
  if (usage.length === 0) {
    return {
      availableQuantity: null,
      isSoldOut: false,
      isLowStock: false,
    };
  }

  const availableQuantity = usage.reduce<number>((lowest, item) => {
    const inventory = inventoryByIngredientId.get(item.ingredientId);
    if (!inventory) {
      return 0;
    }

    const servings = item.quantity <= 0 ? Number.POSITIVE_INFINITY : Math.floor(inventory.currentStock / item.quantity);
    return Math.min(lowest, servings);
  }, Number.POSITIVE_INFINITY);

  const normalizedAvailability =
    availableQuantity === Number.POSITIVE_INFINITY ? null : availableQuantity;

  return {
    availableQuantity: normalizedAvailability,
    isSoldOut: normalizedAvailability !== null && normalizedAvailability <= 0,
    isLowStock: normalizedAvailability !== null && normalizedAvailability > 0 && normalizedAvailability <= 5,
  };
}

export async function getProductAvailabilityMap(): Promise<Map<number, ProductAvailability>> {
  const [products, recipes, inventory] = await Promise.all([
    db.products.toArray(),
    db.productRecipes.toArray(),
    db.inventory.toArray(),
  ]);

  const usageMap = buildUsageMap(products, recipes);
  const inventoryByIngredientId = new Map(
    inventory.map((record) => [record.ingredientId, record])
  );
  const availabilityMap = new Map<number, ProductAvailability>();

  products.forEach((product) => {
    if (!product.id) {
      return;
    }

    availabilityMap.set(
      product.id,
      calculateAvailabilityForUsage(
        usageMap.get(product.id) ?? [],
        inventoryByIngredientId
      )
    );
  });

  return availabilityMap;
}
