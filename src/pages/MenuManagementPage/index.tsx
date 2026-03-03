import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { formatPrice } from '../../utils/currency';
import { exportMenuData, importMenuData } from '../../services/syncService';
import { addInventoryForProduct } from '../../services/inventoryService';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { IconPencil, IconUpload, IconDownload, getCategoryIcon, CATEGORY_ICON_KEYS } from '../../components/ui/Icons';
import toast from 'react-hot-toast';
import type { Product, Category } from '../../db/types';

export default function MenuManagementPage() {
  const [showProductForm, setShowProductForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'product' | 'category'; id: number; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
  const importRef = useRef<HTMLInputElement>(null);

  const products = useLiveQuery(() => db.products.orderBy('sortOrder').toArray());
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray());
  const modifierGroups = useLiveQuery(() => db.modifierGroups.toArray());

  const handleExport = async () => {
    const data = await exportMenuData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `menu-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('菜單已匯出');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importMenuData(text);
      toast.success('菜單匯入成功！');
    } catch {
      toast.error('匯入失敗，請檢查檔案格式');
    }
    if (importRef.current) importRef.current.value = '';
  };

  const handleSaveProduct = async (data: Partial<Product>) => {
    const now = new Date().toISOString();
    if (editProduct?.id) {
      await db.products.update(editProduct.id, { ...data, updatedAt: now });
      toast.success('商品已更新');
    } else {
      const id = await db.products.add({
        ...data,
        createdAt: now,
        updatedAt: now,
        isActive: true,
        sortOrder: (products?.length || 0) + 1,
      } as Product);
      if (data.trackInventory) {
        await addInventoryForProduct(id as number, data.name || '');
      }
      toast.success('商品已新增');
    }
    setShowProductForm(false);
    setEditProduct(null);
  };

  const handleSaveCategory = async (data: Partial<Category>) => {
    const now = new Date().toISOString();
    if (editCategory?.id) {
      await db.categories.update(editCategory.id, { ...data, updatedAt: now });
      toast.success('分類已更新');
    } else {
      await db.categories.add({
        ...data,
        createdAt: now,
        updatedAt: now,
        isActive: true,
        sortOrder: (categories?.length || 0) + 1,
      } as Category);
      toast.success('分類已新增');
    }
    setShowCategoryForm(false);
    setEditCategory(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'product') {
      await db.products.update(deleteTarget.id, { isActive: false });
    } else {
      await db.categories.update(deleteTarget.id, { isActive: false });
    }
    setDeleteTarget(null);
    toast.success('已刪除');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <IconPencil className="w-6 h-6 text-blue-500" /> 菜單管理
          </h1>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeTab === 'products' ? 'bg-blue-600 text-white shadow-md dark:bg-blue-500' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}
            >
              商品 ({products?.filter(p => p.isActive).length || 0})
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeTab === 'categories' ? 'bg-blue-600 text-white shadow-md dark:bg-blue-500' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}
            >
              分類 ({categories?.filter(c => c.isActive).length || 0})
            </button>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5 text-sm"><IconUpload className="w-4 h-4" /> 匯出</button>
          <button onClick={() => importRef.current?.click()} className="btn-secondary flex items-center gap-1.5 text-sm"><IconDownload className="w-4 h-4" /> 匯入</button>
          <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          {activeTab === 'products' ? (
            <button onClick={() => { setEditProduct(null); setShowProductForm(true); }} className="btn-primary text-sm">+ 新增商品</button>
          ) : (
            <button onClick={() => { setEditCategory(null); setShowCategoryForm(true); }} className="btn-primary text-sm">+ 新增分類</button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'products' ? (
          <div className="space-y-2">
            {products?.filter(p => p.isActive).map((product, i) => {
              const catIcon = categories?.find(c => c.id === product.categoryId)?.icon || 'restaurant';
              return (
                <div key={product.id} className={`card px-4 py-3 flex items-center justify-between animate-slide-up stagger-${Math.min(i + 1, 6)}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400">
                      {getCategoryIcon(catIcon, { className: 'w-6 h-6' })}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{product.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {categories?.find(c => c.id === product.categoryId)?.name || '未分類'}
                        {product.description && ` · ${product.description}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">{formatPrice(product.price)}</span>
                    <button onClick={() => { setEditProduct(product); setShowProductForm(true); }} className="btn-secondary text-sm px-3 py-1.5">
                      編輯
                    </button>
                    <button onClick={() => setDeleteTarget({ type: 'product', id: product.id!, name: product.name })} className="text-red-400 hover:text-red-600 dark:hover:text-red-400 text-sm transition-colors">
                      刪除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {categories?.filter(c => c.isActive).map((cat, i) => (
              <div key={cat.id} className={`card px-4 py-3 flex items-center justify-between animate-slide-up stagger-${Math.min(i + 1, 6)}`}>
                <div className="flex items-center gap-4">
                  <div className="text-slate-600 dark:text-slate-400">
                    {getCategoryIcon(cat.icon, { className: 'w-8 h-8' })}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{cat.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{cat.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400 dark:text-slate-500">排序：{cat.sortOrder}</span>
                  <button onClick={() => { setEditCategory(cat); setShowCategoryForm(true); }} className="btn-secondary text-sm px-3 py-1.5">
                    編輯
                  </button>
                  <button onClick={() => setDeleteTarget({ type: 'category', id: cat.id!, name: cat.name })} className="text-red-400 hover:text-red-600 dark:hover:text-red-400 text-sm transition-colors">
                    刪除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      {showProductForm && (
        <ProductFormModal
          product={editProduct}
          categories={categories || []}
          modifierGroups={modifierGroups || []}
          onSave={handleSaveProduct}
          onClose={() => { setShowProductForm(false); setEditProduct(null); }}
        />
      )}

      {/* Category Form Modal */}
      {showCategoryForm && (
        <CategoryFormModal
          category={editCategory}
          onSave={handleSaveCategory}
          onClose={() => { setShowCategoryForm(false); setEditCategory(null); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="刪除確認"
        message={`確定要刪除「${deleteTarget?.name}」？`}
        confirmText="刪除"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function ProductFormModal({ product, categories, modifierGroups, onSave, onClose }: {
  product: Product | null;
  categories: Category[];
  modifierGroups: { id?: number; name: string }[];
  onSave: (data: Partial<Product>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product?.price?.toString() || '');
  const [categoryId, setCategoryId] = useState(product?.categoryId || categories[0]?.id || 0);
  const [trackInventory, setTrackInventory] = useState(product?.trackInventory ?? true);
  const [selectedModGroups, setSelectedModGroups] = useState<number[]>(product?.modifierGroupIds || []);
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || '');

  const handleSubmit = () => {
    if (!name || !price) return;
    onSave({
      name,
      description,
      price: parseInt(price),
      categoryId,
      trackInventory,
      modifierGroupIds: selectedModGroups,
      imageUrl,
    });
  };

  return (
    <Modal open={true} onClose={onClose} title={product ? '編輯商品' : '新增商品'} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">商品名稱 *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="例：滷肉飯" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">價格 (NT$) *</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="input-field" placeholder="85" min={0} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">描述</label>
          <input value={description} onChange={e => setDescription(e.target.value)} className="input-field" placeholder="商品描述" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">分類</label>
          <select value={categoryId} onChange={e => setCategoryId(+e.target.value)} className="input-field">
            {categories.filter(c => c.isActive).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">圖片URL</label>
          <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="input-field" placeholder="https://..." />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">修改群組</label>
          <div className="flex flex-wrap gap-2">
            {modifierGroups.map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedModGroups(prev =>
                  prev.includes(g.id!) ? prev.filter(id => id !== g.id!) : [...prev, g.id!]
                )}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  selectedModGroups.includes(g.id!) ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 dark:text-slate-400'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="trackInv" checked={trackInventory} onChange={e => setTrackInventory(e.target.checked)} className="w-5 h-5 rounded" />
          <label htmlFor="trackInv" className="text-sm font-medium text-slate-700 dark:text-slate-300">追蹤庫存</label>
        </div>
        <div className="flex gap-2 pt-4">
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button onClick={handleSubmit} disabled={!name || !price} className="btn-primary flex-1">
            {product ? '更新商品' : '新增商品'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CategoryFormModal({ category, onSave, onClose }: {
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
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">分類名稱 *</label>
          <input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="例：主餐" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">描述</label>
          <input value={description} onChange={e => setDescription(e.target.value)} className="input-field" placeholder="分類描述" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">圖示</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_ICON_KEYS.map(key => (
              <button
                key={key}
                onClick={() => setIcon(key)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 text-slate-600 dark:text-slate-400 transition-all ${icon === key ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-slate-200 dark:border-slate-700'}`}
              >
                {getCategoryIcon(key, { className: 'w-5 h-5' })}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">顏色</label>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-10 rounded-lg cursor-pointer" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button onClick={() => name && onSave({ name, description, icon, color })} disabled={!name} className="btn-primary flex-1">
            {category ? '更新' : '新增'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
