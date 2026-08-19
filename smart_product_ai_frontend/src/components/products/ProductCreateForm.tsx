import React, { useState, useRef } from "react";
import { useProducts } from "../../hooks/useProducts";
import { uploadImage } from "../../api/images";

interface ProductCreateFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ProductCreateForm({ onSuccess, onCancel }: ProductCreateFormProps) {
  const { createProduct, isCreating } = useProducts();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Field States
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [skuUs, setSkuUs] = useState("");
  const [skuCm, setSkuCm] = useState("");
  const [marketSku, setMarketSku] = useState("");
  
  // Media Reference States
  const [imageId, setImageId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Handles async file attachment and maps references
  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setErrorMsg(null);

    try {
      const response = await uploadImage(file);
      setImageId(response.id);
      setImageUrl(response.url);
    } catch (err: any) {
      setErrorMsg("Failed to upload media asset reference. Try again.");
      console.error(err);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Product Name is required.");
      return;
    }

    setErrorMsg(null);

    try {
      await createProduct({
        name,
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        sku: sku.trim() || undefined,
        sku_us: skuUs.trim() || undefined,
        sku_cm: skuCm.trim() || undefined,
        market_sku: marketSku.trim() || undefined,
        image_url: imageUrl || undefined,
        image_id: imageId || undefined,
        approved: false
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Could not save catalog entry.");
    }
  };

  return (
    <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-6 shadow-2xl max-w-2xl w-full text-slate-200">
      <div className="border-b border-white/5 pb-4 mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-white">List Manual Product</h2>
        <p className="text-xs text-slate-400 mt-1">
          Create standard catalog entries with linked local file storage attachments.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
          ⚠️ {errorMsg}
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Core Product Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
              Product Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Premium Soda Bottle"
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
              Brand
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. SonicBound"
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Beverages"
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
              Market Routing SKU
            </label>
            <input
              type="text"
              value={marketSku}
              onChange={(e) => setMarketSku(e.target.value)}
              placeholder="e.g. MKT-COKE-99"
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
        </div>

        {/* Global SKU Mapping */}
        <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5 space-y-3">
          <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Regional Registry SKU Coordinates
          </span>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[9px] text-slate-400 mb-0.5">Base Registry</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU-BASE"
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-2 py-1.5 text-white font-mono text-[10px] focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-400 mb-0.5">US Variant</label>
              <input
                type="text"
                value={skuUs}
                onChange={(e) => setSkuUs(e.target.value)}
                placeholder="SKU-US"
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-2 py-1.5 text-white font-mono text-[10px] focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-400 mb-0.5">CM Variant</label>
              <input
                type="text"
                value={skuCm}
                onChange={(e) => setSkuCm(e.target.value)}
                placeholder="SKU-CM"
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-2 py-1.5 text-white font-mono text-[10px] focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
        </div>

        {/* Description Field */}
        <div>
          <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
            Product Brief Description
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Input summary parameters regarding placement or attributes..."
            className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
          />
        </div>

        {/* Physical Image Reference Linkage */}
        <div className="border border-white/5 bg-slate-950/20 p-4 rounded-xl flex items-center justify-between gap-4">
          <div>
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
              Source Image Reference
            </span>
            {imageUrl ? (
              <span className="text-xs text-emerald-400 font-mono break-all">{imageUrl.substring(0, 42)}...</span>
            ) : (
              <span className="text-xs text-slate-500">No media linked to record.</span>
            )}
          </div>

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageFileChange}
            className="hidden"
          />

          <button
            type="button"
            disabled={uploadingImage}
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-[10px] font-bold uppercase tracking-wide rounded-lg border border-white/10 text-slate-200 transition-colors cursor-pointer shrink-0"
          >
            {uploadingImage ? "Uploading..." : "Attach File"}
          </button>
        </div>

        {/* Action Triggers */}
        <div className="flex gap-3 pt-3 border-t border-white/5">
          <button
            type="submit"
            disabled={isCreating || uploadingImage}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs uppercase tracking-wide shadow-lg disabled:opacity-40 transition-all cursor-pointer"
          >
            {isCreating ? "Listing Asset..." : "Confirm Listing"}
          </button>
          
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 bg-white/5 border border-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-semibold uppercase tracking-wide transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}