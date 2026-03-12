import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { db } from '../../db/database';
import type {
  Category,
  ComboItem,
  Ingredient,
  Product,
  ProductRecipeItem,
} from '../../db/types';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { CATEGORY_ICON_KEYS, getCategoryIcon, IconDownload, IconPencil, IconUpload } from '../../components/ui/Icons';
import Modal from '../../components/ui/Modal';
import { replaceProductRecipe } from '../../services/bomService';
import {
  archiveCategory,
  archiveProduct,
  saveCategory,
  saveProduct,
} from '../../services/menuService';
import { exportMenuData, importMenuData } from '../../services/syncService';
import { useAppSettingsStore } from '../../stores/useAppSettingsStore';
import { formatPrice } from '../../utils/currency';
import ModifierGroupsPanel from './ModifierGroupsPanel';

type DeleteTarget = { type: 'product' | 'category'; id: number; name: string } | null;

export default function MenuManagementPage() {
  useAppSettingsStore((state) => state.settings.currency);
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'modifierGroups'>('products');
  const [showProductForm, setShowProductForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const products = useLiveQuery(() => db.products.orderBy('sortOrder').toArray());
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray());
  const modifierGroups = useLiveQuery(() => db.modifierGroups.toArray());
  const ingredients = useLiveQuery(() => db.ingredients.filter((ingredient) => ingredient.isActive).sortBy('sortOrder'));
  const productRecipes = useLiveQuery(() => db.productRecipes.toArray());

  const recipeCountByProductId = useMemo(() => {
    const map = new Map<number, number>();
    productRecipes?.forEach((recipe) => {
      map.set(recipe.productId, (map.get(recipe.productId) ?? 0) + 1);
    });
    return map;
  }, [productRecipes]);

  const handleExport = async () => {
    const data = await exportMenuData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `menu-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('菜單已匯出');
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      await importMenuData(text);
      toast.success('菜單已匯入');
    } catch {
      toast.error('菜單匯入失敗');
    }

    if (importRef.current) {
      importRef.current.value = '';
    }
  };

  const handleSaveProduct = async (data: Partial<Product> & { recipeItems: Array<{ ingredientId: number; ingredientName: string; quantity: number }> }) => {
    const { recipeItems, ...productData } = data;
    const product = await saveProduct(editProduct?.id, productData);
    await replaceProductRecipe(
      product.id!,
      productData.trackInventory && !productData.isCombo ? recipeItems : []
    );
    toast.success(editProduct ? '商品已更新' : '商品已新增');
    setShowProductForm(false);
    setEditProduct(null);
  };

  const handleSaveCategory = async (data: Partial<Category>) => {
    await saveCategory(editCategory?.id, data);
    toast.success(editCategory ? '分類已更新' : '分類已新增');
    setShowCategoryForm(false);
    setEditCategory(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    if (deleteTarget.type === 'product') {
      await archiveProduct(deleteTarget.id);
    } else {
      await archiveCategory(deleteTarget.id);
    }

    setDeleteTarget(null);
    toast.success('已停用');
  };

  const initialRecipe = editProduct?.id
    ? (productRecipes?.filter((recipe) => recipe.productId === editProduct.id) ?? [])
    : [];

  return (
    <div className="h-full flex flex-col">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-50 flex items-center gap-2">
            <IconPencil className="w-6 h-6 text-indigo-500" /> 菜單管理
          </h1>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeTab === 'products' ? 'bg-indigo-600 text-white shadow-md dark:bg-indigo-500' : 'bg-gray-100 text-gray-500 dark:bg-[#131c2e] dark:text-slate-400'}`}
            >
              商品 ({products?.filter((product) => product.isActive).length || 0})
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeTab === 'categories' ? 'bg-indigo-600 text-white shadow-md dark:bg-indigo-500' : 'bg-gray-100 text-gray-500 dark:bg-[#131c2e] dark:text-slate-400'}`}
            >
              分類 ({categories?.filter((category) => category.isActive).length || 0})
            </button>
            <button
              onClick={() => setActiveTab('modifierGroups')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeTab === 'modifierGroups' ? 'bg-indigo-600 text-white shadow-md dark:bg-indigo-500' : 'bg-gray-100 text-gray-500 dark:bg-[#131c2e] dark:text-slate-400'}`}
            >
              加料群組 ({modifierGroups?.length || 0})
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5 text-sm">
            <IconUpload className="w-4 h-4" /> 匯出
          </button>
          <button onClick={() => importRef.current?.click()} className="btn-secondary flex items-center gap-1.5 text-sm">
            <IconDownload className="w-4 h-4" /> 匯入
          </button>
          <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          {activeTab === 'products' ? (
            <button onClick={() => { setEditProduct(null); setShowProductForm(true); }} className="btn-primary text-sm">
              + 新增商品
            </button>
          ) : activeTab === 'categories' ? (
            <button onClick={() => { setEditCategory(null); setShowCategoryForm(true); }} className="btn-primary text-sm">
              + 新增分類
            </button>
          ) : null}
          {activeTab === 'modifierGroups' && (
            <span className="text-xs text-gray-500 dark:text-slate-400 self-center">
              可在列表內直接新增與編輯群組
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'products' ? (
          <div className="space-y-2">
            {products?.filter((product) => product.isActive).map((product, index) => {
              const categoryIcon = categories?.find((category) => category.id === product.categoryId)?.icon || 'restaurant';
              const recipeCount = recipeCountByProductId.get(product.id!) ?? 0;
              return (
                <div key={product.id} className={`card px-4 py-3 flex items-center justify-between animate-slide-up stagger-${Math.min(index + 1, 6)}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-[#131c2e] rounded-lg flex items-center justify-center text-gray-500 dark:text-slate-400">
                      {getCategoryIcon(categoryIcon, { className: 'w-6 h-6' })}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-800 dark:text-slate-50">{product.name}</h3>
                        {product.isCombo && (
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400 px-1.5 py-0.5 rounded-full">
                            套餐
                          </span>
                        )}
                        {!product.isCombo && product.trackInventory && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                            配方 {recipeCount} 項
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        {categories?.find((category) => category.id === product.categoryId)?.name || '-'}
                        {product.description && ` · ${product.description}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">{formatPrice(product.price)}</span>
                    <button onClick={() => { setEditProduct(product); setShowProductForm(true); }} className="btn-secondary text-sm px-3 py-1.5">編輯</button>
                    <button onClick={() => setDeleteTarget({ type: 'product', id: product.id!, name: product.name })} className="text-red-400 hover:text-red-600 dark:hover:text-red-400 text-sm transition-colors">停用</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : activeTab === 'categories' ? (
          <div className="space-y-2">
            {categories?.filter((category) => category.isActive).map((category, index) => (
              <div key={category.id} className={`card px-4 py-3 flex items-center justify-between animate-slide-up stagger-${Math.min(index + 1, 6)}`}>
                <div className="flex items-center gap-4">
                  <div className="text-gray-500 dark:text-slate-400">
                    {getCategoryIcon(category.icon, { className: 'w-8 h-8' })}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-slate-50">{category.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">{category.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 dark:text-slate-500">排序 {category.sortOrder}</span>
                  <button onClick={() => { setEditCategory(category); setShowCategoryForm(true); }} className="btn-secondary text-sm px-3 py-1.5">編輯</button>
                  <button onClick={() => setDeleteTarget({ type: 'category', id: category.id!, name: category.name })} className="text-red-400 hover:text-red-600 dark:hover:text-red-400 text-sm transition-colors">停用</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ModifierGroupsPanel />
        )}
      </div>

      {showProductForm && (
        <ProductFormModal
          product={editProduct}
          categories={categories || []}
          ingredients={ingredients || []}
          modifierGroups={modifierGroups || []}
          initialRecipe={initialRecipe}
          onSave={handleSaveProduct}
          onClose={() => {
            setShowProductForm(false);
            setEditProduct(null);
          }}
        />
      )}

      {showCategoryForm && (
        <CategoryFormModal
          category={editCategory}
          onSave={handleSaveCategory}
          onClose={() => {
            setShowCategoryForm(false);
            setEditCategory(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="停用確認"
        message={`確定要停用「${deleteTarget?.name}」？`}
        confirmText="確認停用"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function ProductFormModal({
  product,
  categories,
  ingredients,
  modifierGroups,
  initialRecipe,
  onSave,
  onClose,
}: {
  product: Product | null;
  categories: Category[];
  ingredients: Ingredient[];
  modifierGroups: { id?: number; name: string }[];
  initialRecipe: ProductRecipeItem[];
  onSave: (data: Partial<Product> & { recipeItems: Array<{ ingredientId: number; ingredientName: string; quantity: number }> }) => void;
  onClose: () => void;
}) {
  const currency = useAppSettingsStore((state) => state.settings.currency);
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product?.price?.toString() || '');
  const [categoryId, setCategoryId] = useState(product?.categoryId || categories[0]?.id || 0);
  const [trackInventory, setTrackInventory] = useState(product?.trackInventory ?? true);
  const [selectedModGroups, setSelectedModGroups] = useState<number[]>(product?.modifierGroupIds || []);
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || '');
  const [isCombo, setIsCombo] = useState(product?.isCombo ?? false);
  const [comboItems, setComboItems] = useState<ComboItem[]>(product?.comboItems || []);
  const [recipeItems, setRecipeItems] = useState<Array<{ ingredientId: number; ingredientName: string; quantity: number }>>(
    initialRecipe.map((recipe) => ({
      ingredientId: recipe.ingredientId,
      ingredientName: recipe.ingredientName,
      quantity: recipe.quantity,
    }))
  );
  const [selectedIngredientId, setSelectedIngredientId] = useState<number>(ingredients[0]?.id || 0);
  const [recipeQuantity, setRecipeQuantity] = useState('1');

  const allProducts = useLiveQuery(
    () => db.products.filter((candidate) => candidate.isActive && candidate.id !== product?.id).sortBy('name')
  );

  const handleAddComboItem = (selectedProduct: Product) => {
    const existing = comboItems.find((comboItem) => comboItem.productId === selectedProduct.id!);
    if (existing) {
      setComboItems((current) =>
        current.map((comboItem) =>
          comboItem.productId === selectedProduct.id!
            ? { ...comboItem, quantity: comboItem.quantity + 1 }
            : comboItem
        )
      );
      return;
    }

    setComboItems((current) => [
      ...current,
      { productId: selectedProduct.id!, productName: selectedProduct.name, quantity: 1 },
    ]);
  };

  const handleComboItemQty = (productId: number, delta: number) => {
    setComboItems((current) =>
      current
        .map((comboItem) =>
          comboItem.productId === productId
            ? { ...comboItem, quantity: Math.max(0, comboItem.quantity + delta) }
            : comboItem
        )
        .filter((comboItem) => comboItem.quantity > 0)
    );
  };

  const handleAddRecipeItem = () => {
    const quantity = Number(recipeQuantity);
    const ingredient = ingredients.find((item) => item.id === selectedIngredientId);
    if (!ingredient || !Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    setRecipeItems((current) => {
      const existing = current.find((item) => item.ingredientId === ingredient.id);
      if (existing) {
        return current.map((item) =>
          item.ingredientId === ingredient.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [
        ...current,
        {
          ingredientId: ingredient.id!,
          ingredientName: ingredient.name,
          quantity,
        },
      ];
    });

    setRecipeQuantity('1');
  };

  const handleRecipeQuantityChange = (ingredientId: number, quantity: number) => {
    setRecipeItems((current) =>
      current
        .map((item) =>
          item.ingredientId === ingredientId
            ? { ...item, quantity: Math.max(0, quantity) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleSubmit = () => {
    if (!name.trim() || !price) {
      return;
    }

    onSave({
      name: name.trim(),
      description,
      price: Number.parseInt(price, 10),
      categoryId,
      trackInventory: isCombo ? false : trackInventory,
      modifierGroupIds: isCombo ? [] : selectedModGroups,
      imageUrl,
      isCombo,
      comboItems: isCombo ? comboItems : undefined,
      recipeItems: isCombo || !trackInventory ? [] : recipeItems,
    });
  };

  return (
    <Modal open={true} onClose={onClose} title={product ? '編輯商品' : '新增商品'} size="lg">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">商品名稱 *</label>
            <input value={name} onChange={(event) => setName(event.target.value)} className="input-field" placeholder="例如：滷肉飯" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">{`價格 (${currency}) *`}</label>
            <input type="number" value={price} onChange={(event) => setPrice(event.target.value)} className="input-field" min={0} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">描述</label>
          <input value={description} onChange={(event) => setDescription(event.target.value)} className="input-field" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">分類</label>
          <select value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))} className="input-field">
            {categories.filter((category) => category.isActive).map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">圖片網址</label>
          <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} className="input-field" placeholder="https://..." />
        </div>

        <label className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
          <input type="checkbox" checked={isCombo} onChange={(event) => setIsCombo(event.target.checked)} className="w-5 h-5 rounded accent-purple-600" />
          <span className="text-sm font-medium text-purple-700 dark:text-purple-400">這是套餐商品</span>
        </label>

        {isCombo ? (
          <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-3 space-y-3">
            <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block">套餐內容</label>

            {comboItems.length > 0 && (
              <div className="space-y-2">
                {comboItems.map((comboItem) => (
                  <div key={comboItem.productId} className="flex items-center justify-between bg-purple-50 dark:bg-purple-950/30 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-slate-50">{comboItem.productName}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleComboItemQty(comboItem.productId, -1)} className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 dark:bg-[#1a2540] dark:hover:bg-gray-600 flex items-center justify-center text-sm font-bold">-</button>
                      <span className="w-8 text-center font-semibold text-sm">{comboItem.quantity}</span>
                      <button onClick={() => handleComboItemQty(comboItem.productId, 1)} className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 dark:bg-[#1a2540] dark:hover:bg-gray-600 flex items-center justify-center text-sm font-bold">+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">加入商品到套餐</label>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {allProducts?.filter((candidate) => !candidate.isCombo).map((candidate) => (
                  <button
                    key={candidate.id}
                    onClick={() => handleAddComboItem(candidate)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      comboItems.some((comboItem) => comboItem.productId === candidate.id!)
                        ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400'
                        : 'border-gray-200 text-gray-500 hover:border-purple-300 dark:border-[#2a3a54] dark:text-slate-400 dark:hover:border-purple-600'
                    }`}
                  >
                    {candidate.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={trackInventory} onChange={(event) => setTrackInventory(event.target.checked)} className="w-5 h-5 rounded" />
              <span className="text-sm font-medium text-gray-600 dark:text-slate-300">依食材配方追蹤庫存</span>
            </label>

            {trackInventory && (
              <div className="border border-amber-200 dark:border-amber-900 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-slate-50">商品配方</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">每賣出 1 份商品會扣除以下食材。</p>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_120px_auto] gap-2">
                  <select value={selectedIngredientId} onChange={(event) => setSelectedIngredientId(Number(event.target.value))} className="input-field">
                    {ingredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {ingredient.name} ({ingredient.unit})
                      </option>
                    ))}
                  </select>
                  <input type="number" min={0} step="0.1" value={recipeQuantity} onChange={(event) => setRecipeQuantity(event.target.value)} className="input-field" />
                  <button onClick={handleAddRecipeItem} className="btn-secondary px-4">加入</button>
                </div>

                {ingredients.length === 0 && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">目前沒有食材，請先到庫存頁新增食材。</p>
                )}

                {recipeItems.length > 0 ? (
                  <div className="space-y-2">
                    {recipeItems.map((item) => {
                      const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId);
                      return (
                        <div key={item.ingredientId} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-[#1e2d4a] px-3 py-2">
                          <div>
                            <p className="font-medium text-gray-800 dark:text-slate-50">{item.ingredientName}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">{ingredient?.unit || '份'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              step="0.1"
                              value={item.quantity}
                              onChange={(event) => handleRecipeQuantityChange(item.ingredientId, Number(event.target.value))}
                              className="input-field w-28"
                            />
                            <button onClick={() => handleRecipeQuantityChange(item.ingredientId, 0)} className="text-red-500 text-sm">移除</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-slate-400">尚未設定配方，商品將無法計算實際耗料。</p>
                )}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-2">可用加料群組</label>
              <div className="flex flex-wrap gap-2">
                {modifierGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedModGroups((current) =>
                      current.includes(group.id!)
                        ? current.filter((id) => id !== group.id!)
                        : [...current, group.id!]
                    )}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                      selectedModGroups.includes(group.id!)
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                        : 'border-gray-200 dark:border-[#2a3a54] dark:text-slate-400'
                    }`}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2 pt-4">
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !price || (isCombo && comboItems.length === 0)}
            className="btn-primary flex-1"
          >
            {product ? '儲存商品' : '新增商品'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CategoryFormModal({
  category,
  onSave,
  onClose,
}: {
  category: Category | null;
  onSave: (data: Partial<Category>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [icon, setIcon] = useState(category?.icon || 'rice');
  const [color, setColor] = useState(category?.color || '#3b82f6');

  return (
    <Modal open={true} onClose={onClose} title={category ? '編輯分類' : '新增分類'} size="sm">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">分類名稱 *</label>
          <input value={name} onChange={(event) => setName(event.target.value)} className="input-field" placeholder="例如：主餐" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">描述</label>
          <input value={description} onChange={(event) => setDescription(event.target.value)} className="input-field" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-2">圖示</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_ICON_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => setIcon(key)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 text-gray-500 dark:text-slate-400 transition-all ${icon === key ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'border-gray-200 dark:border-[#2a3a54]'}`}
              >
                {getCategoryIcon(key, { className: 'w-5 h-5' })}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-slate-300 block mb-1">顏色</label>
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="w-full h-10 rounded-lg cursor-pointer" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button onClick={() => name && onSave({ name, description, icon, color })} disabled={!name} className="btn-primary flex-1">
            {category ? '儲存分類' : '新增分類'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
