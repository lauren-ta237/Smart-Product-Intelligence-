import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { api } from "../api/client";
import { formatImageUrl, normalizeBoundingBox } from "../api/imageUtils";

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
        message = err.response?.data?.detail || err.message || message;
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
      <div className="min-h-screen bg-slate-950 text-white p-8 flex flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mb-4"></div>
        <p className="text-slate-400 font-medium">Syncing Audited Ledger...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white p-6 md:p-10 antialiased">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent uppercase">
              Inventory Ledger
            </h1>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">
              AI-Committed Product History
            </p>
          </div>
          
          <button
            type="button"
            onClick={() => navigate("/")}
            className="self-start sm:self-auto px-6 py-2.5 text-xs font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 text-slate-300 hover:white border border-white/10 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
          >
            ← Back to Market
          </button>
        </div>

        {/* HISTORICAL RECORDS LIST */}
        {errorMessage ? (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-8 text-center">
            <h2 className="text-xl font-bold text-white">System Error</h2>
            <p className="mt-4 text-slate-300 text-sm">{errorMessage}</p>
          </div>
        ) : productsList.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-3">
            <span className="text-4xl block">📦</span>
            <h3 className="text-lg font-bold text-white">Empty Catalog</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              No products found in your database profile. Upload and save images to populate this registry.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {productsList.map((product) => {
              const imgSrc = formatImageUrl(product.image_url || "");
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

              const confidence = product.confidence_score ?? 0;
              const displayConfidence = confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);

              return (
                <div
                  key={product.id}
                  className="w-full space-y-4 bg-white/[0.02] p-8 rounded-3xl border border-white/5 backdrop-blur-md"
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">UID: {product.id}</span>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 font-black rounded-full text-[10px] border border-emerald-500/10 uppercase tracking-wider">
                      Verified Catalog Asset
                    </span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-10 items-start">
                    <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-white/10 self-start shadow-2xl h-[480px]">
                      {imgSrc ? (
                        <img src={imgSrc} alt={product.name} style={zoomStyle} className="block select-none transition-all duration-300" onError={(e) => { (e.target as HTMLImageElement).src = ""; }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-700">Missing Asset</div>
                      )}
                    </div>

                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h2 className="text-3xl font-black tracking-tight">{product.name}</h2>
                        <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 font-black rounded-xl text-xs border border-emerald-500/10">
                          {displayConfidence}% MATCH
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="px-2.5 py-1 bg-white/5 rounded-lg text-[10px] font-black uppercase text-slate-300 tracking-widest border border-white/5">
                          {product.brand || "Generic"}
                        </span>
                        <span className="px-2.5 py-1 bg-indigo-500/10 rounded-lg text-[10px] font-black uppercase text-indigo-400 tracking-widest border border-indigo-500/10">
                          {product.category || "Produce"}
                        </span>
                      </div>

                      <p className="text-sm text-slate-400 leading-relaxed font-medium">
                        {product.description || "Historical AI catalog asset indexed from shelf detection pipeline."}
                      </p>

                      <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-4">
                        <span className="block text-[10px] text-slate-500 font-black uppercase tracking-widest">
                          Global SKU Registry
                        </span>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <span className="block text-[9px] text-slate-500 font-bold uppercase">Base SKU</span>
                            <span className="font-mono text-slate-200 text-xs font-bold">{product.sku || "—"}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="block text-[9px] text-indigo-400 font-bold uppercase">US Variant</span>
                            <span className="font-mono text-indigo-300 text-xs font-bold">{product.sku_us || "—"}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="block text-[9px] text-emerald-400 font-bold uppercase">CM Variant</span>
                            <span className="font-mono text-emerald-400 text-xs font-bold">{product.sku_cm || "—"}</span>
                          </div>
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
                            position: 'absolute',
                            left: `${-(box.x / box.width) * 100}%`, // Corrected
                            top: `${-(box.y / box.height) * 100}%`, // Corrected
                            maxWidth: 'none'
                          } : {
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain'
                          }}
                          className="block select-none transition-all duration-300"
                          onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-700">Missing Asset</div>
                      )}
                    </div>

                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h2 className="text-3xl font-black tracking-tight">{product.name}</h2>
                        <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 font-black rounded-xl text-xs border border-emerald-500/10">
                          {displayConfidence}% MATCH
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="px-2.5 py-1 bg-white/5 rounded-lg text-[10px] font-black uppercase text-slate-300 tracking-widest border border-white/5">
                          {product.brand || "Generic"}
                        </span>
                        <span className="px-2.5 py-1 bg-indigo-500/10 rounded-lg text-[10px] font-black uppercase text-indigo-400 tracking-widest border border-indigo-500/10">
                          {product.category || "Produce"}
                        </span>
                      </div>

                      <p className="text-sm text-slate-400 leading-relaxed font-medium">
                        {product.description || "Historical AI catalog asset indexed from shelf detection pipeline."}
                      </p>

                      <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-4">
                        <span className="block text-[10px] text-slate-500 font-black uppercase tracking-widest">
                          Global SKU Registry
                        </span>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <span className="block text-[9px] text-slate-500 font-bold uppercase">Base SKU</span>
                            <span className="font-mono text-slate-200 text-xs font-bold">{product.sku || "—"}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="block text-[9px] text-indigo-400 font-bold uppercase">US Variant</span>
                            <span className="font-mono text-indigo-300 text-xs font-bold">{product.sku_us || "—"}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="block text-[9px] text-emerald-400 font-bold uppercase">CM Variant</span>
                            <span className="font-mono text-emerald-400 text-xs font-bold">{product.sku_cm || "—"}</span>
                          </div>
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