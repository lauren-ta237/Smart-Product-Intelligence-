import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { Heart, ShoppingCart } from "lucide-react";
import { getProductById } from "../api/products";
import { formatImageUrl } from "../api/imageUtils";
import { useAuth } from "../store/auth";
import { useCart } from "../store/cart";
import { useWishlist } from "../store/wishlist";
import { useWishlistSync } from "../hooks/useWishlistSync";
import type { Product } from "../types/products";

export default function ProductDetails() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuth((state) => state.user);
  const addToCart = useCart((state) => state.addToCart);
  const { isInWishlist, addToWishlist, removeFromWishlist, error: wishlistError } = useWishlist();
  const [loadState, setLoadState] = useState<{
    key: string | undefined;
    product: Product | null;
    error: string | null;
  }>({ key: undefined, product: null, error: null });
  useWishlistSync();

  useEffect(() => {
    let active = true;
    if (!productId) return () => { active = false; };
    getProductById(productId)
      .then((result) => {
        if (active) setLoadState({ key: productId, product: result, error: null });
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (isAxiosError(requestError) && requestError.response?.status === 404) {
          setLoadState({ key: productId, product: null, error: "This product is unavailable or has been removed." });
        } else if (isAxiosError(requestError) && requestError.response?.status === 422) {
          setLoadState({ key: productId, product: null, error: "The product link is not valid." });
        } else {
          setLoadState({ key: productId, product: null, error: "Product details could not be loaded. Check your connection and try again." });
        }
      });
    return () => { active = false; };
  }, [productId]);

  const loading = loadState.key !== productId;
  const product = loadState.key === productId ? loadState.product : null;
  const error = !productId
    ? "A product ID is required."
    : loadState.key === productId
      ? loadState.error
      : null;

  function requireLogin() {
    navigate("/login", { state: { from: { pathname: location.pathname } } });
  }

  function toggleWishlist() {
    if (!product || !user) {
      requireLogin();
      return;
    }
    const ownerId = user.id ?? user.email ?? "";
    if (isInWishlist(product.id)) {
      void removeFromWishlist(product.id, ownerId);
    } else {
      void addToWishlist({
        id: product.id,
        name: product.name,
        category: product.category ?? undefined,
        imageUrl: product.image_url ?? undefined,
        price: product.price && product.price > 0 ? product.price : undefined,
        stock: product.stock_quantity ?? undefined,
      }, ownerId);
    }
  }

  function addProductToCart() {
    if (!product || product.price === null || product.price <= 0) return;
    if (!user) {
      requireLogin();
      return;
    }
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      category: product.category ?? "Uncategorized",
      icon: "🛍️",
      vendor_id: product.vendor_id ?? undefined,
    });
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400" role="status">Loading product details…</div>;
  }

  if (error || !product) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center text-white">
        <h1 className="text-2xl font-bold">{error?.includes("unavailable") ? "Product not found" : "Unable to load product"}</h1>
        <p role="alert" className="max-w-md text-sm text-slate-400">{error ?? "Product information is unavailable."}</p>
        <Link to="/products" className="text-sm font-bold text-brand hover:text-orange-300">Back to products</Link>
      </main>
    );
  }

  const image = product.crop_url || product.image_url;
  const wishlisted = isInWishlist(product.id);

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white sm:p-8 lg:p-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link to="/products" className="text-sm font-semibold text-brand hover:text-orange-300">← Back to products</Link>
        <section className="grid gap-7 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-8 md:grid-cols-2">
          <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 p-5 sm:min-h-96">
            {image ? (
              <img src={formatImageUrl(image)} alt={product.name} className="max-h-[30rem] max-w-full object-contain" />
            ) : (
              <p className="text-sm text-slate-500">No product image available.</p>
            )}
          </div>
          <div className="flex flex-col items-start">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">{product.category || "Uncategorized"}</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">{product.name}</h1>
            {product.brand && <p className="mt-2 text-sm text-slate-400">Brand: {product.brand}</p>}
            <p className="mt-6 text-2xl font-black text-white">
              {product.price !== null && product.price > 0 ? `${Number(product.price).toLocaleString()} FCFA` : "Price unavailable"}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {product.stock_quantity === null ? "Availability not provided" : product.stock_quantity > 0 ? `${product.stock_quantity} available` : "Out of stock"}
            </p>
            <div className="mt-6 w-full border-t border-white/10 pt-5">
              <h2 className="text-sm font-bold">Description</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{product.description || "No description has been provided for this product."}</p>
            </div>
            <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row">
              <button type="button" onClick={addProductToCart} disabled={product.price === null || product.price <= 0 || product.stock_quantity === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">
                <ShoppingCart size={17} aria-hidden="true" /> Add to cart
              </button>
              <button type="button" onClick={toggleWishlist} aria-pressed={wishlisted} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-bold hover:border-brand/50">
                <Heart size={17} fill={wishlisted ? "currentColor" : "none"} aria-hidden="true" /> {wishlisted ? "Saved" : "Save to wishlist"}
              </button>
            </div>
            {wishlistError && <p role="alert" className="mt-3 text-sm text-red-300">{wishlistError}</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
