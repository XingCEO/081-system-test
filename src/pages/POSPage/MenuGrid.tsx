import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { formatPrice } from '../../utils/currency';
import { IconSearch, getCategoryIcon } from '../../components/ui/Icons';
import type { Category, Product } from '../../db/types';

interface MenuGridProps {
  categories: Category[];
  onProductClick: (product: Product) => void;
}

export default function MenuGrid({ categories, onProductClick }: MenuGridProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const products = useLiveQuery(
    () => {
      if (activeCategoryId) {
        return db.products
          .where('categoryId').equals(activeCategoryId)
          .filter(p => p.isActive)
          .sortBy('sortOrder');
      }
      return db.products.filter(p => p.isActive).sortBy('sortOrder');
    },
    [activeCategoryId]
  );

  const inventoryMap = useLiveQuery(async () => {
    const records = await db.inventory.toArray();
    const map = new Map<number, number>();
    for (const r of records) map.set(r.productId, r.currentStock);
    return map;
  });

  const filtered = products?.filter((p) =>
    searchTerm ? p.name.toLowerCase().includes(searchTerm.toLowerCase()) : true
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜尋商品..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
        <button
          onClick={() => setActiveCategoryId(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activeCategoryId === null
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          全部
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategoryId(cat.id!)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeCategoryId === cat.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {getCategoryIcon(cat.icon, { className: 'w-4 h-4' })}
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered?.map((product) => {
            const stock = inventoryMap?.get(product.id!) ?? null;
            const isSoldOut = product.trackInventory && stock !== null && stock <= 0;
            const catIcon = categories.find((c) => c.id === product.categoryId)?.icon || 'restaurant';

            return (
              <button
                key={product.id}
                onClick={() => !isSoldOut && onProductClick(product)}
                disabled={isSoldOut}
                className={`card p-4 text-left transition-all active:scale-95 ${
                  isSoldOut
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:shadow-md hover:border-blue-300 cursor-pointer'
                }`}
              >
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-24 object-cover rounded-lg mb-2"
                  />
                ) : (
                  <div className="w-full h-24 bg-slate-100 rounded-lg mb-2 flex items-center justify-center text-slate-400">
                    {getCategoryIcon(catIcon, { className: 'w-8 h-8' })}
                  </div>
                )}

                <h3 className="font-semibold text-slate-900 text-base truncate">
                  {product.name}
                </h3>
                {product.description && (
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {product.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-2">
                  <span className="text-lg font-bold text-blue-600">
                    {formatPrice(product.price)}
                  </span>
                  {isSoldOut && (
                    <span className="text-xs font-medium bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                      售完
                    </span>
                  )}
                  {product.trackInventory && stock !== null && !isSoldOut && stock <= 10 && (
                    <span className="text-xs text-amber-600 font-medium">
                      剩{stock}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {filtered?.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <IconSearch className="w-10 h-10 mx-auto mb-2" />
            <p>找不到符合的商品</p>
          </div>
        )}
      </div>
    </div>
  );
}
