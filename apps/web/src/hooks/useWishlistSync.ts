import { useEffect } from "react";
import { useAuth } from "../store/auth";
import { useWishlist } from "../store/wishlist";

export function useWishlistSync() {
  const ownerId = useAuth((state) => state.user?.id ?? state.user?.email ?? null);
  const token = useAuth((state) => state.token);
  const hydrateWishlist = useWishlist((state) => state.hydrateWishlist);

  useEffect(() => {
    void hydrateWishlist(token ? ownerId : null);
  }, [hydrateWishlist, ownerId, token]);
}
