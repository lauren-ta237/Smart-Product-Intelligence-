import { api } from "./client";

export interface WishlistProduct {
  id: string;
  name: string;
  category?: string | null;
  brand?: string | null;
  price?: number | null;
  stock_quantity?: number | null;
  image_url?: string | null;
  created_at?: string;
}

export async function getWishlist(): Promise<WishlistProduct[]> {
  const response = await api.get<WishlistProduct[]>("/wishlist");
  return response.data;
}

export async function addWishlistItem(productId: string): Promise<void> {
  await api.post(`/wishlist/${encodeURIComponent(productId)}`);
}

export async function removeWishlistItem(productId: string): Promise<void> {
  await api.delete(`/wishlist/${encodeURIComponent(productId)}`);
}
