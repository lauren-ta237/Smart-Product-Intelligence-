import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { DetectedProduct } from "../../types/products.ts";
import ProductCard from "./ProductCard";

interface Props {
  imageUrl: string;
  products: DetectedProduct[];
  onViewReviews?: () => void; // Callback to navigate back to dashboard/reviews on demand
}

export default function AnalysisViewer({ imageUrl, products: initialProducts, onViewReviews }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const navigate = useNavigate();

  // Tracking State for interactive sync between cards and bounding boxes
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // State controller to handle inline list overrides dynamically when editing
  const [products, setProducts] = useState<DetectedProduct[]>(initialProducts);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // 🌍 Local Vendor Geographic State Context
  const [vendorLocale, setVendorLocale] = useState<{ country: string; language: string }>({
    country: "US",
    language: "en-US",
  });

  // ⚡ Hardware-first Timezone Country Detection Engine
  useEffect(() => {
    if (typeof window !== "undefined") {
      let detectedCountry = "US";
      const locale = navigator.language || "en-US";

      try {
        // Step 1: Check hardware system timezone first to override browser configuration strings
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const tzMap: { [key: string]: string } = {
          "Africa/Douala": "CM",
          "Africa/Lagos": "NG",
          "Africa/Abidjan": "CI",
          "Africa/Nairobi": "KE",
          "Europe/Paris": "FR",
          "Europe/London": "GB",
          "Europe/Berlin": "DE",
          "America/New_York": "US",
          "America/Los_Angeles": "US",
          "America/Toronto": "CA",
          "Asia/Tokyo": "JP",
          "Asia/Shanghai": "CN",
          "Asia/Dubai": "AE",
        };

        if (timeZone && tzMap[timeZone]) {
          detectedCountry = tzMap[timeZone];
        } else if (locale.includes("-")) {
          // Step 2: Fall back to language locale strings only if timezone is non-standard
          const parts = locale.split("-");
          if (parts[1] && parts[1].length >= 2 && parts[1].length <= 3) {
            detectedCountry = parts[1];
          }
        }
      } catch (e) {
        console.warn("[Localizer Engine Warning]: Failed to resolve dynamic country context.");
      }

      setVendorLocale({
        country: detectedCountry.toUpperCase(),
        language: locale,
      });
    }
  }, []);

  // Sync state if products are refreshed from a new parent api poll context lifecycle
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  // Recalculate dimensions whenever the image loads or window resizes
  const updateDimensions = () => {
    if (imgRef.current) {
      setDimensions({
        width: imgRef.current.getBoundingClientRect().width,
        height: imgRef.current.getBoundingClientRect().height,
      });
    }
  };

  useEffect(() => {
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const handleProductUpdate = (updatedProduct: DetectedProduct) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
  };

  const handleSaveToDatabase = async () => {
    // 🛡️ FRONTEND VALIDATION GATE: Gracefully block invalid non-product image submissions
    if (!products || products.length === 0) {
      setSaveStatus({
        type: "error",
        message: "This is not a product. Please upload a real product image.",
      });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);
    try {
      const response = await api.post("/products/batch-update", {
        image_url: imageUrl,
        products: products,
        market_region: vendorLocale.country,
      });

      if (response.status !== 200) {
        throw new Error("Failed to persist updated product configurations.");
      }

      setSaveStatus({ type: "success", message: "Analysis catalog successfully committed to database!" });

      // persist a quick client-side copy so Review renders immediately
      try { sessionStorage.setItem("last_saved_products", JSON.stringify(products)); } catch {}

      // Notify listeners (Review) and navigate to the review page so saved data is visible
      try {
        window.dispatchEvent(new CustomEvent("products:updated", { detail: { timestamp: Date.now() } }));
      } catch (e) {
        console.warn("Could not dispatch products:updated event", e);
      }

      try {
        if (onViewReviews) onViewReviews();
        else navigate("/review");
      } catch (e) {
        /* ignore navigation errors */
      }
    } catch (error: any) {
      console.error("[Database Commit Error]:", error);
      setSaveStatus({ type: "error", message: error.message || "Failed to sync changes." });
    } finally {
      setIsSaving(false);
    }
  };

  const isAbsoluteUrl = imageUrl.startsWith("http") || imageUrl.startsWith("blob");

  // 🛠️ Dynamic localization metadata parser with case-insensitive fallback chains
  const getLocalizedMetadata = (product: DetectedProduct) => {
    const region = vendorLocale.country.toLowerCase();
    const prodAny = product as any;

    // Fallback order: region specific property -> standard name -> Capitalized Name -> snake_case
    const localizedName =
      prodAny[`name_${region}`] ||
      product.name ||
      prodAny?.Name ||
      prodAny?.product_name ||
      "Detected Item";

    // Fallback order for SKU properties
    const localizedSku =
      prodAny[`sku_${region}`] ||
      product.sku ||
      prodAny?.Sku ||
      prodAny?.SKU ||
      "N/A";

    return {
      sku: localizedSku,
      localized_name: localizedName,
    };
  };

  // 🛑 Intercept empty datasets early to display the targeted notice clearly across the layout view area
  if (!products || products.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto my-8 p-6 bg-rose-500/10 backdrop-blur-md rounded-2xl border border-rose-500/20 shadow-xl text-center space-y-4">
        <div className="text-4xl text-rose-400">⚠️</div>
        <h3 className="text-lg font-bold text-white tracking-tight">Invalid Dataset Detected</h3>
        <p className="text-sm text-rose-300 max-w-md mx-auto leading-relaxed">
          This is not a product. Please upload a real product image.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* 🎯 PERSISTENT TOP NAVIGATION HEADER BAR */}
      <div className="flex items-center justify-between pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          {onViewReviews && (
            <button
              type="button"
              onClick={onViewReviews}
              className="px-3 py-1.5 text-xs font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              ← Back
            </button>
          )}
          <h1 className="text-xl font-bold tracking-tight text-white">
            AI Analysis Results
          </h1>
        </div>

        {/* Dynamic Indicator Badge matching look from image_0dd815.png */}
        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded-full text-xs border border-emerald-500/20">
          Found {products.length} {products.length === 1 ? "Product" : "Products"} Successfully
        </span>
      </div>

      {/* 📦 PRIMARY TWO-COLUMN WORKSPACE GRID */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* 🖼️ IMAGE OVERLAY PANEL */}
        <div className="relative inline-block w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950 self-start">
          <img
            ref={imgRef}
            src={isAbsoluteUrl ? imageUrl : `http://localhost:8000/${imageUrl}`}
            alt="Analyzed product batch"
            className="rounded-xl w-full h-auto object-contain block select-none z-10 relative"
            crossOrigin="anonymous"
            onLoad={updateDimensions}
          />

          {dimensions.width > 0 && (
            <svg
              className="absolute top-0 left-0 w-full h-full select-none z-20 pointer-events-none"
              style={{ width: dimensions.width, height: dimensions.height }}
            >
              {products.map((product, idx) => {
                const rawBox = product.bounding_box;
                if (!rawBox) return null;

                const elementKey = product.id || `${product.name || "box"}-${idx}`;
                const isSelected = selectedProductId === product.id;
                const localizedInfo = getLocalizedMetadata(product);

                let top = 0, left = 0, width = 0, height = 0;

                if (typeof rawBox === "object" && !Array.isArray(rawBox)) {
                  const obj = rawBox as any;
                  const startX = obj.xmin !== undefined ? obj.xmin : (obj.x !== undefined ? obj.x : obj.left);
                  const startY = obj.ymin !== undefined ? obj.ymin : (obj.y !== undefined ? obj.y : obj.top);
                  const endX = obj.xmax !== undefined ? obj.xmax : obj.right;
                  const endY = obj.ymax !== undefined ? obj.ymax : obj.bottom;

                  const maxCoordCheck = Math.max(startX || 0, startY || 0, endX || 0, endY || 0, obj.width || 0, obj.height || 0);
                  const scale = maxCoordCheck > 1.2 ? 1000 : 1;

                  if (endX !== undefined && endY !== undefined) {
                    left = (Number(startX || 0) / scale) * dimensions.width;
                    top = (Number(startY || 0) / scale) * dimensions.height;
                    width = ((Number(endX) - Number(startX)) / scale) * dimensions.width;
                    height = ((Number(endY) - Number(startY)) / scale) * dimensions.height;
                  } else {
                    left = (Number(startX || 0) / scale) * dimensions.width;
                    top = (Number(startY || 0) / scale) * dimensions.height;
                    width = (Number(obj.width || 0) / scale) * dimensions.width;
                    height = (Number(obj.height || 0) / scale) * dimensions.height;
                  }
                } else {
                  let finalBoxArray: number[] = [];
                  if (typeof rawBox === "string") {
                    try {
                      const parsed = JSON.parse(rawBox);
                      finalBoxArray = Array.isArray(parsed) ? parsed : Object.values(parsed);
                    } catch { return null; }
                  } else if (Array.isArray(rawBox)) {
                    finalBoxArray = Array.isArray(rawBox[0]) ? (rawBox[0] as number[]) : (rawBox as number[]);
                  }

                  if (!Array.isArray(finalBoxArray) || finalBoxArray.length < 4) return null;

                  finalBoxArray = finalBoxArray.map(Number);
                  if (finalBoxArray.some((coord) => coord > 1)) {
                    finalBoxArray = finalBoxArray.map((coord) => coord / 1000);
                  }

                  const [ymin, xmin, ymax, xmax] = finalBoxArray;
                  top = ymin * dimensions.height;
                  left = xmin * dimensions.width;
                  width = (xmax - xmin) * dimensions.width;
                  height = (ymax - ymin) * dimensions.height;
                }

                if (isNaN(left) || isNaN(top) || width <= 0 || height <= 0) return null;

                return (
                  <g
                    key={`overlay-group-${elementKey}`}
                    className="pointer-events-auto cursor-pointer"
                    onMouseEnter={() => setSelectedProductId(product.id || null)}
                    onMouseLeave={() => setSelectedProductId(null)}
                  >
                    <rect
                      x={left}
                      y={top}
                      width={width}
                      height={height}
                      fill={isSelected ? "rgba(0, 245, 160, 0.15)" : "rgba(0, 245, 160, 0.03)"}
                      stroke="#00f5a0"
                      strokeWidth={isSelected ? "3.5" : "2"}
                      className={isSelected ? "" : "animate-pulse"}
                      style={{
                        opacity: isSelected ? 1 : 0.75,
                        transition: "all 0.15s ease-in-out",
                      }}
                    />
                    <rect
                      x={left}
                      y={top - 20 > 0 ? top - 20 : 0}
                      width={Math.max(85, Math.min(width, 160))}
                      height={20}
                      fill={isSelected ? "#34d399" : "#00f5a0"}
                      rx="4"
                      style={{ transition: "all 0.15s ease-in-out" }}
                    />
                    <text
                      x={left + 6}
                      y={top - 20 > 0 ? top - 6 : 14}
                      fill="#020617"
                      className="text-[10px] font-extrabold tracking-tight"
                    >
                      {localizedInfo.localized_name.length > 18 ? `${localizedInfo.localized_name.slice(0, 16)}...` : localizedInfo.localized_name}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* 📋 CONFIGURATION DATA CARDS */}
        <div className="flex flex-col h-[75vh]">
          <div className="mb-4 p-3 bg-slate-900/60 border border-white/5 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 font-bold rounded uppercase tracking-wider text-[10px]">
                Market Active: {vendorLocale.country}
              </span>
              <span className="text-slate-400 font-mono">({vendorLocale.language})</span>
            </div>
            <span className="text-slate-500 text-[11px]">Dynamic Localizer Stack</span>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
            {products.map((product, idx) => {
              const productKey = product.id || `${product.name || "item"}-${idx}`;
              const isSelected = selectedProductId === product.id;
              const regionalData = getLocalizedMetadata(product);

              return (
                <div
                  key={productKey}
                  onMouseEnter={() => setSelectedProductId(product.id || null)}
                  onMouseLeave={() => setSelectedProductId(null)}
                  className={`transition-all duration-200 rounded-xl p-0.5 bg-slate-950/20 border border-transparent ${
                    isSelected ? "ring-2 ring-emerald-400 bg-slate-900 shadow-lg scale-[1.01]" : ""
                  }`}
                >
                  <ProductCard
                    product={{
                      ...product,
                      name: regionalData.localized_name,
                    }}
                    onUpdate={handleProductUpdate}
                  />

                  {/* Applied Fixed Location Display Metadata Block */}
                  <div className="mx-4 mb-3 -mt-1 grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                    <div>
                      <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Market SKU</span>
                      <span className="font-mono text-emerald-400 font-medium break-all">{regionalData.sku}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Region Base</span>
                      <span className="text-slate-300 font-medium flex items-center gap-1">
                        🌍 {vendorLocale.country} Variant
                        {product.location && (
                          <span className="text-emerald-400 font-semibold text-[11px]">({product.location})</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 💾 ACTIONS BAR */}
          <div className="mt-4 pt-4 border-t border-white/10 bg-slate-950/40 space-y-3">
            {saveStatus && (
              <div className={`p-3 rounded-xl text-sm border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                saveStatus.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              }`}>
                <span>{saveStatus.message}</span>
                {saveStatus.type === "success" && onViewReviews && (
                  <button
                    type="button"
                    onClick={onViewReviews}
                    className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition-colors border border-emerald-500/30 self-start sm:self-auto"
                  >
                    → View Reviews
                  </button>
                )}
              </div>
            )}

            <button
              onClick={handleSaveToDatabase}
              disabled={isSaving || products.length === 0}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 font-bold text-white rounded-xl shadow-xl hover:shadow-emerald-500/10 transition-all duration-200 flex items-center justify-center gap-2 border border-emerald-400/20 disabled:border-transparent"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Committing Localized Batches...
                </>
              ) : (
                "Save Analysis to Database"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}