import { useState, useEffect, useRef } from "react";
import type { DetectedProduct } from "../../types/products.ts";
import { formatImageUrl, normalizeBoundingBox } from "../../api/imageUtils";

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

export default function ProductCard({ product, onUpdate }: Props) {
  const [isEditing, setIsEditing] = useState(false);

  // Form input states
  const [name, setName] = useState(product.name || (product as any).product_name || "");
  const [brand, setBrand] = useState(product.brand || "");
  const [category, setCategory] = useState(product.category || "");
  const [description, setDescription] = useState(product.description || "");
  const [sku, setSku] = useState(product.sku || "");
  const [location, setLocation] = useState(product.location || "");
  
  // Transactional controls
  const [price, setPrice] = useState<number>(product.price ?? 0.0);
  const [stockQuantity, setStockQuantity] = useState<number>(product.stock_quantity ?? 0);

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
    setPrice(product.price ?? 0.0);
    setStockQuantity(product.stock_quantity ?? 0);
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
        const response = await fetch(`http://localhost:8000/api/v1/products/search?q=${encodeURIComponent(name)}`);
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
        price: Number(price),
        stock_quantity: Number(stockQuantity),
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
    setPrice(product.price ?? 0.0);
    setStockQuantity(product.stock_quantity ?? 0);
    setShowDropdown(false);
  };

  // Extract direct image url safely if available on product object
  const imageUrl = (product as any).image_url || "";
  const box = normalizeBoundingBox(product.bounding_box);
  const zoomStyle = box ? {
    position: 'absolute' as const,
    width: `${100 / (box.width / 100)}%`,
    height: 'auto',
    left: `${-(box.x / box.width) * 100}%`,
    top: `${-(box.y / box.height) * 100}%`,
    maxWidth: 'none'
  } : {
    width: '100%',
    height: '100%',
    objectFit: 'contain' as const
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="h-44 bg-slate-900 rounded-2xl overflow-hidden border border-white/5 relative">
        {imageUrl ? (
          <img src={formatImageUrl(imageUrl)} alt={name || "Product"} style={zoomStyle} className="transition-all duration-300" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-600 uppercase">
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
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="bg-slate-950 p-2 rounded-xl text-emerald-400" />
              <input type="number" value={stockQuantity} onChange={e => setStockQuantity(Number(e.target.value))} className="bg-slate-950 p-2 rounded-xl text-white" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="flex-1 bg-emerald-500 text-slate-900 py-2 rounded-xl font-bold">Save</button>
              <button onClick={handleCancel} className="flex-1 bg-white/5 py-2 rounded-xl">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-white truncate">{name}</h2>
            <div className="flex justify-between items-center mt-2">
              <span className="text-emerald-400 font-bold">${Number(price).toFixed(2)}</span>
              <span className="text-slate-400 text-[10px]">{stockQuantity} in stock</span>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="w-full mt-4 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold"
            >
              Edit Product
            </button>
          </>
        )}
      </div>
    </div>
  );
}