// apps/web/src/pages/imageUtils.ts

const resolveApiOrigin = (): string => {
  const configured = (
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_ORIGIN ||
    ""
  ).trim();

  if (!configured) {
    return window.location.origin;
  }

  return configured.replace(/\/api\/v1$/i, "").replace(/\/+$/, "");
};

/**
 * Safely formats backend image paths into fully qualified URLs.
 *
 * Handles absolute URLs, browser-local URLs, relative backend paths,
 * and Windows-style separators.
 */
export const formatImageUrl = (imagePath?: string | null): string => {
  if (
    !imagePath ||
    typeof imagePath !== "string" ||
    imagePath === "null" ||
    imagePath === "undefined" ||
    imagePath.trim() === ""
  ) {
    return "";
  }

  const normalized = imagePath.trim().replace(/\\/g, "/");
  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:")
  ) {
    return normalized;
  }

  if (normalized.startsWith("/")) {
    const base = resolveApiOrigin();
    return `${base}${normalized}`;
  }

  const base = resolveApiOrigin();
  return `${base}/${normalized}`;
};
