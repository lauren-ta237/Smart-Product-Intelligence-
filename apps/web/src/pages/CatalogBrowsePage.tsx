import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { getProducts } from "../api/products";
import MarketplaceProductCard, { type MarketplaceCardProduct } from "../components/marketplace/MarketplaceProductCard";
import type { Product, PaginatedProductsResponse } from "../types/products";
import { useAuth } from "../store/auth";
import { useCart } from "../store/cart";
import { useWishlist } from "../store/wishlist";
import { useWishlistSync } from "../hooks/useWishlistSync";

type BrowseProduct = Product & { crop_url?: string | null };
const EMPTY_PRODUCTS: BrowseProduct[] = [];

function extractProducts(data: Product[] | PaginatedProductsResponse): BrowseProduct[] {
  if (Array.isArray(data)) return data as BrowseProduct[];
  return Array.isArray(data.items) ? data.items as BrowseProduct[] : [];
}

function toCardProduct(product: BrowseProduct): MarketplaceCardProduct {
  return {
    id: product.id,
    name: product.name,
    category: product.category ?? undefined,
    imageUrl: product.image_url ?? undefined,
    crop_url: product.crop_url ?? undefined,
    price: product.price === null ? undefined : Number(product.price),
    stock: product.stock_quantity ?? undefined,
  };
}

function CatalogSearchForm({ query }: { query: string }) {
  const navigate = useNavigate();
  const [input, setInput] = useState(query);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = input.trim();
    navigate(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search");
  }

  return (
    <form onSubmit={submitSearch} className="flex w-full max-w-xl gap-2" role="search">
      <label className="sr-only" htmlFor="catalog-search">Search products</label>
      <div className="relative min-w-0 flex-1">
        <Search size={17} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input id="catalog-search" type="search" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Product name, description, or SKU" className="w-full rounded-xl border border-white/10 bg-slate-900 py-3 pl-10 pr-3 text-sm outline-none focus:border-brand" />
      </div>
      <button type="submit" className="rounded-xl bg-brand px-4 py-3 text-sm font-bold hover:bg-brand-hover">Search</button>
    </form>
  );
}

export default function CatalogBrowsePage({ mode }: { mode: "categories" | "search" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const requestKey = `${mode}:${query}`;
  const [loadState, setLoadState] = useState<{
    key: string;
    products: BrowseProduct[];
    loading: boolean;
    error: string | null;
  }>({ key: "", products: [], loading: true, error: null });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const user = useAuth((state) => state.user);
  const addToCart = useCart((state) => state.addToCart);
  const { items: wishlist, addToWishlist, removeFromWishlist, isInWishlist, error: wishlistError } = useWishlist();
  useWishlistSync();

  useEffect(() => {
    let active = true;
    if (mode === "search" && !query) {
      return () => { active = false; };
    }

    const filters = mode === "search"
      ? { approved: true, q: query }
      : { approved: true };
    getProducts(filters)
      .then((data) => {
        if (active) setLoadState({ key: requestKey, products: extractProducts(data), loading: false, error: null });
      })
      .catch(() => {
        if (active) setLoadState({
          key: requestKey,
          products: [],
          loading: false,
          error: mode === "search" ? "Search could not be completed. Please try again." : "Categories could not be loaded. Please try again.",
        });
      });
    return () => { active = false; };
  }, [mode, query, requestKey]);

  const noSearchQuery = mode === "search" && !query;
  const hasCurrentResult = loadState.key === requestKey;
  const products = hasCurrentResult ? loadState.products : EMPTY_PRODUCTS;
  const loading = noSearchQuery ? false : !hasCurrentResult || loadState.loading;
  const error = hasCurrentResult ? loadState.error : null;

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      const category = product.category?.trim();
      if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [products]);

  const visibleProducts = selectedCategory
    ? products.filter((product) => product.category === selectedCategory)
    : products;

  function toggleWishlist(product: BrowseProduct) {
    if (!user) {
      navigate("/login", { state: { from: location } });
      return;
    }
    const item = toCardProduct(product);
    if (isInWishlist(item.id)) {
      void removeFromWishlist(item.id, user.id ?? user.email ?? "");
    } else {
      void addToWishlist({
        id: item.id,
        name: item.name,
        category: item.category,
        imageUrl: item.imageUrl,
        crop_url: item.crop_url,
        price: item.price,
        stock: item.stock,
      }, user.id ?? user.email ?? "");
    }
  }

  function addProductToCart(product: BrowseProduct) {
    if (!user) {
      navigate("/login", { state: { from: location } });
      return;
    }
    const item = toCardProduct(product);
    if (item.price === undefined || item.price <= 0) return;
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category ?? "Uncategorized",
      icon: "🛍️",
    });
  }

  const wishlistIds = new Set(wishlist.map((item) => item.id));

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <Link to="/" className="text-sm font-semibold text-brand hover:text-orange-300">← Marketplace</Link>
            <h1 className="mt-3 text-3xl font-black">{mode === "categories" ? "Shop by category" : "Search products"}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {mode === "categories" ? "Explore available categories and browse matching listings." : "Search the catalog by product, description, or SKU."}
            </p>
          </div>
          {mode === "search" && (
            <CatalogSearchForm key={query} query={query} />
          )}
        </header>

        {mode === "categories" && (
          <section aria-label="Product categories" className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedCategory(null)} aria-pressed={!selectedCategory} className={`rounded-full border px-4 py-2 text-sm font-semibold ${!selectedCategory ? "border-brand bg-brand/15 text-brand" : "border-white/10 text-slate-300 hover:border-brand/40"}`}>
              All categories ({products.length})
            </button>
            {categories.map(([category, count]) => (
              <button key={category} type="button" onClick={() => setSelectedCategory(category)} aria-pressed={selectedCategory === category} className={`rounded-full border px-4 py-2 text-sm font-semibold ${selectedCategory === category ? "border-brand bg-brand/15 text-brand" : "border-white/10 text-slate-300 hover:border-brand/40"}`}>
                {category} ({count})
              </button>
            ))}
          </section>
        )}

        {mode === "search" && query && <p className="text-sm text-slate-400">Results for <strong className="text-white">“{query}”</strong></p>}
        {wishlistError && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{wishlistError}</p>}

        {loading ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center text-sm text-slate-400" role="status">Loading catalog…</p>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-300">{error}</div>
        ) : mode === "search" && !query ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-400">Enter a search term to find products in the catalog.</div>
        ) : visibleProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
            <p className="text-sm text-slate-300">{mode === "categories" ? "No products are available in this category yet." : "No products matched your search."}</p>
            {mode === "search" && <p className="mt-2 text-xs text-slate-500">Try a different product name, description, or SKU.</p>}
          </div>
        ) : (
          <section aria-label="Catalog results" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {visibleProducts.map((product) => {
              const card = toCardProduct(product);
              return (
                <MarketplaceProductCard
                  key={product.id}
                  product={card}
                  isWishlisted={wishlistIds.has(product.id)}
                  onToggleWishlist={() => toggleWishlist(product)}
                  onAddToCart={() => addProductToCart(product)}
                />
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
