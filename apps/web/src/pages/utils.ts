// apps/web/src/pages/utils.ts

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

  // Relative paths from root
  let cleanPath = normalized;
  if (!cleanPath.startsWith("/")) {
    cleanPath = "/" + cleanPath;
  }
  
  return cleanPath;
}