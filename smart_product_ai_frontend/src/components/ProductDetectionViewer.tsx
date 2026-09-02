import {
  useState,
  useRef,
  useEffect,
  useMemo,
  type CSSProperties,
} from "react";

import { type DetectedProduct } from "../types/products";
import { formatImageUrl } from "../pages/imageUtils";
import { useCart } from "../store/cart";

interface Props {
  imageUrl: string;
  detectedProducts: DetectedProduct[];
  onAddToCart?: (product: DetectedProduct) => void;
  onHoverProduct?: (id: string | null) => void;
  selectedProductId?: string | null;
}

interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ParsedBox {
  product: DetectedProduct;
  index: number;
  box: NormalizedBox;
  styles: CSSProperties;
}

export default function ProductDetectionViewer({
  imageUrl,
  detectedProducts,
  onAddToCart,
  onHoverProduct,
  selectedProductId: externalSelectedId,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);

  const [imgDimensions, setImgDimensions] = useState({
    width: 0,
    height: 0,
  });

  const [internalHoveredId, setInternalHoveredId] =
    useState<string | null>(null);

  const cartStore = useCart();

  const activeSelectedId =
    externalSelectedId !== undefined
      ? externalSelectedId
      : internalHoveredId;

  /*
   * ============================================================
   * IMAGE DIMENSION CALCULATION
   * ============================================================
   */

  const recalculateOverlayDimensions = () => {
    const image = imgRef.current;

    if (!image) return;

    const rect = image.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    setImgDimensions({
      width: rect.width,
      height: rect.height,
    });
  };

  useEffect(() => {
    recalculateOverlayDimensions();

    window.addEventListener(
      "resize",
      recalculateOverlayDimensions
    );

    return () => {
      window.removeEventListener(
        "resize",
        recalculateOverlayDimensions
      );
    };
  }, []);

  /*
   * Recalculate when the detected products or image changes.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      recalculateOverlayDimensions();
    }, 50);

    return () => {
      window.clearTimeout(timer);
    };
  }, [detectedProducts, imageUrl]);

  /*
   * ============================================================
   * CART
   * ============================================================
   */

  const handleAddToCartAction = (
    product: DetectedProduct
  ) => {
    if (onAddToCart) {
      onAddToCart(product);
      return;
    }

    cartStore.addToCart({
      id: product.id,
      name: product.name,
      price: product.price || 5.0,
      category:
        product.category || "Fresh Produce",
      icon: "🥦",
    });
  };

  /*
   * ============================================================
   * HOVER
   * ============================================================
   */

  const handleMouseEnterBox = (id: string) => {
    setInternalHoveredId(id);

    if (onHoverProduct) {
      onHoverProduct(id);
    }
  };

  const handleMouseLeaveBox = () => {
    setInternalHoveredId(null);

    if (onHoverProduct) {
      onHoverProduct(null);
    }
  };

  /*
   * ============================================================
   * BOUNDING BOX PARSER
   * ============================================================
   *
   * Supported formats:
   *
   * 1. Normalized array:
   *    [ymin, xmin, ymax, xmax]
   *
   * 2. Nested array:
   *    [[ymin, xmin, ymax, xmax]]
   *
   * 3. Object:
   *    {
   *      x: 0.30,
   *      y: 0.20,
   *      width: 0.50,
   *      height: 0.50
   *    }
   *
   * 4. JSON strings containing either of the above.
   *
   * Coordinates may be:
   *
   *    0 - 1
   *
   * or:
   *
   *    0 - 100
   *
   * Everything is converted internally to percentages.
   * ============================================================
   */

  const parseBoundingBox = (
    rawBox: unknown
  ): NormalizedBox | null => {
    if (
      rawBox === null ||
      rawBox === undefined
    ) {
      return null;
    }

    let box: unknown = rawBox;

    /*
     * ----------------------------------------------------------
     * JSON STRING
     * ----------------------------------------------------------
     */

    if (typeof box === "string") {
      const trimmed = box.trim();

      if (!trimmed) {
        return null;
      }

      try {
        box = JSON.parse(trimmed);
      } catch (error) {
        console.warn(
          "[BOUNDING BOX] Failed to parse JSON string:",
          rawBox,
          error
        );

        return null;
      }
    }

    /*
     * ----------------------------------------------------------
     * ARRAY FORMAT
     *
     * [ymin, xmin, ymax, xmax]
     *
     * or
     *
     * [[ymin, xmin, ymax, xmax]]
     * ----------------------------------------------------------
     */

    if (Array.isArray(box)) {
      let coords: unknown[] = box;

      /*
       * Flatten one level:
       *
       * [[ymin, xmin, ymax, xmax]]
       */

      if (
        coords.length === 1 &&
        Array.isArray(coords[0])
      ) {
        coords = coords[0] as unknown[];
      }

      if (coords.length < 4) {
        return null;
      }

      const numbers = coords
        .slice(0, 4)
        .map(Number);

      if (
        numbers.some(
          (value) => !Number.isFinite(value)
        )
      ) {
        return null;
      }

      const [
        ymin,
        xmin,
        ymax,
        xmax,
      ] = numbers;

      /*
       * Determine coordinate scale.
       *
       * 0 - 1    => normalized
       * 0 - 100  => percentage
       */

      const maxCoordinate = Math.max(
        Math.abs(ymin),
        Math.abs(xmin),
        Math.abs(ymax),
        Math.abs(xmax)
      );

      const divisor =
        maxCoordinate <= 1.000001
          ? 1
          : 100;

      const y =
        (ymin / divisor) * 100;

      const x =
        (xmin / divisor) * 100;

      const width =
        ((xmax - xmin) / divisor) * 100;

      const height =
        ((ymax - ymin) / divisor) * 100;

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
     *
     * {
     *   x,
     *   y,
     *   width,
     *   height
     * }
     * ----------------------------------------------------------
     */

    if (
      typeof box === "object" &&
      box !== null
    ) {
      const obj = box as Record<
        string,
        unknown
      >;

      const x = Number(obj.x);
      const y = Number(obj.y);
      const width = Number(obj.width);
      const height = Number(obj.height);

      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height)
      ) {
        return null;
      }

      /*
       * Determine coordinate scale.
       */

      const maxCoordinate = Math.max(
        Math.abs(x),
        Math.abs(y),
        Math.abs(width),
        Math.abs(height)
      );

      const divisor =
        maxCoordinate <= 1.000001
          ? 1
          : 100;

      return {
        x: (x / divisor) * 100,
        y: (y / divisor) * 100,
        width: (width / divisor) * 100,
        height: (height / divisor) * 100,
      };
    }

    return null;
  };

  /*
   * ============================================================
   * PARSE ALL PRODUCT BOXES
   * ============================================================
   */

  const parsedBoxes = useMemo<ParsedBox[]>(() => {
    return detectedProducts
      .map(
        (
          product,
          index
        ): ParsedBox | null => {
          const rawBox =
            product.bounding_box;

          const box =
            parseBoundingBox(rawBox);

          console.log(
            `[BOUNDING BOX ${index}]`,
            {
              id: product.id,
              name: product.name,
              raw: rawBox,
              parsed: box,
            }
          );

          console.log("[FULL PRODUCT JSON]", JSON.stringify(product, null, 2)); 
          if (!box) {
            return null;
          }

          /*
           * Reject invalid dimensions.
           */

          if (
            box.width <= 0 ||
            box.height <= 0
          ) {
            console.warn(
              "[BOUNDING BOX] Invalid dimensions:",
              {
                product: product.name,
                box,
              }
            );

            return null;
          }

          /*
           * Keep coordinates inside the image.
           */

          const x = Math.max(
            0,
            Math.min(100, box.x)
          );

          const y = Math.max(
            0,
            Math.min(100, box.y)
          );

          const right = Math.max(
            0,
            Math.min(
              100,
              box.x + box.width
            )
          );

          const bottom = Math.max(
            0,
            Math.min(
              100,
              box.y + box.height
            )
          );

          const width = right - x;
          const height = bottom - y;

          if (
            width <= 0 ||
            height <= 0
          ) {
            return null;
          }

          return {
            product,
            index,
            box: {
              x,
              y,
              width,
              height,
            },
            styles: {
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: `${width}%`,
              height: `${height}%`,
            },
          };
        }
      )
      .filter(
        (
          value
        ): value is ParsedBox =>
          value !== null
      );
  }, [detectedProducts]);

  /*
   * ============================================================
   * IMAGE URL
   * ============================================================
   */

  console.log(
    "[DetectionViewer Received Props Image URL]:",
    imageUrl
  );

  const finalSrc =
    formatImageUrl(imageUrl);

  console.log(
    "[DetectionViewer Formatted Image URL]:",
    finalSrc
  );

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start text-white">

      {/* ========================================================
          IMAGE / DETECTION VIEWER
          ======================================================== */}

      <div className="lg:col-span-2 space-y-3">

        <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          AI Spatial Mapping Overlay
        </span>

        <div
          className="relative w-full min-h-[350px] flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
        >

          {/* ====================================================
              SOURCE IMAGE
              ==================================================== */}

          <img
            ref={imgRef}
            src={
              finalSrc ||
              "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80"
            }
            alt="AI Scan Source"
            className="w-full h-auto max-h-[75vh] object-contain block select-none transition-opacity duration-300"
            onLoad={() => {
              recalculateOverlayDimensions();
            }}
            onError={(event) => {
              console.error(
                "[IMAGE ERROR] Failed to load analysis image source:",
                finalSrc
              );

              /*
               * Do not replace the image source here.
               *
               * Replacing it can cause an infinite error loop
               * if the fallback also fails.
               */
              event.currentTarget.style.opacity =
                "0";
            }}
          />

          {/* ====================================================
              OVERLAY WRAPPER
              ==================================================== */}

          <div
            className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center"
          >
            {imgDimensions.width > 0 &&
              imgDimensions.height > 0 && (
                <div
                  className="relative pointer-events-none"
                  style={{
                    width: imgDimensions.width,
                    height: imgDimensions.height,
                  }}
                >
                  {parsedBoxes.map(
                    ({
                      product,
                      index,
                      styles,
                    }) => {
                      const isFocused =
                        activeSelectedId ===
                        product.id;

                      const confidence =
                        Number(
                          product.confidence_score
                        ) || 0;

                      const confidencePercent =
                        Math.round(
                          confidence * 100
                        );

                      return (
                        <div
                          key={`overlay-box-${product.id || index}`}
                          className="absolute cursor-pointer transition-all duration-150 ease-out pointer-events-auto"
                          style={{
                            ...styles,
                            zIndex:
                              isFocused
                                ? 30
                                : 20,
                          }}
                          onMouseEnter={() =>
                            handleMouseEnterBox(
                              product.id
                            )
                          }
                          onMouseLeave={
                            handleMouseLeaveBox
                          }
                        >

                          {/* Bounding box */}
                          <div
                            className={`w-full h-full border-2 rounded-lg transition-all duration-150 ${
                              isFocused
                                ? "border-emerald-400 bg-emerald-400/20 ring-4 ring-emerald-400/10 shadow-[0_0_20px_rgba(52,211,153,0.4)]"
                                : "border-cyan-400/70 bg-cyan-400/[0.05] hover:border-emerald-400"
                            }`}
                          />

                          {/* Product label */}
                          <div
                            className={`absolute left-0 -top-7 flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[10px] font-black tracking-tight shadow-xl whitespace-nowrap ${
                              isFocused
                                ? "bg-emerald-400 text-slate-950 scale-105"
                                : "bg-cyan-500 text-slate-950"
                            }`}
                          >
                            <span className="truncate max-w-[120px]">
                              {product.name}
                            </span>

                            <span className="opacity-80">
                              (
                              {
                                confidencePercent
                              }
                              %)
                            </span>
                          </div>

                        </div>
                      );
                    }
                  )}
                </div>
              )}
          </div>
        </div>
      </div>

      {/* ========================================================
          DETECTED CATALOG
          ======================================================== */}

      <div className="space-y-4">

        <div className="flex justify-between items-center border-b border-white/5 pb-3">

          <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Detected Catalog
          </span>

          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 font-mono font-bold text-[9px] rounded-full border border-emerald-500/10">
            {detectedProducts.length} Items
          </span>

        </div>

        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">

          {detectedProducts.map(
            (product, index) => {
              const isFocused =
                activeSelectedId ===
                product.id;

              return (
                <div
                  key={
                    product.id || index
                  }
                  onMouseEnter={() =>
                    handleMouseEnterBox(
                      product.id
                    )
                  }
                  onMouseLeave={
                    handleMouseLeaveBox
                  }
                  className={`p-4 rounded-2xl border transition-all duration-200 ${
                    isFocused
                      ? "border-emerald-500 bg-emerald-500/[0.06] shadow-lg scale-[1.02]"
                      : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >

                  <div className="flex justify-between items-start gap-2">

                    <div className="space-y-1">

                      <h4
                        className={`text-xs font-black truncate max-w-[140px] ${
                          isFocused
                            ? "text-emerald-400"
                            : "text-white"
                        }`}
                      >
                        {product.name}
                      </h4>

                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        {product.category ||
                          "General"}
                      </p>

                    </div>

                    <div className="text-right">

                      <span className="font-mono text-emerald-400 font-black text-sm block">
                        $
                        {product.price
                          ? product.price.toFixed(
                              2
                            )
                          : "5.00"}
                      </span>

                    </div>

                  </div>

                  <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">

                    <span className="text-[9px] text-slate-500 font-mono font-bold uppercase">
                      CONF:{" "}
                      {Math.round(
                        (product.confidence_score ||
                          0) * 100
                      )}
                      %
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        handleAddToCartAction(
                          product
                        )
                      }
                      className="px-3 py-1.5 bg-emerald-600 text-slate-950 font-black uppercase text-[9px] rounded-lg hover:bg-emerald-500 transition-colors"
                    >
                      + Add
                    </button>

                  </div>

                </div>
              );
            }
          )}

        </div>
      </div>
    </div>
  );
}