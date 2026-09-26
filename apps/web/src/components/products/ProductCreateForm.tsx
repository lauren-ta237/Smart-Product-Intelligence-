import React, { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useProductDetail, useProducts } from "../../hooks/useProducts";
import { uploadImage } from "../../api/images";

interface ProductCreateFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ProductCreateForm({ onSuccess, onCancel }: ProductCreateFormProps) {
  const { productId } = useParams();
  const isEdit = Boolean(productId);
  const { createProduct, updateProduct, isCreating, isUpdating } = useProducts();
  const { data: existingProduct } = useProductDetail(productId || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Field States
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [stock, setStock] = useState<number>(1);
  
  // Media Reference States
  const [imageId, setImageId] = useState<string | null>(null);
  const [serverImageUrl, setServerImageUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!existingProduct) return;
    setName(existingProduct.name);
    setBrand(existingProduct.brand || "");
    setCategory(existingProduct.category || "General");
    setDescription(existingProduct.description || "");
    setPrice(existingProduct.price ?? "");
    setStock(existingProduct.stock_quantity ?? 1);
    setImageId(existingProduct.image_id);
    setServerImageUrl(existingProduct.image_url || "");
    setPreviewUrl(existingProduct.image_url || null);
  }, [existingProduct]);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handles immediate local preview and async server upload
  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 1. Immediate Local Preview for the UI
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const localBlob = URL.createObjectURL(file);
    setPreviewUrl(localBlob);

    // 2. Upload to existing media infrastructure
    setUploadingImage(true);
    setErrorMsg(null);

    try {
      const response = await uploadImage(file);
      // Corrected: Backend returns storage_url, not url
      if (response && response.id) {
        setImageId(response.id);
        setServerImageUrl(response.storage_url);
      }
    } catch (err: any) {
      setErrorMsg("Failed to upload media asset. Please try another file.");
      setPreviewUrl(null); 
      console.error("[Manual Upload Failure]", err);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || price === "" || price <= 0) {
      setErrorMsg("Please provide a valid product name and price.");
      return;
    }

    if (!imageId) {
      setErrorMsg("Please upload a product image first.");
      return;
    }

    setErrorMsg(null);

    try {
      const payload = {
        name: name.trim(),
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        price: Number(price),
        stock_quantity: Number(stock),
        image_id: imageId,
        image_url: serverImageUrl || undefined,
        approved: true
      };

      console.log("[ProductCreate] Submitting manual payload:", payload);

      if (isEdit && productId) {
        await updateProduct({ id: productId, data: payload });
      } else {
        await createProduct(payload);
      }

      // Notify application of new product insertion
      window.dispatchEvent(new Event("products:updated"));

      // Reset form on success
      setName("");
      setPrice("");
      setBrand("");
      setDescription("");
      setImageId(null);
      setServerImageUrl("");
      setPreviewUrl(null);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Could not save manual catalog entry.");
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl text-slate-200">
        <div className="border-b border-white/10 pb-4 mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📝</span> {isEdit ? "Edit Product" : "Manual Product Entry"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Fill in the details below. Products are published immediately to the Buyer Marketplace.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs flex items-center gap-2">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Visual Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 px-1">
                  Product Image *
                </label>
                <div 
                  onClick={() => !uploadingImage && fileInputRef.current?.click()}
                  className={`relative h-64 w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-200 overflow-hidden ${
                    previewUrl ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/10 bg-slate-950/50 hover:bg-white/[0.02]'
                  } ${uploadingImage ? 'opacity-50 cursor-wait' : ''}`}
                >
                  {previewUrl ? (
                    <>
                      <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span className="bg-slate-900/90 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white">Change Photo</span>
                      </div>
                      {uploadingImage && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mb-2"></div>
                          <span className="text-[9px] font-black uppercase">Syncing...</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-3xl mb-2">{uploadingImage ? '⏳' : '📷'}</span>
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        {uploadingImage ? 'Uploading...' : 'Click to Upload Image'}
                      </span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 px-1">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50 resize-none transition-all"
                  placeholder="e.g. Hand made and available in any quantity..."
                />
              </div>
            </div>

            {/* Attributes Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 px-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. man made basket"
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 px-1">
                    Price (FCFA) *
                  </label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="4000"
                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-emerald-400 font-mono text-sm font-bold focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 px-1">
                    Stock Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 px-1">
                  Category
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 px-1">
                  Brand (Optional)
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Local Craft"
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-6 border-t border-white/10">
            <button
              type="submit"
              disabled={isCreating || isUpdating || uploadingImage}
              className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black rounded-2xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-900/20 cursor-pointer"
            >
              {isCreating || isUpdating ? "Saving..." : isEdit ? "Save Changes" : "Confirm Listing"}
            </button>
            
            <button
              type="button"
              onClick={onCancel}
              className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-bold rounded-2xl text-xs uppercase tracking-widest transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}