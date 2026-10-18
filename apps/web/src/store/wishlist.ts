import { create } from "zustand";
import {
  addWishlistItem,
  getWishlist,
  removeWishlistItem,
} from "../api/wishlist";

export interface WishlistProduct {
  id: string;
  name: string;
  category?: string;
  imageUrl?: string;
  crop_url?: string;
  price?: number;
  stock?: number;
  vendor_id?: string;
}

interface WishlistState {
  items: WishlistProduct[];
  ownerId: string | null;
  hasLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  hydrateWishlist: (ownerId: string | null) => Promise<void>;
  addToWishlist: (item: WishlistProduct, ownerId: string) => Promise<void>;
  removeFromWishlist: (id: string, ownerId: string) => Promise<void>;
  isInWishlist: (id: string) => boolean;
}

function fromApiProduct(product: Awaited<ReturnType<typeof getWishlist>>[number]): WishlistProduct {
  const price = product.price === null || product.price === undefined
    ? undefined
    : Number(product.price);

  return {
    id: product.id,
    name: product.name,
    category: product.category ?? undefined,
    imageUrl: product.image_url ?? undefined,
    price: price !== undefined && Number.isFinite(price) && price > 0 ? price : undefined,
    stock: product.stock_quantity ?? undefined,
  };
}

export const useWishlist = create<WishlistState>((set, get) => ({
  items: [],
  ownerId: null,
  hasLoaded: false,
  isLoading: false,
  error: null,

  hydrateWishlist: async (ownerId) => {
    if (!ownerId) {
      set({ items: [], ownerId: null, hasLoaded: false, isLoading: false, error: null });
      return;
    }
    if (get().ownerId === ownerId && (get().isLoading || get().hasLoaded)) return;

    set({ items: [], ownerId, hasLoaded: false, isLoading: true, error: null });
    try {
      const products = await getWishlist();
      if (get().ownerId === ownerId) {
        set({ items: products.map(fromApiProduct), hasLoaded: true, isLoading: false });
      }
    } catch {
      if (get().ownerId === ownerId) {
        set({
          items: [],
          isLoading: false,
          error: "Your wishlist could not be loaded. Please try again.",
        });
      }
    }
  },

  addToWishlist: async (item, ownerId) => {
    if (get().ownerId !== ownerId) {
      await get().hydrateWishlist(ownerId);
    }
    if (get().ownerId !== ownerId) return;
    const currentItems = get().items;
    if (currentItems.some((saved) => saved.id === item.id)) return;

    set({ items: [...currentItems, item], error: null });
    try {
      await addWishlistItem(item.id);
    } catch {
      if (get().ownerId === ownerId) {
        set({
          items: get().items.filter((saved) => saved.id !== item.id),
          error: "This product could not be saved to your wishlist.",
        });
      }
    }
  },

  removeFromWishlist: async (id, ownerId) => {
    if (get().ownerId !== ownerId) {
      await get().hydrateWishlist(ownerId);
    }
    if (get().ownerId !== ownerId) return;
    const previousItems = get().items;
    if (!previousItems.some((item) => item.id === id)) return;

    set({ items: previousItems.filter((item) => item.id !== id), error: null });
    try {
      await removeWishlistItem(id);
    } catch {
      if (get().ownerId === ownerId) {
        set({
          items: get().items.some((item) => item.id === id)
            ? get().items
            : [...get().items, ...previousItems.filter((item) => item.id === id)],
          error: "This product could not be removed from your wishlist.",
        });
      }
    }
  },

  isInWishlist: (id) => get().items.some((item) => item.id === id),
}));
