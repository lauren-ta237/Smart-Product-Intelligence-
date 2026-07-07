import { useState, useEffect, useRef } from "react";
import type { DetectedProduct } from "../../types/products.ts";

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

export default function ProductCard({ product, onUpdate, activeMarket = "US" }: Props) {
  const [isEditing, setIsEditing] = useState(false);

  // Form input states
  const [name, setName] = useState(product.name || (product as any).product_name || "");
  const [brand, setBrand] = useState(product.brand || "");
  const [category, setCategory] = useState(product.category || "");
  const [description, setDescription] = useState(product.description || "");
  const [sku, setSku] = useState(product.sku || "");
  const [location, setLocation] = useState(product.location || "");

  // Catalog search autocomplete states
  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync state with parent props updates
  useEffect(() => {
    setName(product.name || (product as any).product_name || "");
    setBrand(product.brand || "");
    setCategory(product.category || "");
    setDescription(product.description || "");
    setSku(product.sku || "");
    setLocation(product.location || "");
  }, [product]);

  // Handle live search debouncing
  useEffect(() => {
    if (name.trim().length < 2 || !isEditing) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`http://localhost:8000/api/inventory/search?q=${encodeURIComponent(name)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error("Catalog search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [name, isEditing]);

  // Close search dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectCatalogItem = (item: CatalogItem) => {
    setName(item.name);
    setSku(item.sku);
    setBrand(item.brand || "");
    setCategory(item.category || "");
    setShowDropdown(false);
  };

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
      });
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setName(product.name || (product as any).product_name || "");
    setBrand(product.brand || "");
    setCategory(product.category || "");
    setDescription(product.description || "");
    setSku(product.sku || "");
    setLocation(product.location || "");
    setShowDropdown(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* 📦 PRIMARY CARD WRAPPER */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-5 border border-white/5 shadow-xl flex flex-col justify-between">
        {isEditing ? (
          <div className="space-y-3 text-xs text-slate-300">
            
            {/* 🔍 SEARCHABLE AUTOCOMPLETE PRODUCT NAME FIELD */}
            <div className="relative" ref={dropdownRef}>
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">
                Search Master Inventory Catalog
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onFocus={() => setShowDropdown(true)}
                  onChange={(e) => {
                    setName(e.target.value);
                    setShowDropdown(true);
                  }}
                  placeholder="Type item name or search pattern..."
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors pr-8"
                />
                {isSearching && (
                  <div className="absolute right-3 top-2.5">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-400"></div>
                  </div>
                )}
              </div>

              {/* Suggestions dropdown panel */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-white/10 rounded-xl shadow-2xl divide-y divide-white/5 scrollbar-thin">
                  {searchResults.map((item) => (
                    <button
                      key={item.sku}
                      type="button"
                      onClick={() => handleSelectCatalogItem(item)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-900 transition-colors flex flex-col gap-0.5"
                    >
                      <span className="text-white font-medium text-xs">{item.name}</span>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span className="text-emerald-400">{item.sku}</span>
                        <span>•</span>
                        <span>{item.brand}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Brand</label>
                <input
                  type="text"
                  value={brand}
                  readOnly
                  className="w-full bg-slate-950/40 border border-white/5 rounded-xl px-3 py-2 text-slate-400 cursor-not-allowed outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  readOnly
                  className="w-full bg-slate-950/40 border border-white/5 rounded-xl px-3 py-2 text-slate-400 cursor-not-allowed outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Verified SKU</label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Auto-assigns via lookup"
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-emerald-400 font-mono focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Shelf Location</label>
                <input
                  type="text"
                  placeholder="e.g. Aisle 2, Shelf B"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                className="w-full px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-slate-300 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* 👁️ VIEW MODE DISPLAY */
          <>
            <div>
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg font-bold text-white tracking-tight">{name}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                {brand && (
                  <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/5">
                    {brand}
                  </span>
                )}
                {category && <span className="text-xs text-slate-400 font-medium">• {category}</span>}
              </div>

              {description && (
                <p className="text-sm text-slate-400 mt-3 line-clamp-2 leading-relaxed">{description}</p>
              )}
            </div>

            <div>
              {/* AI Match Confidence Row */}
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">AI Match Confidence:</span>
                <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/10">
                  {Math.round((product.confidence_score ?? 0) * 100)}%
                </span>
              </div>

              <button
                onClick={() => setIsEditing(true)}
                className="w-full mt-4 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-slate-200 transition-colors text-xs font-semibold tracking-wide cursor-pointer"
              >
                Edit Product
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}