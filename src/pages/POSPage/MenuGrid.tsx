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
      {/* Search */}
      <div className="px-4 pt-4 pb-3">
        <div className="relative">
          <IconSearch className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋商品..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="px-4 pb-3 flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
        <button
          onClick={() => setActiveCategoryId(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activeCategoryId === null
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700'
          }`}
        >
          全部
        </button>

        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategoryId(category.id!)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeCategoryId === category.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700'
            }`}
          >
            {getCategoryIcon(category.icon, { className: 'w-4 h-4' })}
            <span>{category.name}</span>
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredProducts?.map((product) => {
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
                className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-left transition-all ${
                  isSoldOut
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-600 cursor-pointer active:scale-[0.98]'
                }`}
              >
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-24 object-cover rounded-lg mb-2"
                  />
                ) : (
                  <div className="w-full h-24 bg-gray-50 dark:bg-gray-700 rounded-lg mb-2 flex items-center justify-center text-gray-300 dark:text-gray-500">
                    {getCategoryIcon(categoryIcon, { className: 'w-8 h-8' })}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">
                    {product.name}
                  </h3>
                  {product.isCombo && (
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      套餐
                    </span>
                  )}
                </div>

                {product.description && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {product.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-2 gap-2">
                  <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                    {formatPrice(product.price)}
                  </span>

                  {isSoldOut && (
                    <span className="text-xs font-medium bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 px-2 py-0.5 rounded-full">
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
          <div className="text-center py-16 text-gray-400">
            <IconSearch className="w-12 h-12 mx-auto mb-3" />
            <p className="text-lg font-medium">找不到符合條件的商品</p>
            <p className="text-sm mt-1">請調整搜尋字詞或切換分類</p>
          </div>
        )}
      </div>
    </div>
  );
}
