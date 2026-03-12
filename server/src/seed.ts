import crypto from 'crypto';
import db from './db.js';

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

export function seedDatabase(): void {
  const count = db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number };
  if (count.c > 0) return; // Already seeded

  const now = new Date().toISOString();

  // ==================== Settings ====================
  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  const settings = [
    ['storeName', JSON.stringify('青青草原')],
    ['storeAddress', JSON.stringify('台北市中山區中山北路100號')],
    ['storePhone', JSON.stringify('02-2345-6789')],
    ['receiptFooter', JSON.stringify('謝謝光臨，歡迎再來！')],
    ['receiptHeader', JSON.stringify('')],
    ['currency', JSON.stringify('NT$')],
    ['orderNumberPrefix', JSON.stringify('')],
    ['autoLogoutMinutes', JSON.stringify(30)],
    ['lowStockDefaultThreshold', JSON.stringify(10)],
    ['enableSound', JSON.stringify(true)],
    ['themeColor', JSON.stringify('#1e40af')],
    ['initialized', JSON.stringify(true)],
  ];

  const seedAll = db.transaction(() => {
    for (const [key, value] of settings) {
      insertSetting.run(key, value);
    }

    // ==================== Employees ====================
    const insertEmployee = db.prepare(
      'INSERT INTO employees (username, pin, name, role, isActive, createdAt) VALUES (?, ?, ?, ?, 1, ?)'
    );
    insertEmployee.run('admin', hashPin('0000'), '管理員', 'admin', now);
    insertEmployee.run('cashier1', hashPin('1234'), '收銀員小明', 'cashier', now);
    insertEmployee.run('kitchen1', hashPin('5678'), '廚師阿華', 'kitchen', now);

    // ==================== Categories ====================
    const insertCategory = db.prepare(
      'INSERT INTO categories (name, description, sortOrder, isActive, icon, color, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?, ?, ?)'
    );
    insertCategory.run('主餐', '飯類主餐', 1, 'rice', '#ef4444', now, now);
    insertCategory.run('麵類', '各式麵食', 2, 'noodle', '#f97316', now, now);
    insertCategory.run('小菜', '開胃小菜', 3, 'salad', '#22c55e', now, now);
    insertCategory.run('飲料', '冷熱飲品', 4, 'cup', '#3b82f6', now, now);
    insertCategory.run('甜點', '餐後甜點', 5, 'cake', '#a855f7', now, now);

    // ==================== Modifier Groups ====================
    const insertModGroup = db.prepare(
      'INSERT INTO modifier_groups (name, required, multiSelect, maxSelections) VALUES (?, ?, ?, ?)'
    );
    insertModGroup.run('辣度', 0, 0, 1);
    insertModGroup.run('加料', 0, 1, 5);
    insertModGroup.run('溫度', 0, 0, 1);
    insertModGroup.run('甜度', 0, 0, 1);
    insertModGroup.run('份量', 0, 0, 1);

    // ==================== Modifiers ====================
    const insertMod = db.prepare(
      'INSERT INTO modifiers (groupId, name, price, isActive) VALUES (?, ?, ?, 1)'
    );
    // 辣度 (1)
    insertMod.run(1, '不辣', 0); insertMod.run(1, '小辣', 0);
    insertMod.run(1, '中辣', 0); insertMod.run(1, '大辣', 0);
    // 加料 (2)
    insertMod.run(2, '加蛋', 15); insertMod.run(2, '加起司', 20);
    insertMod.run(2, '加青菜', 10); insertMod.run(2, '加滷肉', 25);
    insertMod.run(2, '加豆腐', 15);
    // 溫度 (3)
    insertMod.run(3, '熱', 0); insertMod.run(3, '溫', 0);
    insertMod.run(3, '冰', 0); insertMod.run(3, '去冰', 0);
    // 甜度 (4)
    insertMod.run(4, '正常甜', 0); insertMod.run(4, '半糖', 0);
    insertMod.run(4, '微糖', 0); insertMod.run(4, '無糖', 0);
    // 份量 (5)
    insertMod.run(5, '小份', -20); insertMod.run(5, '正常', 0);
    insertMod.run(5, '大份', 30);

    // ==================== Products ====================
    const insertProduct = db.prepare(
      `INSERT INTO products (categoryId, name, description, price, imageUrl, isActive, modifierGroupIds, trackInventory, sortOrder, isCombo, comboItems, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, '', 1, ?, 1, ?, 0, '[]', ?, ?)`
    );
    // 主餐
    insertProduct.run(1, '滷肉飯', '古早味滷肉飯', 85, '[1,2,5]', 1, now, now);
    insertProduct.run(1, '雞腿飯', '香煎雞腿便當', 130, '[1,2,5]', 2, now, now);
    insertProduct.run(1, '排骨飯', '炸排骨便當', 120, '[1,2,5]', 3, now, now);
    insertProduct.run(1, '控肉飯', '東坡控肉飯', 110, '[1,2,5]', 4, now, now);
    insertProduct.run(1, '魚排飯', '酥炸魚排便當', 115, '[1,2,5]', 5, now, now);
    // 麵類
    insertProduct.run(2, '牛肉麵', '紅燒牛肉麵', 160, '[1,2,5]', 1, now, now);
    insertProduct.run(2, '陽春麵', '清湯陽春麵', 60, '[1,2,5]', 2, now, now);
    insertProduct.run(2, '炸醬麵', '古早味炸醬麵', 90, '[1,2,5]', 3, now, now);
    insertProduct.run(2, '乾拌麵', '蔥油乾拌麵', 75, '[1,2,5]', 4, now, now);
    // 小菜
    insertProduct.run(3, '燙青菜', '每日時蔬', 40, '[1]', 1, now, now);
    insertProduct.run(3, '滷蛋', '入味滷蛋', 15, '[]', 2, now, now);
    insertProduct.run(3, '豆干', '滷豆干', 30, '[1]', 3, now, now);
    insertProduct.run(3, '海帶', '涼拌海帶', 30, '[]', 4, now, now);
    insertProduct.run(3, '水餃', '手工水餃(10顆)', 80, '[1,5]', 5, now, now);
    // 飲料
    insertProduct.run(4, '珍珠奶茶', '招牌珍珠奶茶', 60, '[3,4]', 1, now, now);
    insertProduct.run(4, '紅茶', '古早味紅茶', 30, '[3,4]', 2, now, now);
    insertProduct.run(4, '綠茶', '茉莉綠茶', 30, '[3,4]', 3, now, now);
    insertProduct.run(4, '冬瓜茶', '手工冬瓜茶', 35, '[3,4]', 4, now, now);
    insertProduct.run(4, '味噌湯', '日式味噌湯', 35, '[3]', 5, now, now);
    // 甜點
    insertProduct.run(5, '豆花', '傳統豆花', 45, '[3]', 1, now, now);
    insertProduct.run(5, '仙草凍', '手工仙草凍', 40, '[3]', 2, now, now);
    insertProduct.run(5, '芋圓', '手工芋圓', 50, '[3]', 3, now, now);

    // ==================== Dining Tables ====================
    const insertTable = db.prepare(
      `INSERT INTO dining_tables (number, name, capacity, x, y, width, height, shape, status, currentOrderId, floor, isActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', NULL, 1, 1)`
    );
    insertTable.run('A1', '窗邊1', 4, 50, 50, 100, 100, 'square');
    insertTable.run('A2', '窗邊2', 4, 200, 50, 100, 100, 'square');
    insertTable.run('A3', '窗邊3', 2, 350, 50, 80, 80, 'square');
    insertTable.run('B1', '中央1', 6, 50, 200, 140, 100, 'rectangle');
    insertTable.run('B2', '中央2', 6, 240, 200, 140, 100, 'rectangle');
    insertTable.run('C1', '圓桌1', 8, 100, 370, 120, 120, 'round');
    insertTable.run('C2', '圓桌2', 8, 280, 370, 120, 120, 'round');
    insertTable.run('D1', '包廂', 10, 450, 50, 160, 160, 'rectangle');

    // ==================== Ingredients & Inventory ====================
    const insertIngredient = db.prepare(
      'INSERT INTO ingredients (name, unit, costPerUnit, lowStockThreshold, isActive, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, ?, ?, ?)'
    );
    const insertInventory = db.prepare(
      'INSERT INTO inventory (ingredientId, ingredientName, currentStock, lowStockThreshold, unit, lastUpdated) VALUES (?, ?, ?, ?, ?, ?)'
    );

    const ingredients = [
      { name: '白飯', unit: '碗', cost: 12, threshold: 20, stock: 120 },
      { name: '滷肉', unit: '份', cost: 18, threshold: 15, stock: 80 },
      { name: '雞腿排', unit: '片', cost: 45, threshold: 10, stock: 40 },
      { name: '排骨', unit: '片', cost: 42, threshold: 10, stock: 40 },
      { name: '控肉', unit: '份', cost: 38, threshold: 10, stock: 35 },
      { name: '魚排', unit: '片', cost: 36, threshold: 10, stock: 35 },
      { name: '麵條', unit: '球', cost: 10, threshold: 20, stock: 100 },
      { name: '牛肉', unit: '份', cost: 52, threshold: 10, stock: 30 },
      { name: '炸醬', unit: '份', cost: 15, threshold: 12, stock: 50 },
      { name: '青菜', unit: '份', cost: 9, threshold: 15, stock: 60 },
      { name: '雞蛋', unit: '顆', cost: 6, threshold: 20, stock: 100 },
      { name: '豆干', unit: '份', cost: 12, threshold: 12, stock: 45 },
      { name: '海帶', unit: '份', cost: 10, threshold: 12, stock: 45 },
      { name: '水餃', unit: '顆', cost: 2, threshold: 80, stock: 500 },
      { name: '珍珠', unit: '杯份', cost: 8, threshold: 15, stock: 50 },
      { name: '奶茶基底', unit: '杯份', cost: 12, threshold: 15, stock: 50 },
      { name: '茶葉', unit: '杯份', cost: 6, threshold: 20, stock: 80 },
      { name: '冬瓜茶磚', unit: '杯份', cost: 7, threshold: 15, stock: 50 },
      { name: '味噌', unit: '碗份', cost: 9, threshold: 12, stock: 40 },
      { name: '豆花', unit: '碗份', cost: 14, threshold: 12, stock: 40 },
      { name: '仙草凍', unit: '碗份', cost: 13, threshold: 12, stock: 40 },
      { name: '芋圓', unit: '碗份', cost: 15, threshold: 12, stock: 40 },
      { name: '糖水', unit: '碗份', cost: 4, threshold: 20, stock: 80 },
    ];

    ingredients.forEach((ing, i) => {
      const result = insertIngredient.run(ing.name, ing.unit, ing.cost, ing.threshold, i + 1, now, now);
      const ingId = result.lastInsertRowid;
      insertInventory.run(ingId, ing.name, ing.stock, ing.threshold, ing.unit, now);
    });

    // ==================== Product Recipes (BOM) ====================
    const insertRecipe = db.prepare(
      'INSERT INTO product_recipes (productId, ingredientId, ingredientName, quantity) VALUES (?, ?, ?, ?)'
    );

    // Build ingredient name → id map
    const allIngredients = db.prepare('SELECT id, name FROM ingredients').all() as Array<{ id: number; name: string }>;
    const ingMap = new Map(allIngredients.map(r => [r.name, r.id]));

    const recipes: Array<Array<{ ingredient: string; quantity: number }>> = [
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

    const allProducts = db.prepare('SELECT id FROM products ORDER BY id').all() as Array<{ id: number }>;
    recipes.forEach((recipe, i) => {
      const productId = allProducts[i]?.id;
      if (!productId) return;
      for (const item of recipe) {
        const ingredientId = ingMap.get(item.ingredient);
        if (ingredientId) {
          insertRecipe.run(productId, ingredientId, item.ingredient, item.quantity);
        }
      }
    });
  });

  seedAll();
  console.log('Database seeded successfully');
}
