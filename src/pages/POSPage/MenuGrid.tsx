import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import type { Category, Product } from '../../db/types';
import { getProductAvailabilityMap } from '../../services/bomService';
import { useAppSettingsStore } from '../../stores/useAppSettingsStore';
import { formatPrice } from '../../utils/currency';
import { IconSearch, getCategoryIcon } from '../../components/ui/Icons';

interface MenuGridProps {
  categories: Category[];
  onProductClick: (product: Product) => void;
}

export default function MenuGrid({ categories, onProductClick }: MenuGridProps) {
  useAppSettingsStore((state) => state.settings.currency);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const products = useLiveQuery(
    () => {
      if (activeCategoryId) {
        return db.products
          .where('categoryId')
          .equals(activeCategoryId)
          .filter((product) => product.isActive)
          .sortBy('sortOrder');
      }

      return db.products.filter((product) => product.isActive).sortBy('sortOrder');
    },
    [activeCategoryId]
  );

  const availabilityMap = useLiveQuery(() => getProductAvailabilityMap());

  const filteredProducts = products?.filter((product) =>
    searchTerm ? product.name.toLowerCase().includes(searchTerm.toLowerCase()) : true
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="搜尋商品..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="input-field pl-9"
          />
        </div>
      </div>

      <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
        <button
          onClick={() => setActiveCategoryId(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            activeCategoryId === null
              ? 'bg-blue-600 text-white shadow-md dark:bg-blue-500'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700'
          }`}
        >
          全部
        </button>

        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategoryId(category.id!)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeCategoryId === category.id
                ? 'bg-blue-600 text-white shadow-md dark:bg-blue-500'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700'
            }`}
          >
            {getCategoryIcon(category.icon, { className: 'w-4 h-4' })}
            <span>{category.name}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredProducts?.map((product, index) => {
            const availability = availabilityMap?.get(product.id!);
            const isSoldOut = product.trackInventory && (availability?.isSoldOut ?? false);
            const availableQuantity = availability?.availableQuantity ?? null;
            const categoryIcon = categories.find((category) => category.id === product.categoryId)?.icon || 'restaurant';

            return (
              <button
                key={product.id}
                onClick={() => {
                  if (!isSoldOut) {
                    onProductClick(product);
                  }
                }}
                disabled={isSoldOut}
                className={`card p-3 text-left transition-all active:scale-[0.97] animate-fade-in ${
                  isSoldOut
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer'
                } stagger-${Math.min((index % 8) + 1, 6)}`}
              >
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-24 object-cover rounded-lg mb-2"
                  />
                ) : (
                  <div className="w-full h-24 bg-slate-100 dark:bg-slate-800 rounded-lg mb-2 flex items-center justify-center text-slate-400 dark:text-slate-600">
                    {getCategoryIcon(categoryIcon, { className: 'w-8 h-8' })}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                    {product.name}
                  </h3>
                  {product.isCombo && (
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      套餐
                    </span>
                  )}
                </div>

                {product.description && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {product.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-2 gap-2">
                  <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                    {formatPrice(product.price)}
                  </span>

                  {isSoldOut && (
                    <span className="text-xs font-medium bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 px-2 py-0.5 rounded-full">
                      售完
                    </span>
                  )}

                  {product.trackInventory && availableQuantity !== null && !isSoldOut && (availability?.isLowStock ?? false) && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      剩 {availableQuantity} 份
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {filteredProducts?.length === 0 && (
          <div className="text-center py-16 text-slate-400 dark:text-slate-600">
            <IconSearch className="w-12 h-12 mx-auto mb-3" />
            <p className="text-lg font-medium">找不到符合條件的商品</p>
            <p className="text-sm mt-1">請調整搜尋字詞或切換分類</p>
          </div>
        )}
      </div>
    </div>
  );
}
