import React, { useState, useEffect, useRef } from "react";
import type { DetectedProduct } from "../../types/products.ts";
import { formatImageUrl, normalizeBoundingBox } from "../../api/imageUtils";
import { api } from "../../api/client";

interface Props {
  product: DetectedProduct;
  onUpdate?: (updatedProduct: DetectedProduct) => void;
  activeMarket?: string;
}

interface CatalogItem {
  sku: string;
  name: string;
  brand: string;
  category: string;
}

/**
 * Resolve the image URL from all common backend property variations.
 */
const getProductImageUrl = (product: DetectedProduct): string => {
  const imageUrl =
    (product as any).image_url ||
    (product as any).imageUrl ||
    (product as any).file_path ||
    (product as any).image ||
    "";

  if (!imageUrl || typeof imageUrl !== "string") {
    return "";
  }

  return imageUrl;
};

/**
 * Convert a normalized bounding box into an image crop style.
 */
const getCroppedStyle = (box: any, isSingleItem: boolean): React.CSSProperties => {
  if (isSingleItem) {
    return {
      width: "100%",
      height: "100%",
      objectFit: "contain",
      position: "relative",
    };
  }

  if (!box || typeof box !== "object") {
    return {
      width: "100%",
      height: "100%",
      objectFit: "contain",
      position: "relative",
    };
  }

  if (
    "x" in box &&
    "y" in box &&
    "width" in box &&
    "height" in box
  ) {
    const x = Number(box.x);
    const y = Number(box.y);
    const width = Number(box.width);
    const height = Number(box.height);

    if (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width > 0 &&
      height > 0
    ) {
      if (x <= 0.05 && y <= 0.05 && width >= 0.98 && height >= 0.98) {
        return {
          width: "100%",
          height: "100%",
          objectFit: "contain",
          position: "relative",
        };
      }

      return {
        position: "absolute",
        maxWidth: "none",
        maxHeight: "none",
        width: `${100 / width}%`,
        height: `${100 / height}%`,
        left: `-${(x / width) * 100}%`,
        top: `-${(y / height) * 100}%`,
      };
    }
  }

  return {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    position: "relative",
  };
};

export default function ProductCard({
  product,
  onUpdate,
}: Props) {
  const name =
    product.name ||
    (product as any).product_name ||
    "Unnamed Product";

  const imageUrl = getProductImageUrl(product);
  const rawBox = (product as any).bounding_box;

  // Normalize the bounding box using the utility function.
  const box = normalizeBoundingBox(rawBox);

  const isSingleItem =
    (product as any).is_single_item === true ||
    (product as any).detection_type === "single" ||
    (box &&
      ((box.width >= 0.98 && box.height >= 0.98) ||
        ((box as any).xmax - (box as any).xmin >= 0.98 &&
          (box as any).ymax - (box as any).ymin >= 0.98)));

  const [isEditing, setIsEditing] = useState(false);
  const [brand, setBrand] = useState(product.brand || "");
  const [category, setCategory] = useState(product.category || "");
  const [description, setDescription] = useState(product.description || "");
  const [sku, setSku] = useState(product.sku || "");
  const [location, setLocation] = useState(product.location || "");
  const [price, setPrice] = useState<number>(product.price ?? 0.0);
  const [stockQuantity, setStockQuantity] = useState<number>(
    product.stock_quantity ?? 0
  );

  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBrand(product.brand || "");
    setCategory(product.category || "");
    setDescription(product.description || "");
    setSku(product.sku || "");
    setLocation(product.location || "");
    setPrice(product.price ?? 0.0);
    setStockQuantity(product.stock_quantity ?? 0);
  }, [product]);

  useEffect(() => {
    if (name.trim().length < 2 || !isEditing) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await api.get(
          `/products/search?q=${encodeURIComponent(name)}`
        );
        if (response.status >= 200 && response.status < 300) {
          const data = response.data;
          setSearchResults(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Catalog search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [name, isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    if (onUpdate) {
      onUpdate({
        ...product,
        name,
        brand,
        category,
        description,
        sku: sku.trim() === "" ? null : sku.trim(),
        location: location.trim() === "" ? null : location.trim(),
        price: Number(price) || 0,
        stock_quantity: Number(stockQuantity) || 0,
      });
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setBrand(product.brand || "");
    setCategory(product.category || "");
    setDescription(product.description || "");
    setSku(product.sku || "");
    setLocation(product.location || "");
    setPrice(product.price ?? 0.0);
    setStockQuantity(product.stock_quantity ?? 0);
    setShowDropdown(false);
  };

  const formattedImageUrl = imageUrl ? formatImageUrl(imageUrl) : "";

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-44 w-full overflow-hidden bg-slate-900 rounded-2xl border border-white/5 flex items-center justify-center">
        {formattedImageUrl ? (
          <div className="relative w-full h-full overflow-hidden bg-slate-950 flex items-center justify-center">
            <img
              src={formattedImageUrl}
              alt={product.name || "Product"}
              className={
                isSingleItem
                  ? "w-full h-full object-contain object-center relative transition-all duration-300"
                  : "max-w-none absolute transition-all duration-300"
              }
              style={getCroppedStyle(box, !!isSingleItem)}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        ) : (
          <div className="text-[10px] font-bold text-slate-600 uppercase">
            No Image Data
          </div>
        )}
      </div>

      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-5 border border-white/5 shadow-xl">
        {isEditing ? (
          <div className="space-y-3 text-xs">
            <input
              type="text"
              value={name}
              readOnly
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-slate-500 uppercase font-bold px-1 mb-1 block">Price (FCFA)</label>
                <input
                  type="number"
                  step="any"
                  value={price}
                  onChange={(event) =>
                    setPrice(event.target.value === "" ? 0 : Number(event.target.value))
                  }
                  className="w-full bg-slate-950 border border-white/10 p-2 rounded-xl text-emerald-400 font-mono"
                />
              </div>

              <div>
                <label className="text-[9px] text-slate-500 uppercase font-bold px-1 mb-1 block">Quantity</label>
                <input
                  type="number"
                  step="1"
                  value={stockQuantity}
                  onChange={(event) =>
                    setStockQuantity(event.target.value === "" ? 0 : Number(event.target.value))
                  }
                  className="w-full bg-slate-950 border border-white/10 p-2 rounded-xl text-white font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 bg-emerald-500 text-slate-900 py-2 rounded-xl font-bold cursor-pointer"
              >
                Save
              </button>

              <button
                onClick={handleCancel}
                className="flex-1 bg-white/5 py-2 rounded-xl text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-white truncate">
              {name}
            </h2>

            <div className="flex justify-between items-center mt-2">
              <span className="text-emerald-400 font-bold font-mono">
                {Math.round(Number(price) || 0).toLocaleString()} FCFA
              </span>

              <span className="text-slate-400 text-[10px]">
                {stockQuantity} in stock
              </span>
            </div>

            <button
              onClick={() => setIsEditing(true)}
              className="w-full mt-4 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold cursor-pointer"
            >
              Edit Details
            </button>
          </>
        )}
      </div>
    </div>
  );
}