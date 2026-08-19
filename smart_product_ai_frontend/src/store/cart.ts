// smart_product_ai_frontend/src/store/cart.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  category: string;
  icon: string;
  quantity: number;
  vendor_id?: string;  // 🟢 Added vendor_id support
}

export interface Order {
  id: string;
  date: string;
  items: CartItem[];
  total: number;
  status: "Pending" | "Shipped" | "Delivered";
}

interface CartState {
  items: CartItem[];
  orders: Order[];
  isCartOpen: boolean;
  isLoading: boolean;
  error: string | null;
  setCartOpen: (open: boolean) => void;
  addToCart: (product: Omit<CartItem, "quantity">) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  checkout: (token?: string) => Promise<{ success: boolean; orderId?: string; checkoutUrl?: string }>;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      orders: [],
      isCartOpen: false,
      isLoading: false,
      error: null,

      setCartOpen: (open) => set({ isCartOpen: open }),

      addToCart: (product) => {
        const { items } = get();
        const existing = items.find((i) => i.id === product.id);

        if (existing) {
          set({
            items: items.map((i) =>
              i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
            ),
          });
        } else {
          set({ items: [...items, { ...product, quantity: 1 }] });
        }
      },

      removeFromCart: (id) => {
        set({ items: get().items.filter((i) => i.id !== id) });
      },

      updateQuantity: (id, delta) => {
        const { items } = get();
        set({
          items: items
            .map((i) => {
              if (i.id === id) {
                const newQty = i.quantity + delta;
                return newQty > 0 ? { ...i, quantity: newQty } : null;
              }
              return i;
            })
            .filter(Boolean) as CartItem[],
        });
      },

      clearCart: () => set({ items: [] }),

      checkout: async (token) => {
        const { items } = get();
        if (items.length === 0) return { success: false };

        set({ isLoading: true, error: null });

        try {
          // 1. Send the items to your backend API
          const response = await fetch("/api/v1/orders", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              items: items.map((i) => ({
                product_id: i.id,
                quantity: i.quantity,
              })),
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to initiate checkout");
          }

          const data = await response.json();

          // 2. Clear cart on success & close modal
          set({
            items: [],
            isCartOpen: false,
            isLoading: false,
          });

          // 3. Return the payload to the UI component for navigation
          return {
            success: true,
            orderId: data.id || data.order_id,
            checkoutUrl: data.checkout_url, // If returning a Stripe / payment link
          };
        } catch (err: any) {
          set({ isLoading: false, error: err.message || "Checkout failed" });
          return { success: false };
        }
      },
    }),
    { name: "marketplace-cart-storage" }
  )
);