import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useCart } from "../store/cart";
import { useWishlist } from "../store/wishlist";

import Upload from "../features/upload/UploadDropzone";
import ProductCreateForm from "../components/products/ProductCreateForm";
import ApiKeyManager from "../components/developer/ApiKeyManager";

import { formatImageUrl } from "../api/imageUtils";
import { getProducts } from "../api/products";
import { useDashboard } from "../hooks/useDashboard";
import { getBuyerOrders } from "../api/orders";
import VendorOrders from "../components/vendor/VendorOrders";

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
  crop_url?: string;
  cropped_image_url?: string;
  price?: number | string;
  suggested_price?: number | string;
  unit_price?: number | string;
  bounding_box?: any;
  bounding_boxes?: BoundingBox[];
  boundingBoxes?: BoundingBox[];
  stock_quantity?: number;
  vendor_id?: string;
  approved?: boolean;
}

export interface ProduceItem {
  id: string;
  name: string;
  category?: string;
  confidence_score?: number;
  imageUrl?: string;
  crop_url?: string;
  price?: number;
  bounding_box?: any;
  boundingBoxes?: BoundingBox[];
  stock?: number;
  vendor_id?: string;
  approved?: boolean;
}

export interface CartItem extends ProduceItem {
  quantity: number;
}

export interface DashboardProps {
  viewMode?: "buyer" | "vendor";
  initialVendorSection?: "overview" | "upload" | "catalog" | "orders" | "developer";
}

export const MARKETPLACE_CATEGORIES = [
  { id: "all", label: "All Categories", icon: "🌐" },
  { id: "Electronics", label: "Electronics", icon: "📱" },
  { id: "Fashion", label: "Fashion", icon: "👗" },
  { id: "Beauty", label: "Beauty", icon: "💄" },
  { id: "Home & Living", label: "Home & Living", icon: "🛋️" },
  { id: "Accessories", label: "Accessories", icon: "🎒" },
] as const;

interface MarketplaceHeaderProps {
  setCartOpen: (open: boolean) => void;
  totalCartCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeTab: "marketplace" | "activity";
  setActiveTab: (tab: "marketplace" | "activity") => void;
  isVendorView: boolean;
  selectedCategory?: string;
  setSelectedCategory?: (category: string) => void;
}

// --- HEADER COMPONENT ---

export const MarketplaceHeader: React.FC<MarketplaceHeaderProps> = ({
  setCartOpen,
  totalCartCount,
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  isVendorView,
  selectedCategory,
  setSelectedCategory,
}) => {
  const user = useAuth((state) => state.user) as {
    email?: string;
    role?: string;
    is_verified?: boolean;
  } | null;

  const rawRole = String(user?.role || "").trim().toLowerCase();
  const isVendorUser = rawRole === "vendor";
  const isAdminUser = rawRole === "admin" || rawRole === "superadmin";

  // Dedicated Vendor Dashboard Header
  if (isVendorView) {
    return (
      <header className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 border-b border-white/10 pb-8">
        <div className="shrink-0 text-center lg:text-left">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-indigo-400 tracking-tighter uppercase italic">
              Vendor Store Hub
            </h1>

            <span className="bg-indigo-500/15 text-indigo-400 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-indigo-500/20">
              Live Inventory
            </span>
          </div>

          <p className="text-slate-500 mt-1 text-[10px] font-bold uppercase tracking-widest font-mono">
            AI Automated Product Catalog • Express Fulfillment
          </p>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {user && (
            <button
              onClick={() => useAuth.getState().logout()}
              className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-xs font-black uppercase cursor-pointer transition-all"
            >
              Sign Out
            </button>
          )}
        </div>
      </header>
    );
  }

  // Public Buyer Marketplace Header (Route: /)
  return (
    <header className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 border-b border-white/10 pb-8">
      <div className="w-full min-w-0 text-center lg:w-auto lg:text-left">
        <div className="flex items-center justify-center lg:justify-start gap-2.5">
          <span className="text-2xl">⚡</span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tighter uppercase italic leading-tight">
            SmartProduct<span className="text-brand">.AI</span>
          </h1>
          <span className="hidden sm:inline-block bg-brand text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm">
            GLOBAL
          </span>
        </div>

        <p className="text-slate-400 mt-1 text-[10px] font-bold uppercase tracking-widest font-mono">
          AI-Verified Marketplace & Sourcing • Express Regional (FCFA)
        </p>
      </div>

      <div className="flex bg-slate-900 border border-white/10 p-1 rounded-xl shrink-0 self-center lg:self-auto">
        <button
          onClick={() => setActiveTab("marketplace")}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
            activeTab === "marketplace"
              ? "bg-brand text-white shadow-lg shadow-orange-950/40 font-bold"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Catalog & Deals
        </button>

        <button
          onClick={() => setActiveTab("activity")}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
            activeTab === "activity"
              ? "bg-brand text-white shadow-lg shadow-orange-950/40 font-bold"
              : "text-slate-400 hover:text-white"
          }`}
        >
          My Orders
        </button>
      </div>

      {activeTab === "marketplace" && (
        <div className="relative w-full max-w-md group lg:w-auto lg:flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg z-10 group-focus-within:text-brand transition-colors">
            🔍
          </span>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search catalog (Electronics, Apparel, Tools...)"
            className="w-full bg-slate-950 border-2 border-white/15 rounded-2xl pl-12 pr-10 py-3 text-sm text-white font-bold placeholder-slate-600 focus:outline-none focus:border-brand transition-all shadow-2xl"
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

      <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-3 lg:ml-auto lg:w-auto lg:justify-end">
        {selectedCategory && setSelectedCategory && (
          <a
            href="#categories"
            className="w-full justify-center bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-brand border border-white/10 px-2 py-3 rounded-xl text-[10px] sm:w-auto sm:px-4 sm:text-xs font-black uppercase transition-all flex items-center gap-1.5 shadow-sm"
          >
            <span>🏷️</span>
            <span>Categories</span>
          </a>
        )}

        {isVendorUser && (
          <Link
            to="/vendor/dashboard"
            className="w-full justify-center bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 px-2 py-3 rounded-xl text-[10px] sm:w-auto sm:px-4 sm:text-xs font-black uppercase transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <span>🏪</span>
            <span>Vendor Dashboard</span>
          </Link>
        )}

        {isAdminUser && (
          <Link
            to="/admin"
            className="w-full justify-center bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/30 px-2 py-3 rounded-xl text-[10px] sm:w-auto sm:px-4 sm:text-xs font-black uppercase transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <span>🛡️</span>
            <span>Admin Panel</span>
          </Link>
        )}

        <Link
          to="/buyer/orders"
          className="w-full justify-center bg-slate-900 hover:bg-slate-800 text-white border border-white/10 px-2 py-3 rounded-xl text-[10px] sm:w-auto sm:px-4 sm:text-xs font-black uppercase transition-all flex items-center gap-2 shadow-sm"
        >
          <span>📦</span>
          <span>Track Orders</span>
        </Link>

        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="w-full justify-center bg-brand hover:bg-brand-hover text-white px-2 py-3 rounded-xl font-black uppercase flex items-center gap-2 sm:w-auto sm:gap-3 sm:px-5 transition-all shadow-xl shadow-orange-950/40 cursor-pointer text-[10px] sm:text-xs"
        >
          <span>🛒 Cart</span>

          <span className="bg-white text-slate-950 text-xs font-black px-2 py-0.5 rounded-full">
            {totalCartCount}
          </span>
        </button>

        {user ? (
          <button
            onClick={() => useAuth.getState().logout()}
            className="w-full justify-center bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-2 py-3 rounded-xl text-[10px] sm:w-auto sm:px-4 sm:text-xs font-black uppercase cursor-pointer transition-all"
          >
            Logout
          </button>
        ) : (
          <Link
            to="/login"
            className="w-full justify-center bg-brand hover:bg-brand-hover text-white px-2 py-3 rounded-xl text-[10px] sm:w-auto sm:px-6 sm:text-xs font-black uppercase cursor-pointer transition-all shadow-lg shadow-orange-900/40"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
};

// --- DASHBOARD COMPONENT ---

export default function Dashboard({ viewMode, initialVendorSection = "overview" }: DashboardProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [cartOpen, setCartOpen] = useState(false);
  const [marketplaceProducts, setMarketplaceProducts] = useState<
    ProduceItem[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);

  // Toggle between AI and Manual creation for Vendors
  const [vendorCreationMode, setVendorCreationMode] = useState<
    "ai" | "manual"
  >("ai");

  // Vendor dashboard sections
  const [vendorActiveSection, setVendorActiveSection] = useState<
    "overview" | "upload" | "catalog" | "orders" | "developer"
  >(initialVendorSection);

  const vendorSectionPaths = {
    overview: "/vendor/dashboard",
    upload: "/vendor/upload",
    catalog: "/vendor/products",
    orders: "/vendor/orders",
    developer: "/vendor/apiKeys",
  } as const;

  const [activeTab, setActiveTab] = useState<"marketplace" | "activity">(
    location.pathname.includes("wishlist") ||
      location.pathname.includes("profile") ||
      location.pathname.includes("activity")
      ? "activity"
      : "marketplace"
  );

  const [buyerOrders, setBuyerOrders] = useState<any[]>([]);

  const user = useAuth((state) => state.user) as {
    id?: string;
    email?: string;
    role?: string;
    is_verified?: boolean;
  } | null;

  const token = useAuth((state) => state.token);

  const rawRole = String(user?.role || "").trim().toLowerCase();

  const isVendorRole =
    rawRole === "vendor" ||
    rawRole === "admin" ||
    rawRole === "superadmin";

  // Strict architectural separation between Buyer Marketplace (/) and Vendor Dashboard (/dashboard):
  // - If viewMode is explicitly "buyer" or path is exactly "/", it is ALWAYS Buyer Marketplace.
  // - If viewMode is explicitly "vendor" or path is under "/vendor", it renders Vendor Dashboard.
  const isVendorView =
    viewMode === "vendor" ||
    (viewMode !== "buyer" &&
      location.pathname.startsWith("/vendor/") &&
      isVendorRole);

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

  useEffect(() => {
    if (location.pathname === "/buyer/cart") {
      setCartOpen(true);
    }
  }, [location.pathname]);

  // ---------------------------------------------------------
  // MAP API PRODUCT TO FRONTEND PRODUCT
  // ---------------------------------------------------------

  const mapRawToProduceItem = useCallback(
    (item: RawProduct, fallbackImage = ""): ProduceItem => {
      const activePrice =
        item.price ?? item.suggested_price ?? item.unit_price;

      const rawPrice = Number(activePrice);

      const parsedPrice =
        !isNaN(rawPrice) && rawPrice > 0 ? rawPrice : 1500.0;

      const finalUrl =
        item.crop_url ||
        item.cropped_image_url ||
        item.image_url ||
        item.imageUrl ||
        fallbackImage ||
        "";

      return {
        id: String(
          item.id ||
            `prod-${Math.random().toString(36).substring(2, 9)}`
        ),
        name: String(
          item.name || item.brand || "AI-Verified Produce"
        ),
        category: String(item.category || "Fresh Produce"),
        confidence_score:
          typeof item.confidence_score === "number"
            ? item.confidence_score
            : 0.95,
        imageUrl: finalUrl,
        price: parsedPrice,
        bounding_box: item.bounding_box,
        boundingBoxes: item.boundingBoxes || item.bounding_boxes,
        stock: item.stock_quantity ?? 50,
        vendor_id: item.vendor_id
          ? String(item.vendor_id)
          : undefined,
        approved: item.approved ?? true,
        crop_url: item.crop_url || item.cropped_image_url || undefined,
      };
    },
    []
  );

  // ---------------------------------------------------------
  // LOAD PRODUCTS (CANONICAL BACKEND DATA)
  // ---------------------------------------------------------

  const refreshProductsData = useCallback(async () => {
    try {
      setLoading(true);

      const data = await getProducts({ approved: true });

      const rawProducts: RawProduct[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.items)
        ? (data as any).items
        : [];

      const mapped: ProduceItem[] = rawProducts.map((item) =>
        mapRawToProduceItem(item)
      );

      setMarketplaceProducts(mapped);

      if (!isVendorView && user && token) {
        try {
          const ordersRes = await getBuyerOrders();
          setBuyerOrders(ordersRes || []);
        } catch (orderErr) {
          console.error(
            "Non-critical: Order fetching failed.",
            orderErr
          );
        }
      }
    } catch (error) {
      console.error("Marketplace Sync Error:", error);
    } finally {
      setLoading(false);
    }
  }, [mapRawToProduceItem, isVendorView, user, token]);

  useEffect(() => {
    refreshProductsData();
  }, [refreshProductsData]);

  // ---------------------------------------------------------
  // REFRESH AFTER PRODUCT CREATION OR UPDATE
  // ---------------------------------------------------------

  useEffect(() => {
    window.addEventListener("products:updated", refreshProductsData);

    return () =>
      window.removeEventListener(
        "products:updated",
        refreshProductsData
      );
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
    navigate("/buyer/checkout");
  };

  // ---------------------------------------------------------
  // SEARCH & INVENTORY FILTERING
  // ---------------------------------------------------------

  const filteredProducts = useMemo(() => {
    let prods = marketplaceProducts;

    if (selectedCategory !== "all") {
      const catLower = selectedCategory.toLowerCase();
      prods = prods.filter((prod) => {
        const itemCat = (prod.category || "").toLowerCase();
        if (catLower === "home & living") {
          return itemCat.includes("home") || itemCat.includes("living");
        }
        return itemCat.includes(catLower);
      });
    }

    if (!searchQuery.trim()) {
      return prods;
    }

    const query = searchQuery.toLowerCase();

    return prods.filter(
      (prod) =>
        prod.name.toLowerCase().includes(query) ||
        prod.category?.toLowerCase().includes(query)
    );
  }, [marketplaceProducts, selectedCategory, searchQuery]);

  const featuredProducts = useMemo(() => {
    return [...marketplaceProducts]
      .sort((a, b) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0))
      .slice(0, 4);
  }, [marketplaceProducts]);

  const newArrivals = useMemo(() => {
    return [...marketplaceProducts].slice(-4).reverse();
  }, [marketplaceProducts]);

  // Vendor inventory specifically for the vendor's dashboard view
  const vendorInventoryProducts = useMemo(() => {
    if (!user?.id) return marketplaceProducts;

    return marketplaceProducts.filter(
      (p) =>
        !p.vendor_id ||
        String(p.vendor_id) === String(user.id)
    );
  }, [marketplaceProducts, user?.id]);

  // ---------------------------------------------------------
  // VENDOR VERIFICATION SCREEN (ONLY ON /dashboard)
  // ---------------------------------------------------------

  if (isVendorView && rawRole === "vendor" && !isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white p-6 sm:p-10 flex flex-col justify-center items-center">
        <div className="max-w-md w-full bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center text-3xl mx-auto">
            ⏳
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Vendor Verification Pending
            </h1>

            <p className="text-xs text-slate-400 leading-relaxed">
              Your vendor registration is currently being verified
              by our platform administrators. You can still browse
              the public Buyer Marketplace.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => useAuth.getState().logout()}
              className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-bold text-xs py-3 rounded-xl transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
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
          isVendorView={isVendorView}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />

        {isVendorView ? (
          /* =========================================================
             VIEW A: VENDOR DASHBOARD (Route: /dashboard)
             ========================================================= */
          <main className="space-y-8 animate-in fade-in duration-200">
            {/* VENDOR DASHBOARD NAVIGATION */}
            <nav className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-2 shadow-2xl">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {[
                  {
                    id: "overview" as const,
                    label: "Overview",
                    icon: "📊",
                  },
                  {
                    id: "upload" as const,
                    label: "Upload & Analyze",
                    icon: "✨",
                  },
                  {
                    id: "catalog" as const,
                    label: "Product Catalog",
                    icon: "📦",
                  },
                  {
                    id: "orders" as const,
                    label: "Track Orders",
                    icon: "🚚",
                  },
                  {
                    id: "developer" as const,
                    label: "Developer & API Keys",
                    icon: "🔑",
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setVendorActiveSection(item.id);
                      navigate(vendorSectionPaths[item.id]);
                    }}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wide transition-all cursor-pointer ${
                      vendorActiveSection === item.id
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </nav>

            {/* =====================================================
                VENDOR OVERVIEW
                ===================================================== */}

            {vendorActiveSection === "overview" && (
              <section className="space-y-8 animate-in fade-in duration-200">
                {/* STATS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider font-mono">
                      Sales Revenue
                    </span>

                    <h3 className="text-3xl font-black text-emerald-400 mt-2">
                      {Math.round(
                        stats?.revenue ?? 0
                      ).toLocaleString()}{" "}
                      FCFA
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
                      {(
                        (stats?.accuracy ?? 0.96) *
                        100
                      ).toFixed(1)}
                      %
                    </h3>
                  </div>
                </div>

                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">
                      Vendor Overview
                    </h2>

                    <p className="text-sm text-slate-400">
                      Manage your store directly from this
                      dashboard. Use the navigation above to upload
                      products, manage your catalog, track customer
                      orders, or configure your developer API access.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setVendorActiveSection("upload");
                        navigate(vendorSectionPaths.upload);
                      }}
                      className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/15 text-left transition-all cursor-pointer"
                    >
                      <span className="text-2xl">✨</span>

                      <h3 className="font-bold text-white mt-3">
                        Upload & Analyze
                      </h3>

                      <p className="text-[11px] text-slate-500 mt-1">
                        Create products with AI or manually.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setVendorActiveSection("catalog");
                        navigate(vendorSectionPaths.catalog);
                      }}
                      className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 text-left transition-all cursor-pointer"
                    >
                      <span className="text-2xl">📦</span>

                      <h3 className="font-bold text-white mt-3">
                        Product Catalog
                      </h3>

                      <p className="text-[11px] text-slate-500 mt-1">
                        View and manage your live inventory.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setVendorActiveSection("orders");
                        navigate(vendorSectionPaths.orders);
                      }}
                      className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 text-left transition-all cursor-pointer"
                    >
                      <span className="text-2xl">🚚</span>

                      <h3 className="font-bold text-white mt-3">
                        Track Orders
                      </h3>

                      <p className="text-[11px] text-slate-500 mt-1">
                        Monitor and manage customer orders.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setVendorActiveSection("developer");
                        navigate(vendorSectionPaths.developer);
                      }}
                      className="p-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/15 text-left transition-all cursor-pointer"
                    >
                      <span className="text-2xl">🔑</span>

                      <h3 className="font-bold text-white mt-3">
                        Developer & API Keys
                      </h3>

                      <p className="text-[11px] text-slate-500 mt-1">
                        Manage API access, usage limits and
                        integrations.
                      </p>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* =====================================================
                VENDOR UPLOAD
                ===================================================== */}

            {vendorActiveSection === "upload" && (
              <section className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/10 pb-4">
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>📦</span>
                        Upload & Analyze
                      </h2>

                      <p className="text-[11px] text-slate-500 uppercase font-black tracking-widest">
                        Create products with AI analysis or manual
                        entry
                      </p>
                    </div>

                    <div className="flex bg-slate-950 p-1 rounded-2xl border border-white/5 self-start">
                      <button
                        type="button"
                        onClick={() =>
                          setVendorCreationMode("ai")
                        }
                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
                          vendorCreationMode === "ai"
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40"
                            : "text-slate-500 hover:text-white"
                        }`}
                      >
                        AI Assistant
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setVendorCreationMode("manual")
                        }
                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
                          vendorCreationMode === "manual"
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40"
                            : "text-slate-500 hover:text-white"
                        }`}
                      >
                        Manual Entry
                      </button>
                    </div>
                  </div>

                  {vendorCreationMode === "ai" ? (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                      <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl text-[11px] text-indigo-300 leading-relaxed">
                        <strong>✨ AI Assistant:</strong> Upload a
                        physical shelf image. Gemini will automatically
                        detect items, estimate pricing, and extract
                        attributes. Newly created products go live
                        instantly.
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
                        onCancel={() =>
                          setVendorCreationMode("ai")
                        }
                      />
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* =====================================================
                VENDOR CATALOG
                ===================================================== */}

            {vendorActiveSection === "catalog" && (
              <section className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6 animate-in fade-in duration-200">
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      My Store Inventory
                    </h2>

                    <p className="text-xs text-slate-400 mt-1">
                      Live products belonging to your vendor store.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={refreshProductsData}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
                  >
                    Refresh Catalog ↻
                  </button>
                </div>

                {vendorInventoryProducts.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-2xl">
                    Inventory is empty. Use Upload & Analyze to list
                    products.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {vendorInventoryProducts.map((p) => (
                      <div
                        key={p.id}
                        className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden hover:border-white/20 transition-all"
                      >
                        <div className="relative h-44 w-full overflow-hidden bg-slate-950 rounded-2xl border border-white/5 flex items-center justify-center">
                          <img
                            src={formatImageUrl(
                              p.crop_url ||
                                p.imageUrl ||
                                (p as any).image_url
                            )}
                            alt={p.name}
                            className="h-full w-full object-contain"
                            onError={(e) =>
                              (e.currentTarget.style.display =
                                "none")
                            }
                          />

                          <div className="absolute top-2 right-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[9px] font-black uppercase px-2 py-0.5 rounded-md">
                            Live
                          </div>
                        </div>

                        <div className="p-4">
                          <h4 className="font-bold text-sm truncate text-white">
                            {p.name}
                          </h4>

                          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                            <span>
                              Qty:{" "}
                              <strong className="text-slate-200">
                                {p.stock ?? 10} units
                              </strong>
                            </span>

                            <span className="text-emerald-400 font-bold">
                              {Math.round(
                                p.price ?? 0
                              ).toLocaleString()}{" "}
                              FCFA
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* =====================================================
                VENDOR ORDERS
                ===================================================== */}

            {vendorActiveSection === "orders" && (
              <section className="animate-in fade-in duration-200">
                <VendorOrders />
              </section>
            )}

            {/* =====================================================
                VENDOR DEVELOPER / API KEYS
                ===================================================== */}

            {vendorActiveSection === "developer" && (
              <section className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/10 pb-6 mb-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-xl">
                          🔑
                        </div>

                        <div>
                          <h2 className="text-2xl font-bold text-white">
                            Developer & API Keys
                          </h2>

                          <p className="text-xs text-slate-400 mt-1">
                            Create and manage API access for your
                            vendor integrations.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] uppercase font-black tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-2 rounded-xl">
                      Developer Access
                    </div>
                  </div>

                  <ApiKeyManager />
                </div>
              </section>
            )}
          </main>
        ) : activeTab === "marketplace" ? (
          /* =========================================================
             VIEW B: PUBLIC BUYER MARKETPLACE (Route: /)
             ========================================================= */
          <main className="space-y-10 animate-in fade-in duration-200">
            {/* 1. HERO SECTION */}
            <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-8 sm:p-12 shadow-2xl">
              <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/10 blur-3xl pointer-events-none" />
              <div className="relative z-10 max-w-3xl space-y-4 sm:space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1 text-xs font-bold text-brand uppercase tracking-wider">
                  <span>⚡</span>
                  <span>Next-Gen Global Marketplace</span>
                </div>

                <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                  Source <span className="text-brand">AI-Verified</span> Global Products with Instant Confidence
                </h1>

                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                  Connect with verified suppliers, automate inventory cataloging with computer vision, and enjoy express regional fulfillment in FCFA with comprehensive Trade Assurance.
                </p>

                {/* Prominent Hero Search Bar */}
                <div className="pt-2">
                  <div className="flex flex-col sm:flex-row items-stretch gap-2 rounded-2xl border-2 border-white/15 bg-slate-950/90 p-1.5 focus-within:border-brand shadow-2xl transition-all">
                    <div className="flex flex-1 items-center px-3">
                      <span className="text-lg text-slate-400">🔍</span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search products by title, category, or specifications..."
                        className="w-full bg-transparent px-3 py-2.5 text-sm sm:text-base font-medium text-white placeholder-slate-500 focus:outline-none"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-white/10 rounded-md transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className="bg-brand hover:bg-brand-hover text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                    >
                      Search Catalog
                    </button>
                  </div>

                  {/* Trending Search Pills */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Trending:</span>
                    {["Electronics", "Fashion", "Beauty", "Home & Living", "Accessories"].map((trend) => (
                      <button
                        key={trend}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(trend);
                          setSearchQuery("");
                        }}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-brand/40 hover:text-brand hover:bg-brand/10 transition-all cursor-pointer"
                      >
                        {trend}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 2. PROMOTIONAL BANNER & SOURCING PILLARS */}
            <section className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-950/40 via-amber-950/20 to-slate-900 p-6 sm:p-8 shadow-xl">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-black uppercase text-white tracking-wider">
                        Special Offer
                      </span>
                      <span className="text-xs font-bold text-deal-gold">Flash Wholesale Deals</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-white">
                      Up to 35% Off AI-Verified Inventory • Bulk Deals & Factory Pricing
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300">
                      Take advantage of special seasonal trade deals across Electronics, Fashion, and Home essentials with 0% risk payment protection.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory("all");
                      const el = document.getElementById("catalog-grid");
                      el?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="shrink-0 rounded-xl bg-white px-5 py-3 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 hover:bg-slate-200 transition-all shadow-lg cursor-pointer"
                  >
                    Explore Deals →
                  </button>
                </div>
              </div>

              {/* Sourcing Trust Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl shrink-0">
                    🛡️
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">100% Trade Assurance</h4>
                    <p className="text-[11px] text-slate-400">Payment escrow & refund guarantee</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-xl shrink-0">
                    ⚡
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">AI Computer Vision</h4>
                    <p className="text-[11px] text-slate-400">Automated spec analysis & quality verification</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-xl shrink-0">
                    🚚
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Regional Express (FCFA)</h4>
                    <p className="text-[11px] text-slate-400">Fast doorstep fulfillment and live tracking</p>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. PRODUCT CATEGORIES */}
            <section id="categories" className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    <span>🏷️</span>
                    <span>Browse Product Categories</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Select a category to filter live marketplace inventory
                  </p>
                </div>
                {selectedCategory !== "all" && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("all")}
                    className="text-xs font-bold text-brand hover:underline cursor-pointer"
                  >
                    Reset to All Categories
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {MARKETPLACE_CATEGORIES.map((cat) => {
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex flex-col items-center text-center p-4 rounded-2xl border transition-all cursor-pointer ${
                        isActive
                          ? "bg-brand text-white border-brand shadow-lg shadow-orange-950/40"
                          : "bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06] hover:border-white/20"
                      }`}
                    >
                      <span className="text-2xl mb-1.5">{cat.icon}</span>
                      <span className="text-xs font-bold tracking-tight">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 4. FEATURED PRODUCTS */}
            {featuredProducts.length > 0 && (
              <section className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                      <span>🌟</span>
                      <span>Featured Products</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Top-ranked, verified products with highest AI inspection confidence
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {featuredProducts.map((prod) => (
                    <div
                      key={`feat-${prod.id}`}
                      className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-3 relative group transition-all hover:bg-white/[0.07] hover:border-brand/40 shadow-xl flex flex-col justify-between"
                    >
                      <button
                        onClick={() => handleToggleWishlist(prod)}
                        className="absolute top-7 right-7 z-30 p-1.5 rounded-full bg-slate-950/80 border border-white/10 text-sm cursor-pointer hover:bg-slate-900 transition-colors"
                      >
                        {isInWishlist(prod.id) ? "⭐" : "☆"}
                      </button>

                      <div className="relative h-44 w-full overflow-hidden bg-slate-950 rounded-2xl flex items-center justify-center">
                        <img
                          src={formatImageUrl(
                            prod.crop_url || prod.imageUrl || (prod as any).image_url
                          )}
                          alt={prod.name}
                          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                        <div className="absolute top-3 left-3 bg-brand/90 backdrop-blur-md px-2.5 py-0.5 rounded-md text-[9px] font-black text-white">
                          FEATURED
                        </div>
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black text-emerald-400 border border-emerald-500/20">
                          ✨ AI VERIFIED
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          {prod.category || "General"}
                        </span>
                        <h4 className="font-bold text-base text-white truncate">
                          {prod.name}
                        </h4>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <p className="text-base font-black text-brand">
                          {Math.round(prod.price ?? 1500).toLocaleString()} FCFA
                        </p>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Stock: {prod.stock ?? 25}
                        </span>
                      </div>

                      <button
                        onClick={() => handleAddToCart(prod)}
                        className="w-full bg-brand hover:bg-brand-hover text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md mt-2"
                      >
                        Add to Cart
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 5. NEW ARRIVALS */}
            {newArrivals.length > 0 && (
              <section className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                      <span>✨</span>
                      <span>New Arrivals</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Recently indexed catalog items fresh from verified merchants
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {newArrivals.map((prod) => (
                    <div
                      key={`new-${prod.id}`}
                      className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-3 relative group transition-all hover:bg-white/[0.07] hover:border-brand/40 shadow-xl flex flex-col justify-between"
                    >
                      <button
                        onClick={() => handleToggleWishlist(prod)}
                        className="absolute top-7 right-7 z-30 p-1.5 rounded-full bg-slate-950/80 border border-white/10 text-sm cursor-pointer hover:bg-slate-900 transition-colors"
                      >
                        {isInWishlist(prod.id) ? "⭐" : "☆"}
                      </button>

                      <div className="relative h-44 w-full overflow-hidden bg-slate-950 rounded-2xl flex items-center justify-center">
                        <img
                          src={formatImageUrl(
                            prod.crop_url || prod.imageUrl || (prod as any).image_url
                          )}
                          alt={prod.name}
                          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                        <div className="absolute top-3 left-3 bg-emerald-600/90 backdrop-blur-md px-2.5 py-0.5 rounded-md text-[9px] font-black text-white">
                          NEW
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          {prod.category || "General"}
                        </span>
                        <h4 className="font-bold text-base text-white truncate">
                          {prod.name}
                        </h4>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <p className="text-base font-black text-brand">
                          {Math.round(prod.price ?? 1500).toLocaleString()} FCFA
                        </p>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Stock: {prod.stock ?? 25}
                        </span>
                      </div>

                      <button
                        onClick={() => handleAddToCart(prod)}
                        className="w-full bg-brand hover:bg-brand-hover text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md mt-2"
                      >
                        Add to Cart
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 6. ALL / FILTERED PRODUCTS GRID */}
            <section id="catalog-grid" className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {selectedCategory === "all" ? "All Marketplace Catalog" : `${selectedCategory} Products`}
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    Verified offerings from authenticated vendors with live FCFA pricing
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab("activity")}
                  className="text-brand hover:underline text-xs font-bold transition-colors cursor-pointer"
                >
                  View My Orders →
                </button>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4 animate-pulse">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-64 bg-white/5 rounded-2xl" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <p className="text-slate-400 text-sm">
                    No products found matching your current filter.
                  </p>
                  {(selectedCategory !== "all" || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory("all");
                        setSearchQuery("");
                      }}
                      className="bg-brand hover:bg-brand-hover text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {filteredProducts.map((prod) => (
                    <div
                      key={prod.id}
                      className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-3 relative group transition-all hover:bg-white/[0.07] hover:border-brand/40 shadow-lg flex flex-col justify-between"
                    >
                      <button
                        onClick={() => handleToggleWishlist(prod)}
                        className="absolute top-7 right-7 z-30 p-1.5 rounded-full bg-slate-950/80 border border-white/10 text-sm cursor-pointer hover:bg-slate-900 transition-colors"
                      >
                        {isInWishlist(prod.id) ? "⭐" : "☆"}
                      </button>

                      <div className="relative h-44 w-full overflow-hidden bg-slate-950 rounded-2xl flex items-center justify-center">
                        <img
                          src={formatImageUrl(
                            prod.crop_url || prod.imageUrl || (prod as any).image_url
                          )}
                          alt={prod.name}
                          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black text-emerald-400 border border-emerald-500/20">
                          ✨ AI VERIFIED
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          {prod.category || "General"}
                        </span>
                        <h3 className="font-bold text-lg text-white truncate">
                          {prod.name}
                        </h3>
                      </div>

                      <div className="flex justify-between items-center">
                        <p className="text-base font-bold text-brand">
                          {Math.round(prod.price ?? 1500).toLocaleString()} FCFA
                        </p>

                        <span className="text-[10px] text-slate-500 font-medium">
                          Stock: {prod.stock ?? 25} units
                        </span>
                      </div>

                      <button
                        onClick={() => handleAddToCart(prod)}
                        className="w-full bg-brand hover:bg-brand-hover text-white py-3 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg"
                      >
                        Add to Cart
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>
        ) : (
          /* =========================================================
             VIEW C: ACTIVITY / BUYER ORDERS VIEW
             ========================================================= */
          <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-200">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl lg:col-span-2 space-y-6">
              <h3 className="text-xl font-bold text-white">
                Recent Orders
              </h3>

              {!user ? (
                <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-2xl space-y-4">
                  <p>
                    Please sign in to view your orders and activity.
                  </p>

                  <Link
                    to="/login"
                    className="inline-block bg-indigo-600 px-4 py-2 rounded-xl font-black uppercase text-white"
                  >
                    Sign In
                  </Link>
                </div>
              ) : buyerOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-2xl">
                  No orders found.
                </div>
              ) : (
                <div className="space-y-4">
                  {buyerOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 flex justify-between items-center"
                    >
                      <div>
                        <p className="text-xs font-bold text-white">
                          Order {ord.id.substring(0, 8)}
                        </p>

                        <p className="text-[10px] text-slate-400">
                          {ord.date}
                        </p>
                      </div>

                      <span className="font-mono text-emerald-400 font-bold">
                        {Math.round(
                          ord.total_price
                        ).toLocaleString()}{" "}
                        FCFA
                      </span>

                      <span className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded text-[9px] uppercase font-bold">
                        {ord.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* PROFILE */}
              <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-3">
                <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">
                  Profile
                </h3>

                {user ? (
                  <div className="text-xs space-y-1">
                    <p className="text-slate-500">
                      Email:{" "}
                      <strong className="text-slate-300">
                        {user.email}
                      </strong>
                    </p>

                    <p className="text-slate-500">
                      Role:{" "}
                      <span className="text-indigo-400 uppercase font-bold">
                        {user.role}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Guest mode
                  </p>
                )}
              </div>

              {/* WISHLIST */}
              <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-3">
                <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">
                  Wishlist
                </h3>

                {!user ? (
                  <p className="text-[11px] text-slate-500 text-center">
                    Login to save items.
                  </p>
                ) : wishlistItems.length === 0 ? (
                  <p className="text-[11px] text-slate-500 text-center">
                    Empty.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {wishlistItems.map((fav) => (
                      <div
                        key={fav.id}
                        className="flex justify-between items-center bg-slate-900/40 p-2 rounded-xl border border-white/5"
                      >
                        <span className="text-white text-[11px] font-semibold truncate max-w-[100px]">
                          {fav.name}
                        </span>

                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleAddToCart(fav)
                            }
                            className="bg-emerald-600 px-2 py-1 rounded text-[9px] font-bold"
                          >
                            Buy
                          </button>

                          <button
                            onClick={() =>
                              removeFromWishlist(fav.id)
                            }
                            className="text-slate-500 text-[9px]"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* =================================================
                  BUYER API ACCESS & INTEGRATION
                  ================================================= */}

              {user && (
                <div className="bg-white/[0.03] border border-cyan-500/20 rounded-3xl p-6 space-y-5 shadow-xl">
                  <div className="flex items-start gap-3 border-b border-white/5 pb-4">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-lg">
                      🔑
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white">
                        API Access & Integration
                      </h3>

                      <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                        Access marketplace products and your order
                        data programmatically using read-only API
                        access.
                      </p>
                    </div>
                  </div>

                  <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-2xl p-3">
                    <p className="text-[10px] text-cyan-300 leading-relaxed">
                      <strong>Read-only access:</strong> Buyer API
                      credentials are intended for retrieving
                      products and order information. They cannot
                      trigger vendor AI Vision operations.
                    </p>
                  </div>

                  <ApiKeyManager />
                </div>
              )}
            </div>
          </main>
        )}

        {/* BUYER MARKETPLACE FOOTER */}
        {!isVendorView && (
          <footer className="mt-16 border-t border-white/10 pt-12 pb-8 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
              {/* Col 1: Platform Brand */}
              <div className="lg:col-span-1 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  <span className="text-xl font-black text-white uppercase tracking-tighter">
                    SmartProduct<span className="text-brand">.AI</span>
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The intelligent global e-commerce sourcing platform. Empowering merchants and buyers with AI computer vision cataloging and regional fulfillment in FCFA.
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Systems Operational</span>
                </div>
              </div>

              {/* Col 2: About Us */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-white">About Us</h4>
                <ul className="space-y-2 text-xs text-slate-400">
                  <li><a href="#about" className="hover:text-brand transition-colors">Our Vision & Mission</a></li>
                  <li><a href="#vision" className="hover:text-brand transition-colors">AI Vision Engine</a></li>
                  <li><a href="#suppliers" className="hover:text-brand transition-colors">Verified Supplier Network</a></li>
                  <li><a href="#careers" className="hover:text-brand transition-colors">Careers & Press</a></li>
                </ul>
              </div>

              {/* Col 3: Help Center */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-white">Help Center</h4>
                <ul className="space-y-2 text-xs text-slate-400">
                  <li><Link to="/buyer/orders" className="hover:text-brand transition-colors">Track My Order</Link></li>
                  <li><a href="#assurance" className="hover:text-brand transition-colors">Trade Assurance Guarantee</a></li>
                  <li><a href="#shipping" className="hover:text-brand transition-colors">Shipping & Delivery Rates</a></li>
                  <li><a href="#returns" className="hover:text-brand transition-colors">Returns & Refunds Policy</a></li>
                </ul>
              </div>

              {/* Col 4: Trust & Policies */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-white">Trust & Policies</h4>
                <ul className="space-y-2 text-xs text-slate-400">
                  <li><a href="#privacy" className="hover:text-brand transition-colors">Privacy Policy</a></li>
                  <li><a href="#terms" className="hover:text-brand transition-colors">Terms of Service</a></li>
                  <li><a href="#security" className="hover:text-brand transition-colors">Security & Payment Escrow</a></li>
                  <li><a href="#merchant-terms" className="hover:text-brand transition-colors">Vendor Agreement</a></li>
                </ul>
              </div>

              {/* Col 5: Contact & Support */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-white">Contact & Support</h4>
                <p className="text-xs text-slate-400">
                  Have questions about wholesale sourcing or orders? Our global support team is available 24/7.
                </p>
                <div className="text-xs text-slate-300 font-mono space-y-1">
                  <p>📧 support@smartproduct.ai</p>
                  <p>📍 Central Sourcing Hub</p>
                  <p>📞 +237 600 000 000</p>
                </div>
              </div>
            </div>

            <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-slate-500">
              <p>© 2026 Smart Product AI Platform. All rights reserved. Inspired by modern global e-commerce standards.</p>
              <div className="flex items-center gap-4">
                <span>🛡️ 100% Trade Assurance</span>
                <span>🔒 256-bit SSL Protected</span>
                <span>⚡ Instant AI Indexing</span>
              </div>
            </div>
          </footer>
        )}

        {/* SHOPPING CART DRAWER */}
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
                        className="text-[10px] text-slate-400 hover:text-red-400 underline transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setCartOpen(false)}
                    className="text-slate-400 hover:text-white font-bold text-xl cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {cartItems.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    Your cart is currently empty.
                  </div>
                ) : (
                  <ul className="mt-4 space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                    {cartItems.map((item) => (
                      <li
                        key={item.id}
                        className="bg-white/5 p-3.5 rounded-xl text-sm flex justify-between items-center border border-white/5"
                      >
                        <div>
                          <p className="font-semibold text-white truncate max-w-[180px]">
                            {item.name}
                          </p>

                          <p className="text-xs text-slate-400 mt-0.5">
                            {Math.round(
                              item.price
                            ).toLocaleString()}{" "}
                            FCFA
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateQuantity(item.id, -1)
                            }
                            className="w-6 h-6 bg-white/10 hover:bg-white/20 text-white rounded-md flex items-center justify-center font-bold text-xs"
                          >
                            -
                          </button>

                          <span className="text-white font-mono font-bold text-xs px-1">
                            {item.quantity}
                          </span>

                          <button
                            onClick={() =>
                              updateQuantity(item.id, 1)
                            }
                            className="w-6 h-6 bg-white/10 hover:bg-white/20 text-white rounded-md flex items-center justify-center font-bold text-xs"
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
                  <span className="text-slate-400 text-sm">
                    Total Amount
                  </span>

                  <span className="text-xl font-bold text-emerald-400">
                    {Math.round(
                      totalCartPrice
                    ).toLocaleString()}{" "}
                    FCFA
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
    </div>
  );
}