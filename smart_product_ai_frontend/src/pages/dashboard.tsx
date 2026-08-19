import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useCart } from "../store/cart";
import { useWishlist } from "../store/wishlist";
// Component Imports
import VendorOrders from "../components/vendor/VendorOrders";
import Upload from "../features/upload/UploadDropzone";
// API Service Imports
import { formatImageUrl, normalizeBoundingBox } from "../api/imageUtils";
import { getProducts } from "../api/products";
import { useDashboard } from "../hooks/useDashboard";
import { getBuyerOrders } from "../api/orders";

// --- TYPE DEFINITIONS ---
export interface BoundingBox {
  x: number;       
  y: number;
  width: number;
  height: number;
  label?: string;
  confidence?: number;
}

export interface RawProduct {
  id?: string | number;
  name?: string;
  brand?: string;
  category?: string;
  confidence_score?: number;
  image_url?: string;
  imageUrl?: string;
  price?: number | string;
  suggested_price?: number | string;
  unit_price?: number | string;
  bounding_box?: any; 
  bounding_boxes?: BoundingBox[];
  boundingBoxes?: BoundingBox[];
  stock_quantity?: number;
  vendor_id?: string;
}
export interface ProduceItem {
  id: string;
  name: string;
  category?: string;
  confidence_score?: number;
  imageUrl?: string;
  price?: number;
  boundingBoxes?: BoundingBox[];
  stock?: number;
  vendor_id?: string;
}
export interface CartItem extends ProduceItem {
  quantity: number;
}

interface MarketplaceHeaderProps {
  setCartOpen: (open: boolean) => void;
  totalCartCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeTab: "marketplace" | "activity";
  setActiveTab: (tab: "marketplace" | "activity") => void;
}

// --- HEADER COMPONENT ---
export const MarketplaceHeader: React.FC<MarketplaceHeaderProps> = ({
  setCartOpen,
  totalCartCount,
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
}) => {
  const user = useAuth((state) => state.user) as { role?: string; is_verified?: boolean } | null;
  const isVendor = user?.role?.toLowerCase() === "vendor";
  const isVerified = Boolean(user?.is_verified);

  return (
    <header className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 border-b border-white/10 pb-8">
      {/* Brand Section */}
      <div className="shrink-0 text-center lg:text-left">
        <h1 className="text-3xl font-black text-emerald-400 tracking-tighter uppercase italic">
          Smart Product Marketplace
        </h1>
        <p className="text-slate-500 mt-1 text-[10px] font-bold uppercase tracking-widest">
          AI-Verified Inventory • Express Fulfillment
        </p>
      </div>

      {/* Nav Tabs */}
      {!isVendor && (
        <div className="flex bg-slate-900 border border-white/10 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setActiveTab("marketplace")}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
              activeTab === "marketplace" ? "bg-emerald-500 text-slate-950 shadow-lg" : "text-slate-500 hover:text-white"
            }`}
          >
            Marketplace
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
              activeTab === "activity" ? "bg-emerald-500 text-slate-950 shadow-lg" : "text-slate-400 hover:text-white"
            }`}
          >
            Dashboard
          </button>
        </div>
      )}

      {/* 🟢 FIXED SEARCH BAR: Solid background, High Contrast, No Blur */}
      {!isVendor && activeTab === "marketplace" && (
        <div className="relative flex-1 max-w-md group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg z-10 group-focus-within:text-emerald-400 transition-colors">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search catalog (Tools, Equipment, Fruit...)"
            className="w-full bg-slate-950 border-2 border-white/15 rounded-2xl pl-12 pr-10 py-3 text-sm text-white font-bold placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all shadow-2xl"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Actions Section */}
      <div className="flex items-center gap-3 ml-auto">
        <Link
          to="/buyer/orders"
          className="bg-slate-900 hover:bg-slate-800 text-white border border-white/10 px-4 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 shadow-sm"
        >
          <span>📦</span>
          <span>Track Orders</span>
        </Link>
        
        {!isVendor && (
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl font-black uppercase flex items-center gap-3 transition-all shadow-xl shadow-emerald-950/50 cursor-pointer text-xs"
          >
            <span>🛒 Cart</span>
            <span className="bg-white text-emerald-950 text-xs font-black px-2 py-0.5 rounded-full">
              {totalCartCount}
            </span>
          </button>
        )}

        <button
          onClick={() => useAuth.getState().logout()}
          className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-xs font-black uppercase cursor-pointer transition-all"
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [cartOpen, setCartOpen] = useState(false);
  const [marketplaceProducts, setMarketplaceProducts] = useState<ProduceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState<boolean>(true);
  
  const [activeTab, setActiveTab] = useState<"marketplace" | "activity">(
    location.pathname.includes("wishlist") || location.pathname.includes("activity") ? "activity" : "marketplace"
  );

  const [buyerOrders, setBuyerOrders] = useState<any[]>([]);
  const [notifications] = useState<string[]>([
    "Your recent Sandbox Checkout Order has been confirmed.",
    "Verify store updates: Gemini AI localized metrics analysis completed.",
    "Alert: Organic Fresh Apples are back in stock."
  ]);

  const user = useAuth((state) => state.user) as { email?: string; role?: string; is_verified?: boolean } | null;
  const isVendor = user?.role?.toLowerCase() === "vendor";
  const isVerified = Boolean(user?.is_verified);

  const { items: cartItems, addToCart, updateQuantity, clearCart } = useCart();
  const { items: wishlistItems, addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  const { data: stats } = useDashboard();

  const totalCartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  const totalCartPrice = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cartItems]);

  const mapRawToProduceItem = useCallback((item: RawProduct, fallbackImage = ""): ProduceItem => {
    const activePrice = item.price ?? item.suggested_price ?? item.unit_price;
    const rawPrice = Number(activePrice);
    const parsedPrice = !isNaN(rawPrice) && rawPrice > 0 ? rawPrice : 5.00;

    const finalUrl = item.image_url || item.imageUrl || fallbackImage || "";

    let boxes: BoundingBox[] = [];
    if (item.bounding_box) {
        const normalized = normalizeBoundingBox(item.bounding_box);
        if (normalized) boxes = [normalized];
    } else if (item.boundingBoxes || item.bounding_boxes) {
        const rawBoxes = item.boundingBoxes || item.bounding_boxes || [];
        boxes = rawBoxes.map(b => normalizeBoundingBox(b)).filter(Boolean) as BoundingBox[];
    }

    return {
      id: String(item.id || `prod-${Math.random().toString(36).substring(2, 9)}`),
      name: String(item.name || item.brand || "AI-Verified Produce"),
      category: String(item.category || "Fresh Produce"),
      confidence_score: typeof item.confidence_score === "number" ? item.confidence_score : 0.95,
      imageUrl: finalUrl,
      price: parsedPrice,
      boundingBoxes: boxes,
      stock: item.stock_quantity ?? 50,
      vendor_id: item.vendor_id ? String(item.vendor_id) : undefined  
    };
  }, []);

  const refreshProductsData = useCallback(async () => {
    try {
      setLoading(true);
      // STEP 3.4: Explicitly fetch only approved products for the buyer marketplace
      const data = await getProducts({ approved: true });

      const rawProducts: RawProduct[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.items)
          ? (data as any).items
          : [];

      const mapped: ProduceItem[] = rawProducts.map((item) => mapRawToProduceItem(item));
      setMarketplaceProducts(mapped);

      if (!isVendor) {
        const ordersRes = await getBuyerOrders();
        setBuyerOrders(ordersRes || []);
      }
    } catch (error) {
      console.error("Marketplace Sync Error:", error);
    } finally {
      setLoading(false);
    }
  }, [mapRawToProduceItem, isVendor]);

  useEffect(() => {
    refreshProductsData();
  }, [refreshProductsData]);

  useEffect(() => {
    const handleNewUpload = (event: Event) => {
      const customEvent = event as CustomEvent<{ image_url: string; products: RawProduct[] }>;
      const { image_url, products } = customEvent.detail || {};

      if (Array.isArray(products) && products.length > 0) {
        const formattedProducts: ProduceItem[] = products.map((item) =>
          mapRawToProduceItem(item, image_url)
        );
        setMarketplaceProducts((prev) => [...formattedProducts, ...prev]);
      }
    };
    window.addEventListener("produceUploaded", handleNewUpload);
    return () => window.removeEventListener("produceUploaded", handleNewUpload);
  }, [mapRawToProduceItem]);

  useEffect(() => {
    window.addEventListener("products:updated", refreshProductsData);
    return () => window.removeEventListener("products:updated", refreshProductsData);
  }, [refreshProductsData]);

  const handleAddToCart = useCallback((product: ProduceItem) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price ?? 5.0,
      category: product.category ?? "Fresh Produce",
      icon: "🥦",
      vendor_id: product.vendor_id  
    });
  }, [addToCart]);

  const handleToggleWishlist = (product: ProduceItem) => {
    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  const handleProceedToCheckout = () => {
    setCartOpen(false);
    navigate("/checkout");
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return marketplaceProducts;
    const query = searchQuery.toLowerCase();
    return marketplaceProducts.filter( 
      (prod) =>
        prod.name.toLowerCase().includes(query) ||
        prod.category?.toLowerCase().includes(query)
    );
  }, [marketplaceProducts, searchQuery]);

  const recommendedProducts = useMemo(() => {
    return marketplaceProducts.slice(0, 3);
  }, [marketplaceProducts]);

  if (isVendor && !isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white p-6 sm:p-10 flex flex-col justify-center items-center">
        <div className="max-w-md w-full bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center text-3xl mx-auto">
            ⏳
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Account Pending Approval</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your vendor registration is currently being verified by our platform administrators. You will automatically receive dashboard access once verified.
            </p>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 text-left text-[11px] text-slate-500 space-y-1">
            <p>• Verification normally takes less than 24 business hours.</p>
            <p>• You can contact help@smartproduct.ai for status query tickets.</p>
          </div>
          <button
            onClick={() => useAuth.getState().logout()}
            className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-bold text-xs py-3 rounded-xl transition-all cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 sm:p-10 font-sans antialiased">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
        <MarketplaceHeader
          setCartOpen={setCartOpen}
          totalCartCount={totalCartCount}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
        {isVendor ? (
          <main className="space-y-8 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider font-mono">Sales Revenue</span>
                <h3 className="text-3xl font-black text-emerald-400 mt-2">
                  ${stats?.revenue ? stats.revenue.toFixed(2) : "0.00"}
                </h3>
              </div>
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider font-mono">New Orders</span>
                <h3 className="text-3xl font-black text-amber-400 mt-2">
                  {stats?.new_orders ?? 0}
                </h3>
              </div>
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider font-mono">Pending Fulfillment</span>
                <h3 className="text-3xl font-black text-indigo-400 mt-2">
                  {stats?.pending_orders ?? 0}
                </h3>
              </div>
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider font-mono">Completed Orders</span>
                <h3 className="text-3xl font-black text-emerald-400 mt-2">
                  {stats?.completed_orders ?? 0}
                </h3>
              </div>
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider font-mono">Low Stock Alerts</span>
                <h3 className="text-3xl font-black text-rose-400 mt-2">
                  {stats?.low_stock_alerts ?? 0}
                </h3>
              </div>
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider font-mono">Listed Products</span>
                <h3 className="text-3xl font-black text-slate-100 mt-2">
                  {stats?.products ?? 0}
                </h3>
              </div>
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider font-mono">Images Scanned</span>
                <h3 className="text-3xl font-black text-slate-100 mt-2">
                  {stats?.images ?? 0}
                </h3>
              </div>
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider font-mono">AI Accuracy</span>
                <h3 className="text-3xl font-black text-cyan-400 mt-2">
                  {((stats?.accuracy ?? 0.96) * 100).toFixed(1)}%
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col justify-between lg:col-span-2">
                <VendorOrders />
              </div>

              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
                <div className="border-b border-white/10 pb-3">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>📸</span> Quick AI Verification
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    Upload new produce images for AI quality audit
                  </p>
                </div>
                <Upload />
              </div>
            </div>

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">My Store Inventory</h2>
                  <p className="text-slate-400 text-xs mt-1">Real-time shelf placement & stock configurations</p>
                </div>
                <Link to="/review" className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline">
                  View Full Catalog History →
                </Link>
              </div>

              {marketplaceProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-2xl">
                  Your store inventory ledger is empty. Upload produce photos above to parse products.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {marketplaceProducts.map((p) => {
                    const box = normalizeBoundingBox(p.boundingBoxes?.[0]);
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
                      <div key={p.id} className="bg-slate-900/60 border border-white/5 p-4 rounded-2xl space-y-3">
                      <div className="h-32 bg-slate-950 rounded-xl overflow-hidden border border-white/5 relative flex items-center justify-center">
                        <img src={formatImageUrl(p.imageUrl)} alt={p.name} className="max-w-none transition-transform duration-300" style={zoomStyle}
                          onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80"; }}
                        />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm truncate text-white">{p.name}</h4>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                          <span>Qty: <strong className="text-slate-200">{p.stock ?? 10} units</strong></span>
                          <span className="text-emerald-400 font-bold">${p.price?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );})}
                </div>
              )}
            </div>
          </main>
        ) : activeTab === "marketplace" ? (
          <main className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Available Produce</h2>
                  <p className="text-slate-400 text-xs mt-1">
                    Fresh, AI-inspected batch offerings from verified vendors
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("activity")}
                  className="text-emerald-400 hover:text-emerald-300 text-xs font-bold underline transition-colors cursor-pointer"
                >
                  View My Previous Orders & Activity →
                </button>
              </div>
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="bg-white/5 border border-white/5 p-5 rounded-2xl animate-pulse space-y-4">
                      <div className="h-44 bg-slate-900 rounded-xl" />
                      <div className="h-4 bg-slate-800 rounded w-3/4" />
                      <div className="h-3 bg-slate-800 rounded w-1/2" />
                      <div className="h-10 bg-slate-800 rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm bg-white/[0.01] rounded-2xl border border-dashed border-white/10">
                  <span className="text-3xl block mb-2">🔍</span>
                  {searchQuery ? `No produce matching "${searchQuery}"` : "No products available in the catalog yet."}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {filteredProducts.map((prod) => {
                    const isWishlisted = isInWishlist(prod.id);
                    const box = normalizeBoundingBox(prod.boundingBoxes?.[0]);
                    const isElectronics = prod.category?.toLowerCase() === 'electronics' || prod.name.toLowerCase().includes('iphone');
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
                      <div
                        key={prod.id}
                        className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-3 flex flex-col justify-between transition-all hover:border-white/20 hover:bg-white/[0.07] relative group"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleWishlist(prod)}
                          className="absolute top-7 right-7 z-30 p-1.5 rounded-full bg-slate-950/80 border border-white/10 text-sm hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                          title={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                        >
                          {isWishlisted ? "⭐" : "☆"}
                        </button>

                        <div>
                          <div className="h-48 bg-slate-900 rounded-2xl overflow-hidden relative border border-white/5 flex items-center justify-center">
                            {/* Debug Label: Remove after fix is verified */}
                            <img src={formatImageUrl(prod.imageUrl)} alt={prod.name} className="max-w-none transition-all duration-500" style={zoomStyle}
                              onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80"; }} />
                            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black text-emerald-400 border border-emerald-500/20 z-10">✨ AI VERIFIED</div>
                          </div>
                          <h3 className="font-bold text-lg text-white truncate h-7 mt-3">{prod.name}</h3>
                          <p className="text-xs text-slate-400 h-4">{prod.category || "Fresh Produce"}</p>
                          <div className="flex justify-between items-center mt-2">
                            <p className="text-base font-bold text-emerald-400">
                              ${(prod.price ?? 5.00).toFixed(2)} / {isElectronics ? 'unit' : 'kg'}
                            </p>
                            <span className="text-[10px] text-slate-500 font-medium">Stock: {prod.stock ?? 25} units</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddToCart(prod)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-lg shadow-emerald-950/50 mt-4"
                        >
                          Add to Cart
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        ) : (
          <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-200">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl lg:col-span-2 space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white">Recent Orders & Shipment Tracking</h3>
                <p className="text-slate-400 text-xs">Simulated Sandbox Order Shipments</p>
              </div>
              {buyerOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-2xl">
                  You have not placed any orders yet. Add items to your cart to purchase.
                </div>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                  {buyerOrders.map((ord) => (
                    <div key={ord.id} className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 space-y-3">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-400 font-mono">
                        <span>OrderID: <strong className="text-slate-200">{ord.id.substring(0, 13)}...</strong></span>
                        <span>{ord.date}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-300 font-medium truncate max-w-xs">
                          {ord.items?.map((i: any) => `${i.product_name} x${i.quantity}`).join(", ")}
                        </span>
                        <span className="font-mono text-emerald-400 font-bold">${ord.total_price}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-white/5 text-[10px]">
                        <span className="text-slate-500 font-mono">Carrier: {ord.carrier || "Sandbox logistics"}</span>
                        <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded font-bold uppercase">
                          {ord.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-3">
                <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">Profile Credentials</h3>
                <div className="space-y-1 text-xs">
                  <p className="text-slate-500">Email: <strong className="text-slate-300 font-mono font-medium">{user?.email}</strong></p>
                  <p className="text-slate-500">Account Role: <span className="bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded font-bold font-mono text-[10px]">{user?.role}</span></p>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-3">
                <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">My Wishlist Favorites</h3>
                {wishlistItems.length === 0 ? (
                  <p className="text-[11px] text-slate-500 py-3 text-center">Your wishlist is empty. Add products on the marketplace.</p>
                ) : (
                  <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1">
                    {wishlistItems.map((fav) => (
                      <div key={fav.id} className="flex justify-between items-center text-xs bg-slate-900/40 p-2 rounded-xl border border-white/5">
                        <div className="flex items-center gap-2 truncate">
                          <img src={formatImageUrl(fav.imageUrl)} alt={fav.name} className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = ""; }} />
                          <div className="truncate">
                            <span className="text-slate-200 font-semibold block truncate text-[11px]">{fav.name}</span>
                            <span className="text-[10px] text-slate-500">${fav.price?.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleAddToCart(fav)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-2 py-1 rounded text-[10px]"
                          >
                            Buy
                          </button>
                          <button
                            onClick={() => removeFromWishlist(fav.id)}
                            className="text-slate-500 hover:text-red-400 font-bold p-1 text-[11px]"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-3">
                <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">Recommended For You</h3>
                <div className="space-y-3">
                  {recommendedProducts.map((rec) => (
                    <div key={rec.id} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🥦</span>
                        <span className="text-slate-200 font-medium truncate max-w-[120px]">{rec.name}</span>
                      </div>
                      <span className="font-mono text-emerald-400 font-bold text-[11px]">${rec.price?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-3">
                <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">Live Alerts & Notifications</h3>
                <ul className="space-y-2">
                  {notifications.map((msg, idx) => (
                    <li key={idx} className="p-2.5 bg-slate-900/60 border border-white/5 rounded-xl text-[10px] text-slate-400 leading-relaxed flex items-start gap-2">
                      <span className="text-emerald-400 shrink-0">🔔</span>
                      <span>{msg}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </main>
        )}
      </div>
      {cartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50 transition-opacity">
          <div className="bg-slate-900 border-l border-white/10 w-full max-w-md p-6 h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">
                    Your Cart ({totalCartCount})
                  </h3>
                  {cartItems.length > 0 && (
                    <button
                      onClick={clearCart}
                      className="text-[10px] text-slate-400 hover:text-red-400 underline transition-colors ml-2"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setCartOpen(false)}
                  className="text-slate-400 hover:text-white font-bold text-xl cursor-pointer p-1 transition-colors"
                >
                  ✕
                </button>
              </div>
              {cartItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm space-y-3">
                  <span className="text-4xl block">🛒</span>
                  <p>Your cart is currently empty.</p>
                </div>
              ) : (
                <ul className="mt-4 space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                  {cartItems.map((item) => (
                    <li key={item.id} className="bg-white/5 p-3.5 rounded-xl text-sm flex justify-between items-center border border-white/5">
                      <div>
                        <p className="font-semibold text-white truncate max-w-[180px]">{item.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          ${item.price.toFixed(2)} / {item.category?.toLowerCase() === 'electronics' ? 'unit' : 'kg'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-6 h-6 bg-white/10 hover:bg-white/20 text-white rounded-md flex items-center justify-center font-bold text-xs transition-colors"
                        >
                          -
                        </button>
                        <span className="text-white font-mono font-bold text-xs px-1">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-6 h-6 bg-white/10 hover:bg-white/20 text-white rounded-md flex items-center justify-center font-bold text-xs transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-white/10 pt-4 space-y-4">
              <div className="flex justify-between items-center text-white">
                <span className="text-slate-400 text-sm">Total Amount</span>
                <span className="text-xl font-bold text-emerald-400">
                  ${totalCartPrice.toFixed(2)}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCartOpen(false)}
                  className="w-1/2 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all text-xs cursor-pointer"
                >
                  Continue Shopping
                </button>
                <button
                  disabled={cartItems.length === 0}
                  onClick={handleProceedToCheckout}
                  className="w-1/2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all text-xs cursor-pointer shadow-lg shadow-emerald-950/50"
                >
                  Proceed to Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}