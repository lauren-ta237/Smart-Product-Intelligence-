// apps/web/src/pages/imageUtils.ts

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

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
};
