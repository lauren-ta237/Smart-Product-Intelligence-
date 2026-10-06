// apps/web/src/pages/utils.ts

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

// --- IMAGE PATH NORMALIZATION ---
export function formatImageUrl(url?: string): string {
  if (!url || url === "null" || url === "undefined" || url === "") {
    return "";
  }

  const normalized = url.trim().replace(/\\/g, "/");
  if (!normalized) return "";

  // Absolute URLs
  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("data:")
  ) return normalized;

  const base = resolveApiOrigin();
  const cleanPath = normalized.startsWith("/") ? normalized : `/${normalized}`;

  return `${base}${cleanPath}`;
}