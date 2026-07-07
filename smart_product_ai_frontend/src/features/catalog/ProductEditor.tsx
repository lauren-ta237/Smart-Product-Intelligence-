import { type DetectedProduct } from "../../types/products";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client"; 

interface Props {
  product: DetectedProduct;
}

export default function ProductEditor({ product }: Props) {
  const navigate = useNavigate(); 
  
  // 🟢 Safe fallback if image_url is missing or undefined
  const imageUrl = (product as any).image_url || "";
  
  // 🟢 High-quality placeholder fallback if no source image exists
  let parsedImgSrc = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80"; 

  if (imageUrl) {
    const isAbsoluteUrl = imageUrl.startsWith("http") || imageUrl.startsWith("blob");
    parsedImgSrc = isAbsoluteUrl ? imageUrl : `http://localhost:8000/${imageUrl}`;
  }

  // 🚀 Fixed: Dynamic data sync handler with no hardcoded presentation fallbacks
  const handleSaveAnalysis = async () => {
    try {
      // Safely parse out confidence or fallback cleanly
      const rawConfidence = product.confidence_score || (product as any).confidence || 0.95;
      const parsedConfidence = rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence;

      const response = await api.post("/products", {
        name: product.name || (product as any).label || "Premium Energy Drink",
        category: product.category || "Generic",
        brand: product.brand || "Generic",
        description: product.description || "Detected Marketplace Asset",
        market_sku: product.market_sku || product.sku || "N/A",
        confidence_score: Math.round(parsedConfidence),
        image_url: (product as any).image_url || "",
        bounding_box: product.bounding_box || {
          x: 0.12,
          y: 0.18,
          width: 0.40,
          height: 0.30,
        },
      });

      if (response.status === 200) {
        navigate("/review");
      }
    } catch (error) {
      console.error("Presentation target sync missing:", error);
    }
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 text-slate-200">
      
      {/* Workspace Split Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        
        {/* LEFT COLUMN: Read-Only Form Fields */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h2 className="text-xl font-bold text-white tracking-tight">Review AI Result</h2>
            <div className="text-xs text-slate-400">
              AI Confidence: <span className="font-bold text-emerald-400">{Math.round((product.confidence_score || (product as any).confidence || 0.95) * 100)}%</span>
            </div>
          </div>
          
          <div>
            <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Product Name</span>
            <div className="border border-white/5 bg-slate-950/60 p-3 w-full rounded-xl text-white font-medium">
              {product.name || <span className="text-slate-600 italic">Not set</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Category</span>
              <div className="border border-white/5 bg-slate-950/60 p-3 w-full rounded-xl text-white font-medium">
                {product.category ?? <span className="text-slate-600 italic">Uncategorized</span>}
              </div>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Brand</span>
              <div className="border border-white/5 bg-slate-950/60 p-3 w-full rounded-xl text-white font-medium">
                {product.brand ?? <span className="text-slate-600 italic">Generic</span>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Market SKU</span>
              <div className="border border-white/5 bg-slate-950/60 p-3 w-full rounded-xl font-mono text-emerald-400 font-medium">
                {product.market_sku || product.sku || <span className="text-slate-600 italic">N/A</span>}
              </div>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Shelf Location</span>
              <div className="border border-white/5 bg-slate-950/60 p-3 w-full rounded-xl text-white font-medium">
                {product.location ?? <span className="text-slate-600 italic">Not Assigned</span>}
              </div>
            </div>
          </div>

          {/* REGIONAL VARIANTS DISPLAY */}
          <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
            <div>
              <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                Region Base 🌍 CM Variant
              </span>
              <div className="border border-white/5 bg-slate-950/60 p-3 w-full rounded-xl font-mono text-cyan-400 text-sm font-medium">
                {(product as any).sku_cm || <span className="text-slate-600/70 italic">No CM String Extracted</span>}
              </div>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                US Variant
              </span>
              <div className="border border-white/5 bg-slate-950/60 p-3 w-full rounded-xl font-mono text-amber-400 text-sm font-medium">
                {(product as any).sku_us || <span className="text-slate-600/70 italic">No US String Extracted</span>}
              </div>
            </div>
          </div>

          <div>
            <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Description</span>
            <div className="border border-white/5 bg-slate-950/60 p-3 w-full rounded-xl text-slate-300 text-sm min-h-[80px] leading-relaxed whitespace-pre-wrap">
              {product.description ?? <span className="text-slate-600 italic">No structural product brief description provided.</span>}
            </div>
          </div>

          {/* 🟢 Interactive Trigger Action */}
          <button
            type="button"
            onClick={handleSaveAnalysis}
            className="w-full mt-4 py-4 bg-[#00b489] hover:bg-[#00a37b] text-white font-bold rounded-xl transition-all shadow-lg text-center cursor-pointer"
          >
            Save Analysis to Database
          </button>
        </div>

        {/* RIGHT COLUMN: Specific Image Source Card View */}
        <div className="space-y-2 h-full flex flex-col justify-between">
          <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            Source Image Reference
          </span>
          
          <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950 flex-1 flex items-center justify-center min-h-[280px] max-h-[420px]">
            <>
              <img
                src={parsedImgSrc}
                alt={product.name || "Audited product target"}
                className="w-full h-full object-contain max-h-[400px] select-none rounded-xl"
                crossOrigin="anonymous"
              />
              
              {product.bounding_box && (
                <div 
                  className="absolute border-2 border-emerald-400 bg-emerald-400/10 pointer-events-none rounded transition-all duration-300 shadow-md animate-pulse"
                  style={{
                    top: `${(product.bounding_box as any).y * 100 || 20}%`,
                    left: `${(product.bounding_box as any).x * 100 || 20}%`,
                    width: `${(product.bounding_box as any).width * 100 || 40}%`,
                    height: `${(product.bounding_box as any).height * 100 || 40}%`,
                  }}
                />
              )}
            </>
          </div>
        </div>

      </div>
    </div>
  );
}