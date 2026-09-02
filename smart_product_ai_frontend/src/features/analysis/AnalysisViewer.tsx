import { useState, useEffect } from "react";

import { api } from "../../api/client";

import type {
  DetectedProduct,
  ProductInput,
  ProductBoundingBox,
} from "../../types/products";

import ProductCard from "./ProductCard";
import ProductDetectionViewer from "../../components/ProductDetectionViewer";

interface Props {
  imageUrl: string;
  products: DetectedProduct[];
}

export default function AnalysisViewer({
  imageUrl,
  products: initialProducts,
}: Props) {
  const [products, setProducts] =
    useState<DetectedProduct[]>(initialProducts);

  const [isSaving, setIsSaving] = useState(false);

  const [status, setStatus] =
    useState<string | null>(null);

  const [hoveredId, setHoveredId] =
    useState<string | null>(null);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  /**
   * Convert the bounding_box coming from the detection API
   * into the exact ProductBoundingBox type expected by ProductInput.
   *
   * DetectedProduct currently allows:
   *
   *   ProductBoundingBox | string | null
   *
   * but ProductInput only allows:
   *
   *   ProductBoundingBox | undefined
   *
   * Therefore strings are parsed when possible and invalid
   * values are discarded instead of being sent to the backend.
   */
  const normalizeProductBoundingBox = (
    value: DetectedProduct["bounding_box"]
  ): ProductBoundingBox | undefined => {
    if (value === null || value === undefined) {
      return undefined;
    }

    // Already a valid object/array bounding box.
    if (typeof value === "object") {
      return value as ProductBoundingBox;
    }

    // Detection backend may occasionally return JSON as a string.
    if (typeof value === "string") {
      const trimmed = value.trim();

      if (!trimmed) {
        return undefined;
      }

      try {
        const parsed: unknown = JSON.parse(trimmed);

        if (
          parsed !== null &&
          typeof parsed === "object"
        ) {
          return parsed as ProductBoundingBox;
        }

        console.warn(
          "Bounding box string did not contain an object/array:",
          value
        );

        return undefined;
      } catch (error) {
        console.warn(
          "Could not parse bounding box string:",
          {
            value,
            error,
          }
        );

        return undefined;
      }
    }

    return undefined;
  };

  const handleSaveToDatabase = async () => {
    setIsSaving(true);
    setStatus(null);

    try {
      /*
       * Normalize the image path before sending it
       * to the backend.
       */
      const cleanPath = imageUrl
        .replace(/\\/g, "/")
        .replace(/^https?:\/\/[^/]+\/?/, "")
        .replace(/^\/+/, "");

      /*
       * Convert every detected product into the exact
       * ProductInput shape expected by the backend.
       */
      const payloadProducts: ProductInput[] =
        products.map((p): ProductInput => {
          /*
           * Normalize the bounding box here.
           *
           * This guarantees that payloadProducts can NEVER
           * contain a string or null bounding_box.
           */
          const boundingBox =
            normalizeProductBoundingBox(
              p.bounding_box
            );

          /*
           * Warn if an AI product reaches the publishing
           * stage without bounding-box coordinates.
           *
           * This does NOT prevent saving the product.
           */
          if (!boundingBox) {
            console.warn(
              "Product is missing bounding-box coordinates:",
              {
                id: p.id,
                name: p.name,
                bounding_box: p.bounding_box,
              }
            );
          }

          return {
            name: String(
              p.name || "Unnamed Product"
            ),

            description: String(
              p.description ||
                "AI-detected item"
            ),

            category: String(
              p.category || "General"
            ),

            price:
              Number.isFinite(Number(p.price))
                ? Number(p.price)
                : 0,

            /*
             * Keep the original uploaded image as
             * the primary database image.
             *
             * The individual cropped image is already
             * stored separately in cropped_image_url
             * by the detected product record.
             */
            image_url: cleanPath,

            /*
             * CRITICAL:
             *
             * Send the normalized bounding box.
             *
             * If it is missing, omit the property entirely.
             */
            ...(boundingBox !== undefined
              ? {
                  bounding_box: boundingBox,
                }
              : {}),

            approved: true,

            stock_quantity:
              Number.isFinite(
                Number(p.stock_quantity)
              )
                ? Number(p.stock_quantity)
                : 10,

            /*
             * Preserve additional database-compatible
             * product information when available.
             */
            brand: p.brand ?? undefined,

            sku: p.sku ?? undefined,

            sku_us: p.sku_us ?? undefined,

            sku_cm: p.sku_cm ?? undefined,

            market_sku:
              p.market_sku ?? undefined,

            location:
              p.location ?? undefined,
          };
        });

      /*
       * IMPORTANT DEBUGGING STEP
       *
       * This shows exactly what will be sent to:
       *
       * POST /products/batch-update
       */
      console.log(
        "========== PUBLISH PAYLOAD =========="
      );

      console.table(
        payloadProducts.map((product) => ({
          name: product.name,
          image_url: product.image_url,
          bounding_box:
            JSON.stringify(
              product.bounding_box
            ),
        }))
      );

      console.log(
        "Complete payload:",
        payloadProducts
      );

      console.log(
        "======================================"
      );

      /*
       * Send the complete product payload to the backend.
       */
      const response = await api.post(
        "/products/batch-update",
        payloadProducts
      );

      /*
       * Log the backend response as well.
       */
      console.log(
        "Batch publish response:",
        response.data
      );

      /*
       * Tell the dashboard that products have changed.
       */
      window.dispatchEvent(
        new CustomEvent("products:updated")
      );

      setStatus("success");

      /*
       * Refresh after successful publishing so the
       * dashboard loads the saved database records.
       */
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error(
        "Save Error:",
        error
      );

      setStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ================================
          AI OBJECT DETECTION OVERLAY
          ================================ */}

      <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-4 md:p-6">
        <ProductDetectionViewer
          imageUrl={imageUrl}
          detectedProducts={products}
          selectedProductId={hoveredId}
          onHoverProduct={(id) =>
            setHoveredId(id)
          }
        />
      </div>

      {/* ================================
          REVIEW CARDS + PUBLISH ACTION
          ================================ */}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
            {products.map((p, idx) => (
              <div
                key={p.id || idx}
                onMouseEnter={() =>
                  setHoveredId(p.id)
                }
                onMouseLeave={() =>
                  setHoveredId(null)
                }
                className="transition-transform duration-200"
              >
                <ProductCard
                  product={{
                    ...p,

                    /*
                     * FIX:
                     *
                     * Use the individual AI-cropped image
                     * for the review card.
                     *
                     * Fallback order:
                     *
                     * 1. cropped_image_url
                     * 2. image_url
                     * 3. original imageUrl prop
                     */
                    image_url:
                      p.cropped_image_url ||
                      p.image_url ||
                      imageUrl,
                  }}
                  onUpdate={(updated) =>
                    setProducts((prev) =>
                      prev.map((old) =>
                        old.id === updated.id
                          ? updated
                          : old
                      )
                    )
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {/* ================================
            PUBLISH RESULTS
            ================================ */}

        <div className="space-y-4">
          <div className="bg-white/[0.02] border border-white/10 p-6 rounded-3xl sticky top-8">
            <h3 className="text-xl font-bold mb-2">
              Publish Results
            </h3>

            <p className="text-slate-400 text-xs mb-6">
              Commit these{" "}
              {products.length} detected
              items to the public marketplace
              ledger.
            </p>

            <button
              onClick={
                handleSaveToDatabase
              }
              disabled={
                isSaving ||
                products.length === 0
              }
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl transition-all shadow-xl disabled:opacity-50 cursor-pointer uppercase tracking-widest text-xs"
            >
              {isSaving
                ? "Syncing to Ledger..."
                : "Confirm & Save to DB"}
            </button>

            {status === "success" && (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                <p className="text-emerald-400 text-[10px] font-bold">
                  ✅ Products successfully
                  published.
                </p>

                <p className="text-slate-500 text-[9px] mt-1">
                  Bounding-box coordinates
                  were included.
                </p>
              </div>
            )}

            {status === "error" && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                <p className="text-rose-400 text-[10px] font-bold">
                  ❌ Save Failed:
                  Validation Error
                </p>

                <p className="text-slate-500 text-[9px] mt-1 italic">
                  Check browser console for
                  details
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
