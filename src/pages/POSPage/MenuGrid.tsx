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

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  noodles: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  rice: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  soup: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  drink: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  dessert: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
  vegetable: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  meat: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  fish: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  default: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
};

function getCategoryColor(icon: string): string {
  return CATEGORY_COLORS[icon] || CATEGORY_COLORS.default;
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

  const availabilityMap = useLiveQuery(async () => {
    await db.inventory.count(); // 建立 Dexie 訂閱，確保庫存變動時觸發更新
    return getProductAvailabilityMap();
  });

  const filteredProducts = products?.filter((product) =>
    searchTerm ? product.name.toLowerCase().includes(searchTerm.toLowerCase()) : true
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search */}
      <div className="px-5 pt-4 pb-3">
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
      <div className="px-5 pb-3 flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
        <button
          onClick={() => setActiveCategoryId(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activeCategoryId === null
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-gray-200 dark:bg-[#131c2e] dark:text-slate-400 dark:border-[#1e2d4a] dark:hover:bg-[#243552]'
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
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-gray-200 dark:bg-[#131c2e] dark:text-slate-400 dark:border-[#1e2d4a] dark:hover:bg-[#243552]'
            }`}
          >
            {getCategoryIcon(category.icon, { className: 'w-4 h-4' })}
            <span>{category.name}</span>
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          {filteredProducts?.map((product) => {
            const availability = availabilityMap?.get(product.id!);
            const isSoldOut = product.trackInventory && (availability?.isSoldOut ?? false);
            const availableQuantity = availability?.availableQuantity ?? null;
            const categoryIcon = categories.find((category) => category.id === product.categoryId)?.icon || 'restaurant';
            const colorClass = getCategoryColor(categoryIcon);

            return (
              <button
                key={product.id}
                onClick={() => {
                  if (!isSoldOut) {
                    onProductClick(product);
                  }
                }}
                disabled={isSoldOut}
                className={`bg-white dark:bg-[#131c2e] rounded-xl border border-gray-200 dark:border-[#1e2d4a] text-left transition-all group ${
                  isSoldOut
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer active:scale-[0.97]'
                }`}
              >
                {/* Image or compact icon header */}
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-28 object-cover rounded-t-xl"
                  />
                ) : (
                  <div className={`mx-3 mt-3 w-9 h-9 rounded-lg flex items-center justify-center ${colorClass}`}>
                    {getCategoryIcon(categoryIcon, { className: 'w-4.5 h-4.5' })}
                  </div>
                )}

                {/* Content */}
                <div className="px-3 pb-3 pt-2">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-gray-800 dark:text-slate-100 text-sm leading-tight truncate">
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

                  <div className="flex items-center justify-between mt-1.5 gap-2">
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {formatPrice(product.price)}
                    </span>

                    {isSoldOut && (
                      <span className="text-[10px] font-semibold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                        售完
                      </span>
                    )}

                    {product.trackInventory && availableQuantity !== null && !isSoldOut && (availability?.isLowStock ?? false) && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                        剩{availableQuantity}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {filteredProducts?.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <IconSearch className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-base font-medium">找不到符合條件的商品</p>
            <p className="text-sm mt-1 text-gray-300">請調整搜尋字詞或切換分類</p>
          </div>
        )}
      </div>
    </div>
  );
}
