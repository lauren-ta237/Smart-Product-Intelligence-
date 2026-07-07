import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { api } from "../api/client";

interface SavedProduct {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  sku?: string | null;
  sku_us?: string | null;
  sku_cm?: string | null;
  market_sku?: string | null;
  confidence_score?: number | null;
  image_url?: string | null;
  bounding_box?: any;
}

export default function Review() {
  const navigate = useNavigate();
  const [productsList, setProductsList] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function fetchSavedDatabaseProducts() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await api.get<SavedProduct[]>("/products");
      setProductsList(response.data ?? []);
    } catch (err: unknown) {
      let message = "Unable to load review history.";

      if (axios.isAxiosError(err)) {
        message =
          err.response?.data?.detail ||
          err.response?.data?.message ||
          err.message ||
          message;
      } else if (err instanceof Error) {
        message = err.message;
      }

      setErrorMessage(message);
      setProductsList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSavedDatabaseProducts();
    window.addEventListener("products:updated", fetchSavedDatabaseProducts);
    return () => window.removeEventListener("products:updated", fetchSavedDatabaseProducts);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white p-8 flex flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mb-4"></div>
        <p className="text-slate-400 font-medium">Loading saved review history...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white p-6 md:p-10 antialiased">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Audited Catalog Ledger
            </h1>
            <p className="text-slate-400 text-sm font-medium">
              Committed inventory history populated directly from saved AI Analysis runs
            </p>
          </div>
          
          <button
            type="button"
            onClick={() => navigate("/")}
            className="self-start sm:self-auto px-4 py-2 text-xs font-bold uppercase tracking-wider bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* HISTORICAL RECORDS LIST */}
        {errorMessage ? (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-8 text-center">
            <h2 className="text-xl font-bold text-white">Unable to load review history</h2>
            <p className="mt-4 text-slate-300 text-sm">{errorMessage}</p>
          </div>
        ) : productsList.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-3">
            <span className="text-4xl block">📦</span>
            <h3 className="text-lg font-bold text-white">No saved product history</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              There are no persisted products for your account yet. Save analysis results to populate this page.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {productsList.map((product) => {
              const rawUrl = product.image_url || "";
              const isAbsoluteUrl = rawUrl.startsWith("http") || rawUrl.startsWith("blob");
              const imgSrc = rawUrl ? (isAbsoluteUrl ? rawUrl : `http://localhost:8000/${rawUrl}`) : "";

              let top = 20;
              let left = 20;
              let width = 40;
              let height = 40;
              const box = product.bounding_box;

              if (box) {
                if (Array.isArray(box) && box.length === 4) {
                  const [ymin, xmin, ymax, xmax] = box.map(Number);
                  top = ymin <= 1 ? ymin * 100 : 20;
                  left = xmin <= 1 ? xmin * 100 : 20;
                  width = ymax <= 1 ? (xmax - xmin) * 100 : 50;
                  height = ymax <= 1 ? (ymax - ymin) * 100 : 65;
                } else if (typeof box === "object") {
                  const obj = box as any;
                  top = (obj.y || obj.top || 0.2) * 100;
                  left = (obj.x || obj.left || 0.2) * 100;
                  width = (obj.width || 0.4) * 100;
                  height = (obj.height || 0.4) * 100;
                }
              }

              const confidence = product.confidence_score ?? 0;
              const displayConfidence = confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);

              return (
                <div
                  key={product.id}
                  className="w-full space-y-4 bg-slate-900/20 p-6 rounded-3xl border border-white/5 backdrop-blur-md"
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <span className="text-xs font-mono text-slate-500">ID: {product.id}</span>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded-full text-xs border border-emerald-500/20">
                      Active Asset Record
                    </span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8 items-start">
                    <div className="relative inline-block w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950 self-start min-h-[280px]">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={product.name}
                          className="w-full h-auto object-contain block select-none rounded-2xl max-h-[480px]"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div className="flex h-full min-h-[280px] items-center justify-center text-slate-500">
                          No image available
                        </div>
                      )}

                      {imgSrc && box && (
                        <div
                          className="absolute border-2 border-[#00f5a0] bg-emerald-400/10 pointer-events-none rounded transition-all duration-300 shadow-md"
                          style={{
                            top: `${top}%`,
                            left: `${left}%`,
                            width: `${width}%`,
                            height: `${height}%`,
                          }}
                        >
                          <div className="absolute top-0 left-0 bg-[#00f5a0] text-slate-950 font-extrabold text-[9px] px-1.5 py-0.5 rounded-br uppercase tracking-tight shadow">
                            {product.name}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-6">
                      <div className="p-3 bg-slate-900/60 border border-white/5 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 font-bold rounded uppercase tracking-wider text-[10px]">
                            {product.category || "General Asset"}
                          </span>
                        </div>
                        <span className="text-slate-500 text-[11px]">Vendor-owned review item</span>
                      </div>

                      <div className="bg-slate-950/40 border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
                        <div>
                          <h2 className="text-3xl font-bold tracking-tight text-white">{product.name}</h2>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] font-extrabold uppercase text-slate-300 tracking-wider">
                              {product.brand || "Generic"}
                            </span>
                            <span className="text-slate-400 text-xs font-medium">
                              {product.description || "Detected inventory asset"}
                            </span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                          <span className="text-slate-400 text-sm font-medium">AI Match Confidence:</span>
                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg text-sm border border-emerald-500/20">
                            {displayConfidence}%
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-3">
                        <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          Inventory SKU Matrix
                        </span>

                        <div className="grid grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="block text-[10px] text-slate-400 mb-0.5">Base Registry</span>
                            <span className="font-mono text-slate-200 text-sm font-medium">{product.sku || "—"}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-indigo-400 mb-0.5">US Variant</span>
                            <span className="font-mono text-indigo-300 text-sm font-medium">{product.sku_us || "—"}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-emerald-400 mb-0.5">CM Variant</span>
                            <span className="font-mono text-emerald-400 text-sm font-medium">{product.sku_cm || "—"}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex justify-between text-[11px]">
                          <span className="text-slate-500">Market Routing Key:</span>
                          <span className="font-mono font-semibold text-slate-300">{product.market_sku || "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
      </div>
    </div>
  );
}