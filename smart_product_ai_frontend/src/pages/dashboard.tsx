import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useCart } from "../store/cart";
import { useWishlist } from "../store/wishlist";

import Upload from "../features/upload/UploadDropzone";
import ProductCreateForm from "../components/products/ProductCreateForm";

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
  bounding_box?: any;
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
  const user = useAuth((state) => state.user) as {
    role?: string;
    is_verified?: boolean;
  } | null;

  const isVendor = user?.role?.toLowerCase() === "vendor";

  return (
    <header className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 border-b border-white/10 pb-8">
      <div className="shrink-0 text-center lg:text-left">
        <h1 className="text-3xl font-black text-emerald-400 tracking-tighter uppercase italic">
          Smart Product Marketplace
        </h1>

        <p className="text-slate-500 mt-1 text-[10px] font-bold uppercase tracking-widest">
          AI-Verified Inventory • Express Fulfillment (XAF)
        </p>
      </div>

      {!isVendor && (
        <div className="flex bg-slate-900 border border-white/10 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setActiveTab("marketplace")}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
              activeTab === "marketplace"
                ? "bg-emerald-500 text-slate-950 shadow-lg"
                : "text-slate-500 hover:text-white"
            }`}
          >
            Marketplace
          </button>

          <button
            onClick={() => setActiveTab("activity")}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
              activeTab === "activity"
                ? "bg-emerald-500 text-slate-950 shadow-lg"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Dashboard
          </button>
        </div>
      )}

      {!isVendor && activeTab === "marketplace" && (
        <div className="relative flex-1 max-w-md group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg z-10 group-focus-within:text-emerald-400 transition-colors">
            🔍
          </span>

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

        {user ? (
          <button
            onClick={() => useAuth.getState().logout()}
            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-xs font-black uppercase cursor-pointer transition-all"
          >
            Logout
          </button>
        ) : (
          <Link
            to="/login"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl text-xs font-black uppercase cursor-pointer transition-all shadow-lg shadow-indigo-900/40"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
};

// --- DASHBOARD ---

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [cartOpen, setCartOpen] = useState(false);
  const [marketplaceProducts, setMarketplaceProducts] = useState<ProduceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState<boolean>(true);

  // Toggle between AI and Manual creation for Vendors
  const [vendorCreationMode, setVendorCreationMode] = useState<"ai" | "manual">("ai");

  const [activeTab, setActiveTab] = useState<"marketplace" | "activity">(
    location.pathname.includes("wishlist") ||
      location.pathname.includes("activity")
      ? "activity"
      : "marketplace"
  );

  const [buyerOrders, setBuyerOrders] = useState<any[]>([]);

  const [notifications] = useState<string[]>([
    "Your recent Sandbox Checkout Order has been confirmed.",
    "Verify store updates: Gemini AI localized metrics analysis completed.",
    "Alert: Organic Fresh Apples are back in stock.",
  ]);

  const user = useAuth((state) => state.user) as {
    email?: string;
    role?: string;
    is_verified?: boolean;
  } | null;

  const token = useAuth((state) => state.token);

  const isVendor = user?.role?.toLowerCase() === "vendor";
  const isVerified = Boolean(user?.is_verified);

  const {
    items: cartItems,
    addToCart,
    updateQuantity,
    clearCart,
  } = useCart();

  const {
    items: wishlistItems,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
  } = useWishlist();

  const { data: stats } = useDashboard();

  const totalCartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  const totalCartPrice = useMemo(() => {
    return cartItems.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0
    );
  }, [cartItems]);

  // ---------------------------------------------------------
  // IMAGE CROPPING STYLE RESOLVER
  // ---------------------------------------------------------

  const getCroppedStyle = useCallback(
    (box: any): React.CSSProperties => {
      // Fallback for manual products (no bounding box)
      if (!box || Object.keys(box).length === 0) {
        return {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          position: "relative",
        };
      }

      // Determine if this represents a single-item / full-frame view
      const isSingleItem =
        (box as any).is_single_item === true ||
        (box as any).detection_type === "single" ||
        ("width" in box &&
          "height" in box &&
          Number(box.width) >= 0.98 &&
          Number(box.height) >= 0.98) ||
        ("xmax" in box &&
          "xmin" in box &&
          "ymax" in box &&
          "ymin" in box &&
          Number(box.xmax) - Number(box.xmin) >= 0.98 &&
          Number(box.ymax) - Number(box.ymin) >= 0.98) ||
        ("x" in box &&
          "y" in box &&
          Number(box.x) <= 0.05 &&
          Number(box.y) <= 0.05 &&
          Number(box.width) >= 0.9 &&
          Number(box.height) >= 0.9);

      if (isSingleItem) {
        return {
          width: "100%",
          height: "100%",
          objectFit: "contain",
          position: "relative",
        };
      }

      if (
        typeof box === "object" &&
        "width" in box &&
        "height" in box &&
        "x" in box &&
        "y" in box &&
        Number(box.width) > 0 &&
        Number(box.height) > 0
      ) {
        return {
          position: "absolute",
          maxWidth: "none",
          width: `${100 / Number(box.width)}%`,
          height: `${100 / Number(box.height)}%`,
          left: `-${(Number(box.x) / Number(box.width)) * 100}%`,
          top: `-${(Number(box.y) / Number(box.height)) * 100}%`,
        };
      }

      return {
        width: "100%",
        height: "100%",
        objectFit: "cover",
      };
    },
    []
  );

  // ---------------------------------------------------------
  // MAP API PRODUCT TO FRONTEND PRODUCT
  // ---------------------------------------------------------

  const mapRawToProduceItem = useCallback(
    (item: RawProduct, fallbackImage = ""): ProduceItem => {
      const activePrice = item.price ?? item.suggested_price ?? item.unit_price;
      const rawPrice = Number(activePrice);
      const parsedPrice = !isNaN(rawPrice) && rawPrice > 0 ? rawPrice : 1500.0;
      const finalUrl = item.image_url || item.imageUrl || fallbackImage || "";

      let boxes: BoundingBox[] = [];
      if (item.bounding_box) {
        const normalized = normalizeBoundingBox(item.bounding_box);
        if (normalized) boxes = [normalized];
      }

      return {
        id: String(item.id || `prod-${Math.random().toString(36).substring(2, 9)}`),
        name: String(item.name || item.brand || "AI-Verified Produce"),
        category: String(item.category || "Fresh Produce"),
        confidence_score: typeof item.confidence_score === "number" ? item.confidence_score : 0.95,
        imageUrl: finalUrl,
        price: parsedPrice,
        bounding_box: item.bounding_box,
        boundingBoxes: boxes,
        stock: item.stock_quantity ?? 50,
        vendor_id: item.vendor_id ? String(item.vendor_id) : undefined,
      };
    },
    []
  );

  // ---------------------------------------------------------
  // LOAD PRODUCTS
  // ---------------------------------------------------------

  const refreshProductsData = useCallback(async () => {
    try {
      setLoading(true);
      // Removed { approved: true } restriction to allow unapproved products 
      // to display on the marketplace immediately.
      const data = await getProducts({});
      const rawProducts: RawProduct[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.items)
        ? (data as any).items
        : [];

      const mapped: ProduceItem[] = rawProducts.map((item) =>
        mapRawToProduceItem(item)
      );

      setMarketplaceProducts(mapped);

      if (!isVendor && user && token) {
        try {
          const ordersRes = await getBuyerOrders();
          setBuyerOrders(ordersRes || []);
        } catch (orderErr) {
          console.error("Non-critical: Order fetching failed.", orderErr);
        }
      }
    } catch (error) {
      console.error("Marketplace Sync Error:", error);
    } finally {
      setLoading(false);
    }
  }, [mapRawToProduceItem, isVendor, user, token]);

  useEffect(() => {
    refreshProductsData();
  }, [refreshProductsData]);

  // ---------------------------------------------------------
  // REFRESH AFTER PRODUCT SAVE
  // ---------------------------------------------------------

  useEffect(() => {
    window.addEventListener("products:updated", refreshProductsData);
    return () => window.removeEventListener("products:updated", refreshProductsData);
  }, [refreshProductsData]);

  // ---------------------------------------------------------
  // CART & WISHLIST HANDLERS
  // ---------------------------------------------------------

  const handleAddToCart = useCallback(
    (product: ProduceItem) => {
      if (!user) {
        navigate("/login");
        return;
      }

      addToCart({
        id: product.id,
        name: product.name,
        price: product.price ?? 1500.0,
        category: product.category ?? "Fresh Produce",
        icon: "🥦",
        vendor_id: product.vendor_id,
      });
    },
    [addToCart, user, navigate]
  );

  const handleToggleWishlist = (product: ProduceItem) => {
    if (!user) {
      navigate("/login");
      return;
    }

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

  // ---------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return marketplaceProducts;
    }

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

  // ---------------------------------------------------------
  // VENDOR VERIFICATION
  // ---------------------------------------------------------

  if (isVendor && !isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white p-6 sm:p-10 flex flex-col justify-center items-center">
        <div className="max-w-md w-full bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center text-3xl mx-auto">
            ⏳
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Account Pending Approval
            </h1>

            <p className="text-xs text-slate-400 leading-relaxed">
              Your vendor registration is currently being verified by
              our platform administrators.
            </p>
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

  // ---------------------------------------------------------
  // MAIN RETURN
  // ---------------------------------------------------------

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
            {/* STATS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider font-mono">
                  Sales Revenue
                </span>
                <h3 className="text-3xl font-black text-emerald-400 mt-2">
                  {Math.round(stats?.revenue ?? 0).toLocaleString()} FCFA
                </h3>
              </div>

              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider font-mono">
                  New Orders
                </span>
                <h3 className="text-3xl font-black text-amber-400 mt-2">
                  {stats?.new_orders ?? 0}
                </h3>
              </div>

              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider font-mono">
                  Pending Fulfillment
                </span>
                <h3 className="text-3xl font-black text-indigo-400 mt-2">
                  {stats?.pending_orders ?? 0}
                </h3>
              </div>

              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider font-mono">
                  AI Accuracy
                </span>
                <h3 className="text-3xl font-black text-cyan-400 mt-2">
                  {((stats?.accuracy ?? 0.96) * 100).toFixed(1)}%
                </h3>
              </div>
            </div>

            {/* PRODUCT MANAGEMENT HUB */}
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/10 pb-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <span>📦</span> Product Management
                    </h2>
                    <p className="text-[11px] text-slate-500 uppercase font-black tracking-widest">
                      Choose creation workflow
                    </p>
                  </div>

                  <div className="flex bg-slate-950 p-1 rounded-2xl border border-white/5 self-start">
                    <button
                      onClick={() => setVendorCreationMode("ai")}
                      className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
                        vendorCreationMode === "ai" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40" : "text-slate-500 hover:text-white"
                      }`}
                    >
                      AI Assistant
                    </button>
                    <button
                      onClick={() => setVendorCreationMode("manual")}
                      className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
                        vendorCreationMode === "manual" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40" : "text-slate-500 hover:text-white"
                      }`}
                    >
                      Manual Entry
                    </button>
                  </div>
                </div>

                {vendorCreationMode === "ai" ? (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl text-[11px] text-indigo-300 leading-relaxed">
                      <strong>✨ AI Assistant:</strong> Upload a physical shelf image. Gemini will automatically detect items, estimate pricing, and extract attributes.
                    </div>
                    <Upload />
                  </div>
                ) : (
                  <div className="animate-in fade-in zoom-in-95 duration-300">
                    <ProductCreateForm 
                      onSuccess={() => {
                        setVendorCreationMode("ai");
                        refreshProductsData();
                      }}
                      onCancel={() => setVendorCreationMode("ai")}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h2 className="text-2xl font-bold text-white">My Store Inventory</h2>
                <Link to="/review" className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline">
                  View Full Catalog History →
                </Link>
              </div>
              
              {marketplaceProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-2xl">
                  Inventory ledger empty. List products above.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {marketplaceProducts.map((p) => (
                    <div key={p.id} className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
                      <div className="relative h-44 w-full overflow-hidden bg-slate-950 rounded-2xl border border-white/5 flex items-center justify-center">
                        <img
                          src={formatImageUrl(p.imageUrl || (p as any).image_url)}
                          alt={p.name}
                          className={!p.bounding_box ? "w-full h-full object-cover relative transition-all duration-300" : "max-w-none absolute transition-all duration-300"}
                          style={getCroppedStyle(p.bounding_box)}
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      </div>
                      <div className="p-4">
                        <h4 className="font-bold text-sm truncate text-white">{p.name}</h4>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                          <span>Qty: <strong className="text-slate-200">{p.stock ?? 10} units</strong></span>
                          <span className="text-emerald-400 font-bold">{Math.round(p.price ?? 0).toLocaleString()} FCFA</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        ) : activeTab === "marketplace" ? (
          /* BUYER MARKETPLACE VIEW */
          <main className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Available Produce</h2>
                  <p className="text-slate-400 text-xs mt-1">Fresh offerings from verified vendors (FCFA)</p>
                </div>
                <button
                  onClick={() => setActiveTab("activity")}
                  className="text-emerald-400 hover:text-emerald-300 text-xs font-bold underline transition-colors cursor-pointer"
                >
                  View Activity →
                </button>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4 animate-pulse">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-64 bg-white/5 rounded-2xl" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">No products found.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {filteredProducts.map((prod) => (
                    <div key={prod.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-3 relative group transition-all hover:bg-white/[0.07]">
                      <button
                        onClick={() => handleToggleWishlist(prod)}
                        className="absolute top-7 right-7 z-30 p-1.5 rounded-full bg-slate-950/80 border border-white/10 text-sm cursor-pointer"
                      >
                        {isInWishlist(prod.id) ? "⭐" : "☆"}
                      </button>
                      <div className="relative h-44 w-full overflow-hidden bg-slate-950 rounded-2xl flex items-center justify-center">
                        <img
                          src={formatImageUrl(prod.imageUrl || (prod as any).image_url)}
                          alt={prod.name}
                          className={!prod.bounding_box ? "w-full h-full object-cover relative transition-all duration-300" : "max-w-none absolute transition-all duration-300"}
                          style={getCroppedStyle(prod.bounding_box)}
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black text-emerald-400 border border-emerald-500/20">
                          ✨ AI VERIFIED
                        </div>
                      </div>
                      <h3 className="font-bold text-lg text-white truncate mt-3">{prod.name}</h3>
                      <div className="flex justify-between items-center">
                        <p className="text-base font-bold text-emerald-400">{Math.round(prod.price ?? 1500).toLocaleString()} FCFA</p>
                        <span className="text-[10px] text-slate-500 font-medium">Stock: {prod.stock ?? 25} units</span>
                      </div>
                      <button
                        onClick={() => handleAddToCart(prod)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg"
                      >
                        Add to Cart
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        ) : (
          /* ACTIVITY / USER DASHBOARD VIEW */
          <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-200">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl lg:col-span-2 space-y-6">
              <h3 className="text-xl font-bold text-white">Recent Orders</h3>
              {!user ? (
                <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-2xl space-y-4">
                  <p>Please sign in to view your activity.</p>
                  <Link to="/login" className="inline-block bg-indigo-600 px-4 py-2 rounded-xl font-black uppercase text-white">Sign In</Link>
                </div>
              ) : buyerOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-2xl">No orders found.</div>
              ) : (
                <div className="space-y-4">
                  {buyerOrders.map((ord) => (
                    <div key={ord.id} className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-white">Order {ord.id.substring(0, 8)}</p>
                        <p className="text-[10px] text-slate-400">{ord.date}</p>
                      </div>
                      <span className="font-mono text-emerald-400 font-bold">{Math.round(ord.total_price).toLocaleString()} FCFA</span>
                      <span className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded text-[9px] uppercase font-bold">{ord.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-3">
                <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">Profile</h3>
                {user ? (
                  <div className="text-xs space-y-1">
                    <p className="text-slate-500">Email: <strong className="text-slate-300">{user.email}</strong></p>
                    <p className="text-slate-500">Role: <span className="text-indigo-400 uppercase font-bold">{user.role}</span></p>
                  </div>
                ) : <p className="text-[11px] text-slate-500">Guest mode</p>}
              </div>

              <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-3">
                <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">Wishlist</h3>
                {!user ? (
                  <p className="text-[11px] text-slate-500 text-center">Login to save items.</p>
                ) : wishlistItems.length === 0 ? (
                  <p className="text-[11px] text-slate-500 text-center">Empty.</p>
                ) : (
                  <div className="space-y-3">
                    {wishlistItems.map((fav) => (
                      <div key={fav.id} className="flex justify-between items-center bg-slate-900/40 p-2 rounded-xl border border-white/5">
                        <span className="text-white text-[11px] font-semibold truncate max-w-[100px]">{fav.name}</span>
                        <div className="flex gap-2">
                          <button onClick={() => handleAddToCart(fav)} className="bg-emerald-600 px-2 py-1 rounded text-[9px] font-bold">Buy</button>
                          <button onClick={() => removeFromWishlist(fav.id)} className="text-slate-500 text-[9px]">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </main>
        )}
      </div>

      {/* SHOPPING CART DRAWER (PRESERVED) */}
      {cartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50 transition-opacity">
          <div className="bg-slate-900 border-l border-white/10 w-full max-w-md p-6 h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">Your Cart ({totalCartCount})</h3>
                  {cartItems.length > 0 && (
                    <button onClick={clearCart} className="text-[10px] text-slate-400 hover:text-red-400 underline transition-colors">Clear all</button>
                  )}
                </div>
                <button onClick={() => setCartOpen(false)} className="text-slate-400 hover:text-white font-bold text-xl cursor-pointer">✕</button>
              </div>

              {cartItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">Your cart is currently empty.</div>
              ) : (
                <ul className="mt-4 space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                  {cartItems.map((item) => (
                    <li key={item.id} className="bg-white/5 p-3.5 rounded-xl text-sm flex justify-between items-center border border-white/5">
                      <div>
                        <p className="font-semibold text-white truncate max-w-[180px]">{item.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{Math.round(item.price).toLocaleString()} FCFA</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 bg-white/10 hover:bg-white/20 text-white rounded-md flex items-center justify-center font-bold text-xs">-</button>
                        <span className="text-white font-mono font-bold text-xs px-1">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 bg-white/10 hover:bg-white/20 text-white rounded-md flex items-center justify-center font-bold text-xs">+</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-white/10 pt-4 space-y-4">
              <div className="flex justify-between items-center text-white">
                <span className="text-slate-400 text-sm">Total Amount</span>
                <span className="text-xl font-bold text-emerald-400">{Math.round(totalCartPrice).toLocaleString()} FCFA</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setCartOpen(false)} className="w-1/2 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all text-xs cursor-pointer">Continue Shopping</button>
                <button 
                  disabled={cartItems.length === 0} 
                  onClick={handleProceedToCheckout} 
                  className="w-1/2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-xs cursor-pointer shadow-lg shadow-emerald-950/50"
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