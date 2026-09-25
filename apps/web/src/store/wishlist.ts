import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type ProduceItem } from "../pages/dashboard";

interface WishlistState {
  items: ProduceItem[];
  addToWishlist: (item: ProduceItem) => void;
  removeFromWishlist: (id: string) => void;
  isInWishlist: (id: string) => boolean;
  clearWishlist: () => void;
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      addToWishlist: (item) => {
        const { items } = get();
        if (!items.some((i) => i.id === item.id)) {
          set({ items: [...items, item] });
        }
      },
      removeFromWishlist: (id) => {
        set({ items: get().items.filter((i) => i.id !== id) });
      },
      isInWishlist: (id) => {
        return get().items.some((i) => i.id === id);
      },
      clearWishlist: () => set({ items: [] }),
    }),
    { name: "marketplace-wishlist-storage" }
  )
);