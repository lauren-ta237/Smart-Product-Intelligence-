// src/api/imageUtils.ts

import type { BoundingBox } from "../pages/dashboard";

/**
 * Safely formats backend image paths into fully qualified URLs.
 *
 * Handles:
 * - http:// URLs
 * - https:// URLs
 * - blob: URLs
 * - data: URLs
 * - relative backend paths
 * - /uploads/... paths
 * - uploads/... paths
 * - Windows-style backslashes
 *
 * Relative paths are always resolved against the FastAPI backend.
 */
export const formatImageUrl = (
  imagePath?: string | null
): string => {
  if (
    !imagePath ||
    typeof imagePath !== "string" ||
    imagePath === "null" ||
    imagePath === "undefined"
  ) {
    return "";
  }

  // Normalize whitespace and Windows-style paths.
  const normalized = imagePath
    .trim()
    .replace(/\\/g, "/");

  if (!normalized) {
    return "";
  }

  /*
   * ----------------------------------------------------------
   * ALREADY AN ABSOLUTE URL
   * ----------------------------------------------------------
   */

  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:")
  ) {
    return normalized;
  }

  /*
   * ----------------------------------------------------------
   * BLOB URL
   * ----------------------------------------------------------
   *
   * Blob URLs are temporary browser URLs.
   * Do not attempt to convert them into backend URLs.
   * ----------------------------------------------------------
   */

  if (normalized.startsWith("blob:")) {
    return "";
  }

  /*
   * ----------------------------------------------------------
   * FASTAPI BACKEND
   * ----------------------------------------------------------
   *
   * IMPORTANT:
   *
   * Your uploaded images are stored by FastAPI in:
   *
   *     uploads/
   *
   * Therefore a backend value such as:
   *
   *     uploads/iphone.png
   *
   * becomes:
   *
   *     http://localhost:8000/uploads/iphone.png
   *
   * A value such as:
   *
   *     /uploads/iphone.png
   *
   * also becomes:
   *
   *     http://localhost:8000/uploads/iphone.png
   * ----------------------------------------------------------
   */

  const backendHost = "http://localhost:8000";

  const cleanPath = normalized.startsWith("/")
    ? normalized
    : `/${normalized}`;

  return `${backendHost}${cleanPath}`;
};

/**
 * ============================================================
 * NORMALIZE BOUNDING BOX
 * ============================================================
 *
 * Normalizes incoming bounding-box data into the percentage-based
 * BoundingBox format expected by dashboard.tsx.
 *
 * Supported formats:
 *
 * 1. Array:
 *    [ymin, xmin, ymax, xmax]
 *
 * 2. Object:
 *    { x, y, width, height }
 *
 * 3. Object:
 *    { xmin, ymin, xmax, ymax }
 *
 * 4. Object:
 *    { left, top, width, height }
 *
 * Coordinates can be:
 *
 * - normalized 0..1
 * - percentages 0..100
 * - absolute pixel coordinates
 *
 * The dashboard crop renderer expects percentages.
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

  /*
   * ----------------------------------------------------------
   * JSON STRING
   * ----------------------------------------------------------
   *
   * Backend sometimes returns bounding_box as a
   * JSON string rather than an actual object/array.
   */

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  /*
   * ----------------------------------------------------------
   * ARRAY FORMAT
   * ----------------------------------------------------------
   *
   * Expected:
   *
   * [ymin, xmin, ymax, xmax]
   *
   * Example normalized box:
   *
   * [0.10, 0.20, 0.80, 0.90]
   *
   * becomes:
   *
   * x      = 20%
   * y      = 10%
   * width  = 70%
   * height = 70%
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

    /*
     * --------------------------------------------------------
     * NORMALIZED 0..1 COORDINATES
     * --------------------------------------------------------
     */

    if (
      v1 >= 0 &&
      v1 <= 1 &&
      v2 >= 0 &&
      v2 <= 1 &&
      v3 >= 0 &&
      v3 <= 1 &&
      v4 >= 0 &&
      v4 <= 1
    ) {
      const x = v2 * 100;
      const y = v1 * 100;
      const width = (v4 - v2) * 100;
      const height = (v3 - v1) * 100;

      if (
        width <= 0 ||
        height <= 0
      ) {
        return null;
      }

      return {
        x,
        y,
        width,
        height,
      };
    }

    /*
     * --------------------------------------------------------
     * PERCENTAGE COORDINATES 0..100
     * --------------------------------------------------------
     *
     * Example:
     *
     * [10, 20, 80, 90]
     */

    if (
      v1 >= 0 &&
      v1 <= 100 &&
      v2 >= 0 &&
      v2 <= 100 &&
      v3 >= 0 &&
      v3 <= 100 &&
      v4 >= 0 &&
      v4 <= 100
    ) {
      const x = v2;
      const y = v1;
      const width = v4 - v2;
      const height = v3 - v1;

      if (
        width <= 0 ||
        height <= 0
      ) {
        return null;
      }

      return {
        x,
        y,
        width,
        height,
      };
    }

    /*
     * --------------------------------------------------------
     * ABSOLUTE PIXEL COORDINATES
     * --------------------------------------------------------
     *
     * Without the original image dimensions, pixel coordinates
     * cannot be accurately converted into percentages.
     *
     * Therefore these values are returned as-is.
     */

    const x = v2;
    const y = v1;
    const width = v4 - v2;
    const height = v3 - v1;

    if (
      width <= 0 ||
      height <= 0
    ) {
      return null;
    }

    return {
      x,
      y,
      width,
      height,
    };
  }

  /*
   * ----------------------------------------------------------
   * OBJECT FORMAT
   * ----------------------------------------------------------
   *
   * Supported:
   *
   * { x, y, width, height }
   *
   * { xmin, ymin, xmax, ymax }
   *
   * { left, top, width, height }
   */

  if (
    typeof parsed === "object" &&
    parsed !== null
  ) {
    const hasXYWH =
      parsed.x !== undefined &&
      parsed.y !== undefined &&
      parsed.width !== undefined &&
      parsed.height !== undefined;

    const hasMinMax =
      parsed.xmin !== undefined &&
      parsed.ymin !== undefined &&
      parsed.xmax !== undefined &&
      parsed.ymax !== undefined;

    const hasLTRB =
      parsed.left !== undefined &&
      parsed.top !== undefined &&
      parsed.width !== undefined &&
      parsed.height !== undefined;

    let x: number;
    let y: number;
    let width: number;
    let height: number;

    /*
     * { x, y, width, height }
     */

    if (hasXYWH) {
      x = Number(parsed.x);
      y = Number(parsed.y);
      width = Number(parsed.width);
      height = Number(parsed.height);
    }

    /*
     * { xmin, ymin, xmax, ymax }
     */

    else if (hasMinMax) {
      const xmin = Number(parsed.xmin);
      const ymin = Number(parsed.ymin);
      const xmax = Number(parsed.xmax);
      const ymax = Number(parsed.ymax);

      x = xmin;
      y = ymin;
      width = xmax - xmin;
      height = ymax - ymin;
    }

    /*
     * { left, top, width, height }
     */

    else if (hasLTRB) {
      x = Number(parsed.left);
      y = Number(parsed.top);
      width = Number(parsed.width);
      height = Number(parsed.height);
    }

    else {
      return null;
    }

    /*
     * Validate numbers.
     */

    if (
      ![
        x,
        y,
        width,
        height,
      ].every(Number.isFinite)
    ) {
      return null;
    }

    if (
      width <= 0 ||
      height <= 0
    ) {
      return null;
    }

    /*
     * --------------------------------------------------------
     * NORMALIZED 0..1 COORDINATES
     * --------------------------------------------------------
     */

    if (
      x >= 0 &&
      x <= 1 &&
      y >= 0 &&
      y <= 1 &&
      width > 0 &&
      width <= 1 &&
      height > 0 &&
      height <= 1
    ) {
      return {
        x: x * 100,
        y: y * 100,
        width: width * 100,
        height: height * 100,
      };
    }

    /*
     * --------------------------------------------------------
     * PERCENTAGE COORDINATES 0..100
     * --------------------------------------------------------
     */

    if (
      x >= 0 &&
      x <= 100 &&
      y >= 0 &&
      y <= 100 &&
      width > 0 &&
      width <= 100 &&
      height > 0 &&
      height <= 100
    ) {
      return {
        x,
        y,
        width,
        height,
      };
    }

    /*
     * --------------------------------------------------------
     * ABSOLUTE PIXEL COORDINATES
     * --------------------------------------------------------
     *
     * Conversion to percentages requires the original image
     * dimensions, so return the values unchanged.
     */

    return {
      x,
      y,
      width,
      height,
    };
  }

  return null;
};