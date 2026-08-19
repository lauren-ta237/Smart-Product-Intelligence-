import { useState, useRef, useEffect, useMemo } from "react";
import { type DetectedProduct } from "../types/products";
import { useCart } from "../store/cart";

interface Props {
  imageUrl: string;
  detectedProducts: DetectedProduct[];
  onAddToCart?: (product: DetectedProduct) => void;
  onHoverProduct?: (id: string | null) => void;
  selectedProductId?: string | null;
}

export default function ProductDetectionViewer({
  imageUrl,
  detectedProducts,
  onAddToCart,
  onHoverProduct,
  selectedProductId: externalSelectedId,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });
  const [internalHoveredId, setInternalHoveredId] = useState<string | null>(null);

  const cartStore = useCart();
  const activeSelectedId = externalSelectedId !== undefined ? externalSelectedId : internalHoveredId;

  const recalculateOverlayDimensions = () => {
    if (imgRef.current) {
      setImgDimensions({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
      });
    }
  };

  useEffect(() => {
    window.addEventListener("resize", recalculateOverlayDimensions);
    return () => window.removeEventListener("resize", recalculateOverlayDimensions);
  }, []);

  const handleAddToCartAction = (product: DetectedProduct) => {
    if (onAddToCart) {
      onAddToCart(product);
      return;
    }
    
    cartStore.addToCart({
      id: product.id,
      name: product.name,
      price: product.price || 5.00,
      category: product.category || "Fresh Produce",
      icon: "🥦",
    });
  };

  const handleMouseEnterBox = (id: string) => {
    setInternalHoveredId(id);
    if (onHoverProduct) onHoverProduct(id);
  };

  const handleMouseLeaveBox = () => {
    setInternalHoveredId(null);
    if (onHoverProduct) onHoverProduct(null);
  };

  const parsedBoxes = useMemo(() => {
    return detectedProducts.map((p, index) => {
      const rawBox = p.bounding_box;
      if (!rawBox) return null;

      let top = 0, left = 0, width = 0, height = 0;

      if (typeof rawBox === "object" && !Array.isArray(rawBox)) {
        const obj = rawBox as any;
        const scale = (obj.x > 1 || obj.y > 1 || obj.width > 1 || obj.height > 1) ? 1000 : 1;
        
        left = (obj.x / scale) * 100;
        top = (obj.y / scale) * 100;
        width = (obj.width / scale) * 100;
        height = (obj.height / scale) * 100;
      } 
      else if (Array.isArray(rawBox)) {
        const coords = (Array.isArray(rawBox[0]) ? rawBox[0] : rawBox).map(Number);
        if (coords.length >= 4) {
            const scale = coords.some(c => c > 1.1) ? 1000 : 1;
            const [ymin, xmin, ymax, xmax] = coords;
            top = (ymin / scale) * 100;
            left = (xmin / scale) * 100;
            width = ((xmax - xmin) / scale) * 100;
            height = ((ymax - ymin) / scale) * 100;
        }
      }

      if (width <= 0 || height <= 0) return null;

      return {
        product: p,
        index,
        styles: {
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
        },
      };
    });
  }, [detectedProducts]);

  // 🟢 FIXED: Path resolution must be idempotent to avoid double http/uploads prefixes
  const isAbsoluteUrl = imageUrl?.startsWith("http") || imageUrl?.startsWith("blob") || imageUrl?.startsWith("data:");
  
  let finalSrc = imageUrl;
  if (!isAbsoluteUrl) {
    let cleanPath = imageUrl?.replace(/^\//, "") || "";
    if (cleanPath && !cleanPath.startsWith("uploads/")) {
      cleanPath = "uploads/" + cleanPath;
    }
    finalSrc = `http://localhost:8000/${cleanPath}`;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start text-white">
      <div className="lg:col-span-2 space-y-3">
        <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          AI Spatial Mapping Overlay
        </span>

        <div
          ref={containerRef}
          className="relative inline-block w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
        >
          <img
            ref={imgRef}
            src={finalSrc}
            alt="AI Scan Source"
            className="w-full h-auto object-contain block select-none max-h-[75vh]"
            onLoad={recalculateOverlayDimensions}
            crossOrigin="anonymous"
            onError={(e) => {
                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80";
            }}
          />

          {imgDimensions.width > 0 && (
            <div
              className="absolute top-0 left-0 w-full h-full pointer-events-none z-20"
              style={{ width: imgDimensions.width, height: imgDimensions.height }}
            >
              {parsedBoxes.map((box) => {
                if (!box) return null;
                const { product, index, styles } = box;
                const isFocused = activeSelectedId === product.id;
                const confidencePercent = Math.round((product.confidence_score ?? 0) * 100);

                return (
                  <div
                    key={`overlay-box-${product.id || index}`}
                    className="absolute cursor-pointer transition-all duration-150 ease-out pointer-events-auto"
                    style={{ ...styles, zIndex: isFocused ? 30 : 20 }}
                    onMouseEnter={() => handleMouseEnterBox(product.id)}
                    onMouseLeave={handleMouseLeaveBox}
                  >
                    <div
                      className={`w-full h-full border-2 rounded-lg transition-all duration-150 ${
                        isFocused
                          ? "border-emerald-400 bg-emerald-400/20 ring-4 ring-emerald-400/10 shadow-[0_0_20px_rgba(52,211,153,0.4)] scale-[1.01]"
                          : "border-cyan-400/60 bg-cyan-400/[0.05] hover:border-emerald-400"
                      }`}
                    />

                    <div
                      className={`absolute left-0 -top-7 flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[10px] font-black tracking-tight shadow-xl ${
                        isFocused ? "bg-emerald-400 text-slate-950 scale-105" : "bg-cyan-500 text-slate-950"
                      }`}
                    >
                      <span className="truncate max-w-[120px]">{product.name}</span>
                      <span className="opacity-80">({confidencePercent}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-white/5 pb-3">
          <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Detected Catalog
          </span>
          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 font-mono font-bold text-[9px] rounded-full border border-emerald-500/10">
            {detectedProducts.length} Items
          </span>
        </div>

        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
          {detectedProducts.map((p, index) => {
            const isFocused = activeSelectedId === p.id;
            return (
              <div
                key={p.id || index}
                onMouseEnter={() => handleMouseEnterBox(p.id)}
                onMouseLeave={handleMouseLeaveBox}
                className={`p-4 rounded-2xl border transition-all duration-200 ${
                  isFocused
                    ? "border-emerald-500 bg-emerald-500/[0.06] shadow-lg scale-[1.02]"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1">
                    <h4 className={`text-xs font-black truncate max-w-[140px] ${isFocused ? "text-emerald-400" : "text-white"}`}>
                      {p.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{p.category || "General"}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-emerald-400 font-black text-sm block">
                      ${p.price ? p.price.toFixed(2) : "5.00"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
                   <span className="text-[9px] text-slate-500 font-mono font-bold uppercase">
                    CONF: {Math.round(p.confidence_score * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddToCartAction(p)}
                    className="px-3 py-1.5 bg-emerald-600 text-slate-950 font-black uppercase text-[9px] rounded-lg hover:bg-emerald-500 transition-colors"
                  >
                    + Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}