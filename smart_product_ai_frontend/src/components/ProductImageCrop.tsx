import React, { useMemo } from "react";
import { formatImageUrl, normalizeBoundingBox } from "../pages/imageUtils";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  imageUrl?: string;
  boundingBox?: any;
  alt?: string;
  className?: string;
}

export default function ProductImageCrop({
  imageUrl,
  boundingBox,
  alt = "Product",
  className = "",
}: Props) {
  const src = formatImageUrl(imageUrl);

  const box = useMemo(() => {
    return normalizeBoundingBox(boundingBox);
  }, [boundingBox]);

  /*
   * No usable bounding box:
   * display the original image normally.
   */
  if (!src || !box || box.width <= 0 || box.height <= 0) {
    return (
      <div
        className={`relative overflow-hidden bg-slate-950 ${className}`}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            📦
          </div>
        )}
      </div>
    );
  }

  /*
   * Convert percentage coordinates into a crop.
   *
   * Example:
   *
   * x = 25
   * y = 20
   * width = 20
   * height = 40
   *
   * The source image is scaled so the bounding box
   * fills the entire viewport.
   */
  const scaleX = 100 / box.width;
  const scaleY = 100 / box.height;

  const left = -(box.x * scaleX);
  const top = -(box.y * scaleY);

  return (
    <div
      className={`relative overflow-hidden bg-slate-950 ${className}`}
    >
      <img
        src={src}
        alt={alt}
        className="absolute max-w-none"
        style={{
          width: `${scaleX}%`,
          height: `${scaleY}%`,
          left: `${left}%`,
          top: `${top}%`,
        }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </div>
  );
}