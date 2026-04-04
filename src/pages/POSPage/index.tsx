import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { useCartStore } from '../../stores/useCartStore';
import MenuGrid from './MenuGrid';
import CartPanel from './CartPanel';
import ModifierModal from './ModifierModal';
import CheckoutModal from './CheckoutModal';
import type { Product } from '../../db/types';

export default function POSPage() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const { items } = useCartStore();

  const categories = useLiveQuery(() =>
    db.categories.filter(c => c.isActive).sortBy('sortOrder')
  );

  const handleProductClick = (product: Product) => {
    if (product.modifierGroupIds.length > 0) {
      setSelectedProduct(product);
    } else if (product.isCombo) {
      useCartStore.getState().addItem({
        productId: product.id!,
        productName: product.name,
        unitPrice: product.price,
        modifiers: [],
        isCombo: true,
        comboItems: [],
      });
    } else {
      useCartStore.getState().addItem({
        productId: product.id!,
        productName: product.name,
        unitPrice: product.price,
        modifiers: [],
      });
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col overflow-hidden">
        <MenuGrid
          categories={categories || []}
          onProductClick={handleProductClick}
        />
      </div>

      <CartPanel
        onCheckout={() => setShowCheckout(true)}
      />

      {selectedProduct && (
        <ModifierModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {showCheckout && items.length > 0 && (
        <CheckoutModal onClose={() => setShowCheckout(false)} />
      )}
    </div>
  );
}
