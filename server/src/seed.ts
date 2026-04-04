import crypto from 'crypto';
import db from './db.js';

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

export function seedDatabase(): void {
  const settingsCount = (db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number }).c;
  const categoriesCount = (db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }).c;

  if (settingsCount > 0 && categoriesCount > 0) return;

  // Clear everything for a clean re-seed
  const tables = ['product_recipes', 'inventory', 'inventory_transactions', 'order_items', 'orders',
    'modifiers', 'modifier_groups', 'products', 'categories', 'ingredients',
    'dining_tables', 'shifts', 'employees', 'daily_summaries', 'settings'];
  for (const table of tables) {
    db.prepare(`DELETE FROM ${table}`).run();
  }

  const now = new Date().toISOString();

  // ==================== Settings ====================
  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  const settings = [
    ['storeName', JSON.stringify('青青草原廚房')],
    ['storeAddress', JSON.stringify('')],
    ['storePhone', JSON.stringify('8261-0198')],
    ['receiptFooter', JSON.stringify('謝謝光臨，歡迎再來！')],
    ['receiptHeader', JSON.stringify('全系列有機蔗糖/100%奶粉/無化學香料/無化學色素')],
    ['currency', JSON.stringify('NT$')],
    ['orderNumberPrefix', JSON.stringify('')],
    ['autoLogoutMinutes', JSON.stringify(30)],
    ['lowStockDefaultThreshold', JSON.stringify(10)],
    ['enableSound', JSON.stringify(true)],
    ['themeColor', JSON.stringify('#4f46e5')],
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
    insertCategory.run('燉飯', '有機藜麥燉飯', 1, 'rice', '#ef4444', now, now);
    insertCategory.run('飯類', '燴飯/醬汁/丼飯', 2, 'rice', '#f97316', now, now);
    insertCategory.run('沙拉', '有機高麗菜綜合沙拉', 3, 'salad', '#22c55e', now, now);
    insertCategory.run('吐司', '果醬吐司/總匯吐司蛋', 4, 'restaurant', '#eab308', now, now);
    insertCategory.run('捲餅', '虎皮蛋捲餅(含蔬菜)', 5, 'restaurant', '#f59e0b', now, now);
    insertCategory.run('烏龍麵', '鍋炒烏龍麵', 6, 'noodle', '#8b5cf6', now, now);
    insertCategory.run('蘿蔔糕', '蘿蔔糕系列', 7, 'restaurant', '#ec4899', now, now);
    insertCategory.run('點心', '單點小食', 8, 'cake', '#14b8a6', now, now);
    insertCategory.run('茶飲', '紅茶/奶茶/豆漿', 9, 'cup', '#3b82f6', now, now);
    insertCategory.run('冬瓜飲', '四種成份冬瓜飲', 10, 'cup', '#10b981', now, now);
    insertCategory.run('咖啡', '有機阿拉比卡咖啡', 11, 'cup', '#78350f', now, now);
    insertCategory.run('果汁/其他', '果汁/果粒/牛奶', 12, 'cup', '#a855f7', now, now);

    // ==================== Modifier Groups ====================
    const insertModGroup = db.prepare(
      'INSERT INTO modifier_groups (name, required, multiSelect, maxSelections) VALUES (?, ?, ?, ?)'
    );
    insertModGroup.run('醬料', 1, 0, 1);        // 1 - 燉飯醬料 required single
    insertModGroup.run('主食', 1, 0, 1);         // 2 - 麵/飯 required single
    insertModGroup.run('沙拉醬', 1, 0, 1);       // 3 - 沙拉醬 required single
    insertModGroup.run('加料', 0, 1, 2);          // 4 - 起司/花生醬 optional multi
    insertModGroup.run('溫度', 1, 0, 1);          // 5 - 溫/涼 required single
    insertModGroup.run('甜度', 0, 0, 1);          // 6 - 無糖/加糖 optional single

    // ==================== Modifiers ====================
    const insertMod = db.prepare(
      'INSERT INTO modifiers (groupId, name, price, isActive) VALUES (?, ?, ?, 1)'
    );
    // 醬料 (1)
    insertMod.run(1, '青醬(五辛)', 0);
    insertMod.run(1, '蒜香黑胡椒', 0);
    insertMod.run(1, '紅醬(五辛)', 0);
    insertMod.run(1, '白醬(五辛)', 0);
    insertMod.run(1, '白醬(奶素)', 0);
    // 主食 (2)
    insertMod.run(2, '麵', 0);
    insertMod.run(2, '飯', 0);
    // 沙拉醬 (3)
    insertMod.run(3, '番茄沙拉醬', 0);
    insertMod.run(3, '青檸醬', 0);
    insertMod.run(3, '不醬', 0);
    // 加料 (4)
    insertMod.run(4, '加起司', 10);
    insertMod.run(4, '加花生醬', 10);
    // 溫度 (5)
    insertMod.run(5, '溫', 0);
    insertMod.run(5, '涼', 0);
    // 甜度 (6)
    insertMod.run(6, '無糖', 0);
    insertMod.run(6, '加糖', 0);

    // ==================== Products ====================
    const insertProduct = db.prepare(
      `INSERT INTO products (categoryId, name, description, price, imageUrl, isActive, modifierGroupIds, trackInventory, sortOrder, isCombo, comboItems, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, '', 1, ?, 1, ?, 0, '[]', ?, ?)`
    );

    // --- 1. 燉飯 (categoryId=1) modifiers: 醬料[1], 主食[2] ---
    insertProduct.run(1, '松子粒燉飯(素)', '有機藜麥燉飯', 125, '[1,2]', 1, now, now);
    insertProduct.run(1, '菇菇燉飯(素)', '有機藜麥燉飯', 145, '[1,2]', 2, now, now);
    insertProduct.run(1, '黑豬肉燉飯', '100%黑豬肉', 145, '[1,2]', 3, now, now);
    insertProduct.run(1, '菲瑞牛燉飯', '100%菲瑞牛', 145, '[1,2]', 4, now, now);
    insertProduct.run(1, '花蛤燉飯', '新鮮花蛤', 150, '[1,2]', 5, now, now);
    insertProduct.run(1, '炸雞條燉飯', '100%炸雞條', 150, '[1,2]', 6, now, now);
    insertProduct.run(1, '醬燒雞腿燉飯', '100%醬燒雞腿', 160, '[1,2]', 7, now, now);
    insertProduct.run(1, '舒肥雞胸燉飯', '100%舒肥雞胸', 160, '[1,2]', 8, now, now);

    // --- 2. 飯類 (categoryId=2) ---
    insertProduct.run(2, '燴飯 黑豬醬', '有機藜麥白飯虎皮蛋', 90, '[]', 1, now, now);
    insertProduct.run(2, '燴飯 菇菇(蛋素)', '有機藜麥白飯虎皮蛋', 90, '[]', 2, now, now);
    insertProduct.run(2, '醬汁 杏鮑菇菇(素)', '有機藜麥白飯虎皮蛋', 90, '[]', 3, now, now);
    insertProduct.run(2, '醬汁 梅花豬', '100%梅花豬', 90, '[]', 4, now, now);
    insertProduct.run(2, '醬汁 炸雞條', '100%炸雞條', 95, '[]', 5, now, now);
    insertProduct.run(2, '醬汁 菲瑞牛', '100%菲瑞牛', 105, '[]', 6, now, now);
    insertProduct.run(2, '醬汁 醬燒雞腿', '100%醬燒雞腿', 135, '[]', 7, now, now);
    insertProduct.run(2, '醬汁 舒肥雞胸', '100%舒肥雞胸', 150, '[]', 8, now, now);
    insertProduct.run(2, '丼飯 洋蔥醬燒豬', '洋蔥醬燒', 115, '[]', 9, now, now);
    insertProduct.run(2, '丼飯 洋蔥醬燒牛肋條', '洋蔥醬燒', 135, '[]', 10, now, now);

    // --- 3. 沙拉 (categoryId=3) modifier: 沙拉醬[3] ---
    insertProduct.run(3, '菲瑞牛沙拉(蛋)', '有機高麗菜綜合沙拉', 160, '[3]', 1, now, now);
    insertProduct.run(3, '醬燒雞腿沙拉(蛋)', '有機高麗菜綜合沙拉', 165, '[3]', 2, now, now);
    insertProduct.run(3, '舒肥雞胸沙拉(蛋)', '有機高麗菜綜合沙拉', 170, '[3]', 3, now, now);

    // --- 4. 吐司 (categoryId=4) modifier: 加料[4] ---
    insertProduct.run(4, '花生醬吐司(蛋奶素)', '果醬吐司2片', 45, '[]', 1, now, now);
    insertProduct.run(4, '堅果醬吐司(蛋奶素)', '綜合堅果醬吐司2片', 50, '[]', 2, now, now);
    insertProduct.run(4, '總匯吐司 玉米(素)', '總匯吐司蛋', 55, '[4]', 3, now, now);
    insertProduct.run(4, '總匯吐司 薯餅(素)', '總匯吐司蛋', 65, '[4]', 4, now, now);
    insertProduct.run(4, '總匯吐司 鮪魚玉米', '總匯吐司蛋', 70, '[4]', 5, now, now);
    insertProduct.run(4, '總匯吐司 杏鮑菇(素)', '總匯吐司蛋', 75, '[4]', 6, now, now);
    insertProduct.run(4, '總匯吐司 梅花豬', '總匯吐司蛋', 75, '[4]', 7, now, now);
    insertProduct.run(4, '總匯吐司 菲瑞牛', '總匯吐司蛋', 80, '[4]', 8, now, now);
    insertProduct.run(4, '總匯吐司 炸雞條', '總匯吐司蛋', 85, '[4]', 9, now, now);
    insertProduct.run(4, '總匯吐司 舒肥雞胸', '總匯吐司蛋', 110, '[4]', 10, now, now);

    // --- 5. 捲餅 (categoryId=5) modifier: 加料[4] ---
    insertProduct.run(5, '捲餅 原味(素)', '虎皮蛋捲餅(含蔬菜)', 50, '[4]', 1, now, now);
    insertProduct.run(5, '捲餅 玉米(素)', '虎皮蛋捲餅(含蔬菜)', 60, '[4]', 2, now, now);
    insertProduct.run(5, '捲餅 薯餅(素)', '虎皮蛋捲餅(含蔬菜)', 70, '[4]', 3, now, now);
    insertProduct.run(5, '捲餅 杏鮑菇(素)', '虎皮蛋捲餅(含蔬菜)', 75, '[4]', 4, now, now);
    insertProduct.run(5, '捲餅 梅花豬', '虎皮蛋捲餅(含蔬菜)', 75, '[4]', 5, now, now);
    insertProduct.run(5, '捲餅 菲瑞牛', '虎皮蛋捲餅(含蔬菜)', 80, '[4]', 6, now, now);
    insertProduct.run(5, '捲餅 鮪魚玉米大板燒', '虎皮蛋捲餅(含蔬菜)', 80, '[4]', 7, now, now);

    // --- 6. 烏龍麵 (categoryId=6) ---
    insertProduct.run(6, '黑胡椒烏龍麵', '100%黑胡椒鍋炒', 90, '[]', 1, now, now);
    insertProduct.run(6, '杏鮑菇菇烏龍麵(素)', '鍋炒烏龍麵', 100, '[]', 2, now, now);
    insertProduct.run(6, '黑豬肉烏龍麵', '100%黑豬肉鍋炒', 100, '[]', 3, now, now);
    insertProduct.run(6, '黑豬肉黑胡椒烏龍麵', '鍋炒烏龍麵', 110, '[]', 4, now, now);
    insertProduct.run(6, '杏鮑菇黑胡椒烏龍麵', '鍋炒烏龍麵', 110, '[]', 5, now, now);

    // --- 7. 蘿蔔糕 (categoryId=7) ---
    insertProduct.run(7, '蘿蔔糕X2+煎蛋', '基本款', 50, '[]', 1, now, now);
    insertProduct.run(7, '梅花豬蘿蔔糕(蛋)', '蘿蔔糕系列', 85, '[]', 2, now, now);
    insertProduct.run(7, '菲瑞牛蘿蔔糕(蛋)', '蘿蔔糕系列', 90, '[]', 3, now, now);
    insertProduct.run(7, '醬燒雞腿蘿蔔糕(蛋)', '蘿蔔糕系列', 115, '[]', 4, now, now);
    insertProduct.run(7, '舒肥雞胸蘿蔔糕(蛋)', '蘿蔔糕系列', 120, '[]', 5, now, now);

    // --- 8. 點心 (categoryId=8) ---
    insertProduct.run(8, '荷包蛋', '', 15, '[]', 1, now, now);
    insertProduct.run(8, '薯餅(素)', '一片', 25, '[]', 2, now, now);
    insertProduct.run(8, '地瓜(素)', '', 45, '[]', 3, now, now);
    insertProduct.run(8, '有機高麗菜沙拉', '', 50, '[]', 4, now, now);
    insertProduct.run(8, '港式蘿蔔糕(葷)', '', 45, '[]', 5, now, now);
    insertProduct.run(8, '花蛤湯', '', 50, '[]', 6, now, now);
    insertProduct.run(8, '脆薯條', '', 50, '[]', 7, now, now);
    insertProduct.run(8, '炸雞條', '100%炸雞條', 60, '[]', 8, now, now);

    // --- 9. 茶飲 (categoryId=9) modifier: 溫度[5], 甜度[6] ---
    insertProduct.run(9, '有機蔗糖紅茶(中)', '中杯', 30, '[5,6]', 1, now, now);
    insertProduct.run(9, '有機蔗糖紅茶(大)', '大杯', 35, '[5,6]', 2, now, now);
    insertProduct.run(9, '三種成份奶茶(中)', '中杯', 50, '[5,6]', 3, now, now);
    insertProduct.run(9, '三種成份奶茶(大)', '大杯', 60, '[5,6]', 4, now, now);
    insertProduct.run(9, '豆漿', '非基改黃豆·中杯', 30, '[5,6]', 5, now, now);
    insertProduct.run(9, '豆漿紅茶', '中杯', 30, '[5,6]', 6, now, now);

    // --- 10. 冬瓜飲 (categoryId=10) modifier: 溫度[5] ---
    insertProduct.run(10, '原味冬瓜飲', '大杯', 35, '[5]', 1, now, now);
    insertProduct.run(10, '冬瓜鳳梨果汁', '大杯', 55, '[5]', 2, now, now);
    insertProduct.run(10, '冬瓜百香果果汁', '大杯', 55, '[5]', 3, now, now);
    insertProduct.run(10, '冬瓜檸檬果汁', '大杯', 55, '[5]', 4, now, now);

    // --- 11. 咖啡 (categoryId=11) modifier: 溫度[5], 甜度[6] ---
    insertProduct.run(11, '有機美式咖啡(中)', '中杯', 60, '[5,6]', 1, now, now);
    insertProduct.run(11, '有機美式咖啡(大)', '大杯', 75, '[5,6]', 2, now, now);
    insertProduct.run(11, '有機拿鐵(中)', '100%奶粉·中杯', 70, '[5,6]', 3, now, now);
    insertProduct.run(11, '有機拿鐵(大)', '100%奶粉·大杯', 85, '[5,6]', 4, now, now);

    // --- 12. 果汁/其他 (categoryId=12) modifier: 溫度[5], 甜度[6] ---
    insertProduct.run(12, '洛神乾果粒', '含仙楂無花果·中杯', 50, '[5,6]', 1, now, now);
    insertProduct.run(12, '100%奶粉', '中杯', 50, '[5,6]', 2, now, now);
    insertProduct.run(12, '鳳梨果汁', '100%果汁·大杯', 55, '[]', 3, now, now);
    insertProduct.run(12, '百香果果汁', '100%果汁·大杯', 55, '[]', 4, now, now);
    insertProduct.run(12, '檸檬果汁', '100%果汁·大杯', 55, '[]', 5, now, now);

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

    const insertIngredient = db.prepare(
      `INSERT INTO ingredients (name, unit, costPerUnit, costPerServing, lowStockThreshold, isActive, sortOrder, supplier, ingredientCategory, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`
    );
    const insertInventory = db.prepare(
      `INSERT INTO inventory (ingredientId, ingredientName, currentStock, lowStockThreshold, unit, lastUpdated)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const costItems: Array<{ name: string; unit: string; costPerUnit: number; costPerServing: number; lowStockThreshold: number; currentStock: number; supplier: string; category: string; notes: string }> = [
      { name: '黑胡椒醬+調粉', unit: '份', costPerUnit: 184, costPerServing: 3.1, lowStockThreshold: 15, currentStock: 59, supplier: '青沄', category: '醬料', notes: '調粉(一般+香蒜粉)' },
      { name: '醬油膏', unit: 'g', costPerUnit: 42, costPerServing: 0.024, lowStockThreshold: 500, currentStock: 1750, supplier: '青沄', category: '醬料', notes: '4.5罐塑膠瓶' },
      { name: '青醬包+調味品', unit: '份', costPerUnit: 141, costPerServing: 6.4, lowStockThreshold: 5, currentStock: 22, supplier: '青沄', category: '醬料', notes: '' },
      { name: '紅醬包+調味品', unit: '份', costPerUnit: 197, costPerServing: 8.9, lowStockThreshold: 5, currentStock: 22, supplier: '青沄', category: '醬料', notes: '' },
      { name: '白醬包+調味品', unit: '份', costPerUnit: 197, costPerServing: 6.6, lowStockThreshold: 8, currentStock: 30, supplier: '青沄', category: '醬料', notes: '' },
      { name: '義大利麵', unit: '份', costPerUnit: 164, costPerServing: 5.5, lowStockThreshold: 8, currentStock: 30, supplier: '', category: '主食', notes: '175g/份' },
      { name: '有機黎麥飯', unit: '份', costPerUnit: 74, costPerServing: 5.3, lowStockThreshold: 4, currentStock: 14, supplier: '青沄', category: '主食', notes: '175g/份' },
      { name: '花蛤調味品', unit: 'g', costPerUnit: 7, costPerServing: 0.1, lowStockThreshold: 30, currentStock: 120, supplier: '青沄', category: '醬料', notes: '1平匙=2g/碗(1/2平匙)' },
      { name: '鹽水', unit: 'g', costPerUnit: 1, costPerServing: 0, lowStockThreshold: 100, currentStock: 370, supplier: '', category: '配料', notes: '20g調味品+350g過濾水' },
      { name: '番茄沙拉醬', unit: '份', costPerUnit: 4, costPerServing: 0.4, lowStockThreshold: 3, currentStock: 10, supplier: '', category: '醬料', notes: '' },
      { name: '清檸合風醬', unit: '份', costPerUnit: 6, costPerServing: 0.6, lowStockThreshold: 3, currentStock: 10, supplier: '', category: '醬料', notes: '' },
      { name: '高麗菜罐', unit: '份', costPerUnit: 2, costPerServing: 2.2, lowStockThreshold: 1, currentStock: 1, supplier: '', category: '蔬菜', notes: '' },
      { name: '脆薯', unit: '份', costPerUnit: 202, costPerServing: 11.9, lowStockThreshold: 5, currentStock: 17, supplier: '', category: '配料', notes: '' },
      { name: '鮪魚玉米', unit: '份', costPerUnit: 139, costPerServing: 6.9, lowStockThreshold: 5, currentStock: 20, supplier: '', category: '配料', notes: '' },
      { name: '花生香油醬', unit: 'g', costPerUnit: 26.73, costPerServing: 0.24, lowStockThreshold: 30, currentStock: 110, supplier: '', category: '醬料', notes: '' },
      { name: '雞條', unit: '份', costPerUnit: 750, costPerServing: 9.9, lowStockThreshold: 20, currentStock: 76, supplier: '', category: '蛋白質', notes: '' },
      { name: '梅花豬片', unit: '份', costPerUnit: 223, costPerServing: 8.9, lowStockThreshold: 6, currentStock: 25, supplier: '', category: '蛋白質', notes: '' },
      { name: '草原牛', unit: '份', costPerUnit: 380, costPerServing: 12.7, lowStockThreshold: 8, currentStock: 30, supplier: '', category: '蛋白質', notes: '' },
      { name: '百香果汁', unit: '份', costPerUnit: 176, costPerServing: 11, lowStockThreshold: 4, currentStock: 16, supplier: '', category: '飲品', notes: '' },
      { name: '檸檬汁', unit: '份', costPerUnit: 156, costPerServing: 4.1, lowStockThreshold: 10, currentStock: 38, supplier: '', category: '飲品', notes: '' },
      { name: '牛肋條醬+調粉', unit: '份', costPerUnit: 414, costPerServing: 24.3, lowStockThreshold: 4, currentStock: 17, supplier: '', category: '醬料', notes: '' },
      { name: '梅花豬醬+調粉', unit: '份', costPerUnit: 275, costPerServing: 18.3, lowStockThreshold: 4, currentStock: 15, supplier: '', category: '醬料', notes: '' },
      { name: '冬瓜飲', unit: '份', costPerUnit: 64, costPerServing: 3.2, lowStockThreshold: 5, currentStock: 20, supplier: '', category: '飲品', notes: '' },
      { name: '洛神花乾', unit: '份', costPerUnit: 250, costPerServing: 2.1, lowStockThreshold: 30, currentStock: 120, supplier: '', category: '飲品', notes: '' },
      { name: '花蛤包', unit: '份', costPerUnit: 50, costPerServing: 8.3, lowStockThreshold: 2, currentStock: 6, supplier: '', category: '蛋白質', notes: '' },
      { name: '地瓜', unit: '份', costPerUnit: 110, costPerServing: 5.5, lowStockThreshold: 5, currentStock: 20, supplier: '', category: '蔬菜', notes: '' },
      { name: '醬燒雞腿', unit: '份', costPerUnit: 266, costPerServing: 13.3, lowStockThreshold: 5, currentStock: 20, supplier: '', category: '蛋白質', notes: '' },
      { name: '菇菇', unit: '份', costPerUnit: 150, costPerServing: 2.5, lowStockThreshold: 15, currentStock: 60, supplier: '', category: '蔬菜', notes: '' },
      { name: '雞條調味粉', unit: 'g', costPerUnit: 39, costPerServing: 0.2, lowStockThreshold: 50, currentStock: 180, supplier: '', category: '醬料', notes: '' },
      { name: '油炸物(吸+耗油)', unit: 'g', costPerUnit: 0.05, costPerServing: 4.1, lowStockThreshold: 20, currentStock: 80, supplier: '', category: '配料', notes: '' },
      { name: '肉醬包', unit: '包', costPerUnit: 289, costPerServing: 7.6, lowStockThreshold: 10, currentStock: 38, supplier: '', category: '醬料', notes: '' },
      { name: '松子粒', unit: '份', costPerUnit: 720, costPerServing: 7.2, lowStockThreshold: 25, currentStock: 100, supplier: '', category: '配料', notes: '' },
      { name: '起司片', unit: '片', costPerUnit: 310, costPerServing: 3.7, lowStockThreshold: 20, currentStock: 84, supplier: '', category: '配料', notes: '' },
      { name: '蛋餅皮', unit: '份', costPerUnit: 65, costPerServing: 4.3, lowStockThreshold: 4, currentStock: 15, supplier: '', category: '主食', notes: '1份=2片' },
      { name: '薯餅', unit: '片', costPerUnit: 125, costPerServing: 6.3, lowStockThreshold: 5, currentStock: 20, supplier: '', category: '配料', notes: '' },
      { name: '蘿蔔糕', unit: '份', costPerUnit: 60, costPerServing: 12, lowStockThreshold: 2, currentStock: 5, supplier: '', category: '主食', notes: '1份=2片' },
      { name: '吐司', unit: '份', costPerUnit: 38, costPerServing: 4.8, lowStockThreshold: 2, currentStock: 8, supplier: '', category: '主食', notes: '1份=3片' },
      { name: '雞胸', unit: '片', costPerUnit: 36, costPerServing: 36, lowStockThreshold: 1, currentStock: 1, supplier: '', category: '蛋白質', notes: '' },
      { name: '烏麵', unit: '包', costPerUnit: 1170, costPerServing: 11.7, lowStockThreshold: 25, currentStock: 100, supplier: '', category: '主食', notes: '' },
      { name: '豆漿', unit: '份', costPerUnit: 45, costPerServing: 5.6, lowStockThreshold: 2, currentStock: 8, supplier: '', category: '飲品', notes: '' },
      { name: '鳳梨汁', unit: '份', costPerUnit: 180, costPerServing: 7.4, lowStockThreshold: 6, currentStock: 24, supplier: '', category: '飲品', notes: '' },
      { name: '玉米筍', unit: '份', costPerUnit: 95, costPerServing: 0.7, lowStockThreshold: 35, currentStock: 143, supplier: '', category: '蔬菜', notes: '1包' },
      { name: '花椰', unit: '份', costPerUnit: 60, costPerServing: 0.5, lowStockThreshold: 28, currentStock: 111, supplier: '', category: '蔬菜', notes: '(意麵/燉飯4份)(飯3份)(小沙拉3份)(大沙拉套餐4份)' },
      { name: '沙拉', unit: '份', costPerUnit: 85, costPerServing: 1.7, lowStockThreshold: 12, currentStock: 50, supplier: '', category: '蔬菜', notes: '(吐司3份)(番茄沙醬3份)' },
    ];

    costItems.forEach((item, index) => {
      const result = insertIngredient.run(
        item.name, item.unit, item.costPerUnit, item.costPerServing,
        item.lowStockThreshold, index + 1,
        item.supplier, item.category, item.notes, now, now
      );
      const ingredientId = result.lastInsertRowid;
      insertInventory.run(
        ingredientId, item.name, item.currentStock,
        item.lowStockThreshold, item.unit, now
      );
    });

    const insertModRecipe = db.prepare(
      'INSERT INTO modifier_recipes (modifierId, ingredientId, ingredientName, quantity) VALUES (?, ?, ?, ?)'
    );
    const modRecipes: Array<[number, string, number]> = [
      [1, '青醬包+調味品', 1],
      [2, '黑胡椒醬+調粉', 1],
      [3, '紅醬包+調味品', 1],
      [4, '白醬包+調味品', 1],
      [5, '白醬包+調味品', 1],
      [6, '義大利麵', 1],
      [7, '有機黎麥飯', 1],
      [8, '番茄沙拉醬', 1],
      [9, '清檸合風醬', 1],
      [11, '起司片', 1],
      [12, '花生香油醬', 1],
    ];

    const ingByName = new Map<string, number>();
    const allIng = db.prepare('SELECT id, name FROM ingredients').all() as Array<{ id: number; name: string }>;
    for (const row of allIng) ingByName.set(row.name, row.id);

    for (const [modId, ingName, qty] of modRecipes) {
      const ingId = ingByName.get(ingName);
      if (ingId) insertModRecipe.run(modId, ingId, ingName, qty);
    }

    const insertRecipe = db.prepare(
      'INSERT INTO product_recipes (productId, ingredientId, ingredientName, quantity) VALUES (?, ?, ?, ?)'
    );
    const allProducts = db.prepare('SELECT id, name, categoryId FROM products').all() as Array<{ id: number; name: string; categoryId: number }>;

    const ri = (name: string, qty: number, productId: number) => {
      const id = ingByName.get(name);
      if (id) insertRecipe.run(productId, id, name, qty);
    };

    for (const p of allProducts) {
      if (p.categoryId === 1) {
        ri('花椰', 1, p.id);
        if (p.name.includes('松子')) ri('松子粒', 1, p.id);
        if (p.name.includes('菇菇')) ri('菇菇', 1, p.id);
        if (p.name.includes('黑豬') || p.name.includes('梅花豬')) ri('梅花豬片', 1, p.id);
        if (p.name.includes('菲瑞牛')) ri('草原牛', 1, p.id);
        if (p.name.includes('花蛤')) { ri('花蛤包', 1, p.id); ri('花蛤調味品', 2, p.id); }
        if (p.name.includes('炸雞條')) { ri('雞條', 1, p.id); ri('油炸物(吸+耗油)', 1, p.id); }
        if (p.name.includes('醬燒雞腿')) ri('醬燒雞腿', 1, p.id);
        if (p.name.includes('舒肥雞胸')) ri('雞胸', 1, p.id);
      }
      if (p.categoryId === 2) {
        ri('花椰', 1, p.id);
        if (p.name.includes('黑豬') || p.name.includes('燴飯 黑豬')) ri('梅花豬醬+調粉', 1, p.id);
        if (p.name.includes('菇菇')) ri('菇菇', 1, p.id);
        if (p.name.includes('梅花豬')) ri('梅花豬片', 1, p.id);
        if (p.name.includes('炸雞條')) { ri('雞條', 1, p.id); ri('油炸物(吸+耗油)', 1, p.id); }
        if (p.name.includes('菲瑞牛')) ri('草原牛', 1, p.id);
        if (p.name.includes('醬燒雞腿')) ri('醬燒雞腿', 1, p.id);
        if (p.name.includes('舒肥雞胸')) ri('雞胸', 1, p.id);
        if (p.name.includes('洋蔥醬燒豬')) ri('梅花豬醬+調粉', 1, p.id);
        if (p.name.includes('牛肋條')) ri('牛肋條醬+調粉', 1, p.id);
        if (p.name.includes('杏鮑菇')) ri('菇菇', 1, p.id);
      }
      if (p.categoryId === 3) {
        ri('沙拉', 1, p.id);
        ri('高麗菜罐', 1, p.id);
        ri('花椰', 1, p.id);
        if (p.name.includes('菲瑞牛')) ri('草原牛', 1, p.id);
        if (p.name.includes('醬燒雞腿')) ri('醬燒雞腿', 1, p.id);
        if (p.name.includes('舒肥雞胸')) ri('雞胸', 1, p.id);
      }
      if (p.categoryId === 4) {
        ri('吐司', 1, p.id);
        if (p.name.includes('鮪魚玉米')) ri('鮪魚玉米', 1, p.id);
        if (p.name.includes('薯餅')) ri('薯餅', 1, p.id);
        if (p.name.includes('梅花豬')) ri('梅花豬片', 1, p.id);
        if (p.name.includes('菲瑞牛')) ri('草原牛', 1, p.id);
        if (p.name.includes('炸雞條')) { ri('雞條', 1, p.id); ri('油炸物(吸+耗油)', 1, p.id); }
        if (p.name.includes('舒肥雞胸')) ri('雞胸', 1, p.id);
        if (p.name.includes('杏鮑菇')) ri('菇菇', 1, p.id);
      }
      if (p.categoryId === 5) {
        ri('蛋餅皮', 1, p.id);
        if (p.name.includes('鮪魚玉米')) ri('鮪魚玉米', 1, p.id);
        if (p.name.includes('薯餅')) ri('薯餅', 1, p.id);
        if (p.name.includes('梅花豬')) ri('梅花豬片', 1, p.id);
        if (p.name.includes('菲瑞牛')) ri('草原牛', 1, p.id);
        if (p.name.includes('杏鮑菇')) ri('菇菇', 1, p.id);
      }
      if (p.categoryId === 6) {
        ri('烏麵', 1, p.id);
        if (p.name.includes('黑胡椒')) ri('黑胡椒醬+調粉', 1, p.id);
        if (p.name.includes('杏鮑菇')) ri('菇菇', 1, p.id);
        if (p.name.includes('黑豬')) ri('梅花豬片', 1, p.id);
      }
      if (p.categoryId === 7) {
        ri('蘿蔔糕', 1, p.id);
        if (p.name.includes('梅花豬')) ri('梅花豬片', 1, p.id);
        if (p.name.includes('菲瑞牛')) ri('草原牛', 1, p.id);
        if (p.name.includes('醬燒雞腿')) ri('醬燒雞腿', 1, p.id);
        if (p.name.includes('舒肥雞胸')) ri('雞胸', 1, p.id);
      }
      if (p.categoryId === 8) {
        if (p.name.includes('薯餅')) ri('薯餅', 1, p.id);
        if (p.name.includes('地瓜')) ri('地瓜', 1, p.id);
        if (p.name.includes('蘿蔔糕')) ri('蘿蔔糕', 1, p.id);
        if (p.name.includes('花蛤')) { ri('花蛤包', 1, p.id); ri('花蛤調味品', 2, p.id); }
        if (p.name.includes('脆薯')) ri('脆薯', 1, p.id);
        if (p.name.includes('炸雞條')) { ri('雞條', 1, p.id); ri('油炸物(吸+耗油)', 1, p.id); }
        if (p.name.includes('沙拉')) ri('沙拉', 1, p.id);
      }
      if (p.categoryId === 9) {
        if (p.name.includes('豆漿')) ri('豆漿', 1, p.id);
      }
      if (p.categoryId === 10) {
        ri('冬瓜飲', 1, p.id);
        if (p.name.includes('鳳梨')) ri('鳳梨汁', 1, p.id);
        if (p.name.includes('百香果')) ri('百香果汁', 1, p.id);
        if (p.name.includes('檸檬')) ri('檸檬汁', 1, p.id);
      }
      if (p.categoryId === 12) {
        if (p.name.includes('洛神')) ri('洛神花乾', 1, p.id);
        if (p.name.includes('鳳梨')) ri('鳳梨汁', 1, p.id);
        if (p.name.includes('百香果')) ri('百香果汁', 1, p.id);
        if (p.name.includes('檸檬')) ri('檸檬汁', 1, p.id);
      }
    }
  });

  seedAll();
  console.log('Database seeded successfully');
}
