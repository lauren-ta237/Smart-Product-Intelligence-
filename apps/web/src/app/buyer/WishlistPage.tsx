import { Link, useNavigate } from "react-router-dom";
import MarketplaceProductCard from "../../components/marketplace/MarketplaceProductCard";
import { useCart } from "../../store/cart";
import { useAuth } from "../../store/auth";
import { useWishlist } from "../../store/wishlist";
import { useWishlistSync } from "../../hooks/useWishlistSync";

export default function WishlistPage() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const { items, isLoading, error, hydrateWishlist, removeFromWishlist } = useWishlist();
  const addToCart = useCart((state) => state.addToCart);
  useWishlistSync();

  function addItem(item: (typeof items)[number]) {
    if (item.price === undefined || item.price <= 0) return;
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category ?? "Uncategorized",
      icon: "🛍️",
    });
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
      <header className="border-b border-white/10 pb-5">
        <h1 className="text-3xl font-black">Wishlist</h1>
        <p className="mt-2 text-sm text-slate-400">Products saved to your buyer account.</p>
      </header>
      {error && (
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
          <button type="button" onClick={() => void hydrateWishlist(user?.id ?? user?.email ?? null)} className="ml-3 font-bold underline">Retry</button>
        </div>
      )}
      {isLoading ? (
        <p className="py-16 text-center text-sm text-slate-400" role="status">Loading saved products…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <p className="text-sm text-slate-300">Your wishlist is empty.</p>
          <Link to="/products" className="mt-3 inline-block text-sm font-bold text-brand hover:text-orange-300">Explore products</Link>
        </div>
      ) : (
        <section aria-label="Saved products" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
          {items.map((item) => (
            <MarketplaceProductCard
              key={item.id}
              product={item}
              isWishlisted
              onToggleWishlist={() => void removeFromWishlist(item.id, user?.id ?? user?.email ?? "")}
              onAddToCart={() => addItem(item)}
            />
          ))}
        </section>
      )}
      <button type="button" onClick={() => navigate("/products")} className="text-sm font-semibold text-slate-400 hover:text-white">← Continue shopping</button>
    </main>
  );
}
