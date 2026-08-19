import type { BoundingBox } from "../pages/dashboard";
import { BACKEND_ORIGIN } from "../api/config";

/**
 * Idempotently formats an image URL to ensure it points to the correct local asset path.
 * It ensures the URL has a single `uploads/` prefix and uses the configured backend origin.
 *
 * @param url The raw image URL from the product data.
 * @returns A correctly formatted and absolute URL for the image asset.
 */
export function formatImageUrl(url?: string): string {
  if (!url || url === "null" || url === "undefined") return "";

  const normalized = url.trim().replace(/\\/g, "/");
  if (!normalized) return "";

  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("data:")
  ) {
    return normalized;
  }

  const withoutLeadingSlash = normalized.replace(/^\/+/, "");
  const finalPath = withoutLeadingSlash.startsWith("uploads/")
    ? withoutLeadingSlash
    : `uploads/${withoutLeadingSlash}`;
  return `${BACKEND_ORIGIN}/${finalPath}`;
}

/**
 * Normalizes bounding box data from various formats into a unified percentage-based object.
 * It can parse stringified JSON, arrays `[ymin, xmin, ymax, xmax]`, or objects `{x, y, width, height}`.
 *
 * @param box The raw bounding box data.
 * @returns A BoundingBox object with coordinates as percentages (0-100), or null if parsing fails.
 */
export function normalizeBoundingBox(box: any): BoundingBox | null {
	if (!box) return null;

	let parsedBox = box;
	if (typeof parsedBox === 'string') {
		try {
			parsedBox = JSON.parse(parsedBox);
		} catch (e) { return null; }
	}

	try {
		if (Array.isArray(parsedBox) && parsedBox.length >= 4) {
			const [y1, x1, y2, x2] = parsedBox.map(Number);
			return { x: x1 * 100, y: y1 * 100, width: (x2 - x1) * 100, height: (y2 - y1) * 100 };
		}
		if (typeof parsedBox === 'object' && parsedBox !== null && 'x' in parsedBox && 'y' in parsedBox && 'width' in parsedBox && 'height' in parsedBox) {
			return {
				x: Number(parsedBox.x) * 100,
				y: Number(parsedBox.y) * 100,
				width: Number(parsedBox.width) * 100,
				height: Number(parsedBox.height) * 100,
			};
		}
	} catch (e) { console.error("Bounding box normalization failed", e); }
	return null;
}