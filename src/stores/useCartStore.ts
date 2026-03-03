import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, ComboItem, SelectedModifier } from '../db/types';

interface CartState {
  items: CartItem[];
  tableId: number | null;
  tableName: string;
  note: string;
  addItem: (item: {
    productId: number;
    productName: string;
    unitPrice: number;
    modifiers: SelectedModifier[];
    note?: string;
    isCombo?: boolean;
    comboItems?: ComboItem[];
  }) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  updateNote: (cartItemId: string, note: string) => void;
  setTable: (tableId: number | null, tableName: string) => void;
  setOrderNote: (note: string) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      tableId: null,
      tableName: '',
      note: '',

      addItem: (item) => {
        const modifiersTotal = item.modifiers.reduce((sum, m) => sum + m.price, 0);
        set((state) => ({
          items: [
            ...state.items,
            {
              cartItemId: crypto.randomUUID(),
              productId: item.productId,
              productName: item.productName,
              unitPrice: item.unitPrice,
              quantity: 1,
              modifiers: item.modifiers,
              modifiersTotal,
              note: item.note || '',
              isCombo: item.isCombo,
              comboItems: item.comboItems,
            },
          ],
        }));
      },

      removeItem: (cartItemId) =>
        set((state) => ({
          items: state.items.filter((i) => i.cartItemId !== cartItemId),
        })),

      updateQuantity: (cartItemId, delta) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.cartItemId === cartItemId
                ? { ...i, quantity: Math.max(0, i.quantity + delta) }
                : i
            )
            .filter((i) => i.quantity > 0),
        })),

      updateNote: (cartItemId, note) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.cartItemId === cartItemId ? { ...i, note } : i
          ),
        })),

      setTable: (tableId, tableName) => set({ tableId, tableName }),

      setOrderNote: (note) => set({ note }),

      clearCart: () =>
        set({ items: [], tableId: null, tableName: '', note: '' }),

      getSubtotal: () =>
        get().items.reduce(
          (sum, item) =>
            sum + (item.unitPrice + item.modifiersTotal) * item.quantity,
          0
        ),

      getItemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    { name: 'pos-cart' }
  )
);
