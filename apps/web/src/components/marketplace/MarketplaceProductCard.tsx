import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, ShoppingCart } from "lucide-react";
import { formatImageUrl } from "../../api/imageUtils";

export interface MarketplaceCardProduct {
  id: string;
  name: string;
  category?: string;
  imageUrl?: string;
  crop_url?: string;
  price?: number;
  stock?: number;
  confidence_score?: number;
}

interface MarketplaceProductCardProps {
  product: MarketplaceCardProduct;
  isWishlisted: boolean;
  featured?: boolean;
  onToggleWishlist: () => void;
  onAddToCart: () => void;
}

export default function MarketplaceProductCard({
  product,
  isWishlisted,
  featured = false,
  onToggleWishlist,
  onAddToCart,
}: MarketplaceProductCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = product.crop_url || product.imageUrl;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 p-3 shadow-lg transition duration-200 hover:-translate-y-1 hover:border-brand/40 hover:bg-slate-900 hover:shadow-xl sm:p-4">
      <Link
        to={`/products/${encodeURIComponent(product.id)}`}
        aria-label={`View ${product.name}`}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      />

      <div className="relative z-10 flex flex-1 flex-col pointer-events-none">
        <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-xl bg-slate-950 p-3 sm:h-48">
          {imageUrl && !imageFailed ? (
            <img
              src={formatImageUrl(imageUrl)}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-500" aria-label="Product image unavailable">
              <ShoppingCart size={28} aria-hidden="true" />
              <span className="text-[11px]">Image unavailable</span>
            </div>
          )}
          {featured && (
            <span className="absolute left-2 top-2 rounded-md bg-brand/90 px-2 py-1 text-[9px] font-black uppercase text-white">
              Featured
            </span>
          )}
          <button
            type="button"
            onClick={onToggleWishlist}
            aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
            aria-pressed={isWishlisted}
            className="pointer-events-auto absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-950/80 text-slate-300 transition hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            <Heart size={17} fill={isWishlisted ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-2 px-1 pb-1 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {product.category || "Product"}
          </p>
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold text-white sm:text-base">
            {product.name}
          </h3>
          <div className="mt-auto flex min-h-10 items-center justify-between gap-2 pt-2">
            <p className="text-sm font-black text-brand sm:text-base">
              {product.price !== undefined && product.price > 0
                ? `${Math.round(product.price).toLocaleString()} FCFA`
                : "Price unavailable"}
            </p>
            {product.stock !== undefined && (
              <span className="text-[10px] text-slate-500">
                {product.stock} in stock
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onAddToCart}
            disabled={product.price === undefined || product.price <= 0}
            className="pointer-events-auto mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-xs font-bold text-white transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            <ShoppingCart size={15} aria-hidden="true" />
            {product.price !== undefined && product.price > 0 ? "Add to cart" : "Price unavailable"}
          </button>
        </div>
      </div>
    </article>
  );
}
