// apps/web/src/pages/imageUtils.ts

import type { BoundingBox } from "../pages/dashboard";

/**
 * Safely formats backend image paths into fully qualified URLs.
 *
 * Handles:
 * - http:// URLs
 * - https:// URLs
 * - blob: URLs
 * - data: URLs
 * - relative backend paths (e.g. uploads/uuid.jpg)
 * - /uploads/... paths
 * - Windows-style backslashes
 *
 * Relative paths are resolved as absolute paths from the root to 
 * leverage the Vite development proxy or same-origin production hosting.
 */
export const formatImageUrl = (
  imagePath?: string | null
): string => {
  if (
    !imagePath ||
    typeof imagePath !== "string" ||
    imagePath === "null" ||
    imagePath === "undefined" ||
    imagePath.trim() === ""
  ) {
    return "";
  }

  // Normalize whitespace and Windows-style paths.
  const normalized = imagePath
    .trim()
    .replace(/\\/g, "/");

  /*
   * ----------------------------------------------------------
   * ALREADY AN ABSOLUTE URL
   * ----------------------------------------------------------
   */

  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:")
  ) {
    return normalized;
  }

  /*
   * ----------------------------------------------------------
   * FASTAPI BACKEND (RELATIVE RESOLUTION)
   * ----------------------------------------------------------
   *
   * Path resolution logic:
   *
   * We remove hardcoded hosts like 'localhost:8000' to allow the 
   * browser to resolve paths relative to the current origin. 
   * This allows the Vite proxy (in dev) and Nginx (in prod) 
   * to route /uploads/ correctly.
   * ----------------------------------------------------------
   */

  // Clean the path to ensure exactly one leading slash
  let cleanPath = normalized;
  if (!cleanPath.startsWith("/")) {
    cleanPath = "/" + cleanPath;
  }

  return cleanPath;
};

/**
 * ============================================================
 * NORMALIZE BOUNDING BOX
 * ============================================================
 *
 * Normalizes incoming bounding-box data into the percentage-based
 * BoundingBox format expected by dashboard.tsx.
 */
export const normalizeBoundingBox = (
  box: any
): BoundingBox | null => {
  if (
    box === null ||
    box === undefined
  ) {
    return null;
  }

  let parsed = box;

  // Handle JSON stored as a string
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  /*
   * ----------------------------------------------------------
   * ARRAY FORMAT [ymin, xmin, ymax, xmax]
   * ----------------------------------------------------------
   */

  if (Array.isArray(parsed)) {
    const coords = Array.isArray(parsed[0])
      ? parsed[0]
      : parsed;

    if (coords.length < 4) {
      return null;
    }

    const [
      v1,
      v2,
      v3,
      v4,
    ] = coords
      .slice(0, 4)
      .map(Number);

    if (
      ![
        v1,
        v2,
        v3,
        v4,
      ].every(Number.isFinite)
    ) {
      return null;
    }

    // NORMALIZED 0..1 COORDINATES
    if (
      v1 >= 0 && v1 <= 1 &&
      v2 >= 0 && v2 <= 1 &&
      v3 >= 0 && v3 <= 1 &&
      v4 >= 0 && v4 <= 1
    ) {
      const x = v2 * 100;
      const y = v1 * 100;
      const width = (v4 - v2) * 100;
      const height = (v3 - v1) * 100;

      return (width > 0 && height > 0) ? { x, y, width, height } : null;
    }

    // PERCENTAGE COORDINATES 0..100
    const x = v2;
    const y = v1;
    const width = v4 - v2;
    const height = v3 - v1;

    return (width > 0 && height > 0) ? { x, y, width, height } : null;
  }

  /*
   * ----------------------------------------------------------
   * OBJECT FORMAT
   * ----------------------------------------------------------
   */

  if (
    typeof parsed === "object" &&
    parsed !== null
  ) {
    let x: number;
    let y: number;
    let width: number;
    let height: number;

    // { x, y, width, height }
    if (parsed.x !== undefined && parsed.width !== undefined) {
      x = Number(parsed.x);
      y = Number(parsed.y);
      width = Number(parsed.width);
      height = Number(parsed.height);
    }
    // { xmin, ymin, xmax, ymax }
    else if (parsed.xmin !== undefined && parsed.xmax !== undefined) {
      const xmin = Number(parsed.xmin);
      const ymin = Number(parsed.ymin);
      const xmax = Number(parsed.xmax);
      const ymax = Number(parsed.ymax);
      x = xmin;
      y = ymin;
      width = xmax - xmin;
      height = ymax - ymin;
    }
    else {
      return null;
    }

    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      return null;
    }

    // NORMALIZED 0..1 COORDINATES
    if (x <= 1 && y <= 1 && width <= 1 && height <= 1) {
      return {
        x: x * 100,
        y: y * 100,
        width: width * 100,
        height: height * 100,
      };
    }

    return { x, y, width, height };
  }

  return null;
};