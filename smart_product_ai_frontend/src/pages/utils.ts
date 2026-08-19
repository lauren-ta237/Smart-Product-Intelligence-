export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  confidence?: number;
}

// --- UNIVERSAL BOUNDING BOX NORMALIZER ---
export function normalizeBoundingBox(box: any): BoundingBox | null {
  if (!box) return null;

  try {
    // 1. Format: [ymin, xmin, ymax, xmax]
    if (Array.isArray(box) && box.length >= 4) {
      const coords = box.map(n => Number(n));
      const isNormalized = Math.max(...coords) <= 1.1;
      const scale = isNormalized ? 100 : 0.1; // Convert to % (0.5 -> 50% or 500 -> 50%)

      const [y1, x1, y2, x2] = coords;
      return {
        x: x1 * scale,
        y: y1 * scale,
        width: (x2 - x1) * scale,
        height: (y2 - y1) * scale
      };
    }

    // 2. Format: {x, y, width, height}
    if (box.x !== undefined && box.width !== undefined) {
      const scale = (box.x > 1 || box.width > 1) ? 1 : 100;
      return {
        x: Number(box.x) * scale,
        y: Number(box.y) * scale,
        width: Number(box.width) * scale,
        height: Number(box.height) * scale
      };
    }
  } catch (e) {
    console.error("Bounding box normalization failed", e);
  }
  return null;
}

// --- IMAGE PATH NORMALIZATION ---
export function formatImageUrl(url?: string): string {
  if (!url || url === "null" || url === "undefined" || url === "") {
    return "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800";
  }
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  
  let cleanPath = url.replace(/http:\/\/localhost:8000\//g, "");
  cleanPath = cleanPath.replace(/^uploads\//, "");
  cleanPath = cleanPath.replace(/^\//, "");
  
  const finalUrl = `http://localhost:8000/uploads/${cleanPath}`;
  return finalUrl;
}