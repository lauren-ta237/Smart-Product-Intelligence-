import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { DetectedProduct } from "../../types/products.ts";
import ProductCard from "./ProductCard";
import ProductDetectionViewer from "../../components/ProductDetectionViewer";

interface Props {
  imageUrl: string;
  products: DetectedProduct[];
}

export default function AnalysisViewer({ imageUrl, products: initialProducts }: Props) {
  const [products, setProducts] = useState<DetectedProduct[]>(initialProducts);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const handleSaveToDatabase = async () => {
    setIsSaving(true);
    try {
      const cleanPath = imageUrl
        .replace(/\\/g, "/")
        .replace(/^https?:\/\/[^/]+\/?/, "")
        .replace(/^\/+/, "");
      const payloadProducts = products.map((p) => ({
        name: String(p.name || "Unnamed Product"),
        description: String(p.description || "AI-detected item"),
        category: String(p.category || "General"),
        price: parseFloat(String(p.price || 0.0)),
        image_url: cleanPath,
        bounding_box: p.bounding_box,
        approved: true,
        stock_quantity: parseInt(String(p.stock_quantity || 10)),
      }));

      await api.post("/products/batch-update", payloadProducts);
      window.dispatchEvent(new CustomEvent("products:updated"));
      setStatus("success");
      setTimeout(() => window.location.reload(), 1000); // Force a hard refresh
    } catch (error) {
      console.error("Save Error:", error);
      setStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* TOP SECTION: AI Object Detection Overlay */}
      <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-4 md:p-6">
        <ProductDetectionViewer 
          imageUrl={imageUrl} 
          detectedProducts={products} 
          selectedProductId={hoveredId}
          onHoverProduct={(id) => setHoveredId(id)}
        />
      </div>

      {/* BOTTOM SECTION: Review Cards & Action */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
            {products.map((p, idx) => (
              <div 
                key={p.id || idx} 
                onMouseEnter={() => setHoveredId(p.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="transition-transform duration-200"
              >
                <ProductCard 
                  product={{ ...p, image_url: p.image_url || imageUrl }} 
                  onUpdate={(updated) => setProducts(prev => prev.map(old => old.id === updated.id ? updated : old))} 
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white/[0.02] border border-white/10 p-6 rounded-3xl sticky top-8">
            <h3 className="text-xl font-bold mb-2">Publish Results</h3>
            <p className="text-slate-400 text-xs mb-6">Commit these {products.length} detected items to the public marketplace ledger.</p>
            
            <button
              onClick={handleSaveToDatabase}
              disabled={isSaving || products.length === 0}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl transition-all shadow-xl disabled:opacity-50 cursor-pointer uppercase tracking-widest text-xs"
            >
              {isSaving ? "Syncing to Ledger..." : "Confirm & Save to DB"}
            </button>
            
            {status === "error" && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                <p className="text-rose-400 text-[10px] font-bold">❌ Save Failed: Validation Error</p>
                <p className="text-slate-500 text-[9px] mt-1 italic">Check browser console for details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}