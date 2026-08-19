import type { BoundingBox } from "../pages/dashboard";

/**
 * Idempotently formats an image URL to ensure it points to the correct local asset path.
 * It ensures the URL starts with http://localhost:8000/ and has a single `uploads/` prefix.
 *
 * @param url The raw image URL from the product data.
 * @returns A correctly formatted and absolute URL for the image asset.
 */
export function formatImageUrl(url?: string): string {
	if (!url || url === "null" || url === "" || url === "undefined") {
		return "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80";
	}
	if (url.startsWith("http") || url.startsWith("blob:") || url.startsWith("data:")) {
		return url;
	}
	// Ensure path is relative and starts with 'uploads/'
	const cleanPath = url.startsWith("/") ? url.substring(1) : url;
	const final_path = cleanPath.startsWith("uploads/") ? cleanPath : `uploads/${cleanPath}`;
	return `http://localhost:8000/${final_path}`;
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