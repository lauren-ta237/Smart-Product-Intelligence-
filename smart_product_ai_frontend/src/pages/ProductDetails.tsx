import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProductById } from "../api/products";
import { formatImageUrl } from "../api/imageUtils";
import { useAuth } from "../store/auth";

interface Product {
  id: string | number;
  name?: string;
  category?: string;
  brand?: string;
  price?: number | string;
  suggested_price?: number | string;
  unit_price?: number | string;
  image_url?: string;
  imageUrl?: string;
  stock_quantity?: number;
}

export default function ProductDetails() {
  const { productId } = useParams();
  const user = useAuth((state) => state.user);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProduct() {
      try {
        if (!productId) return;
        const response = await getProductById(productId);
        setProduct(response);
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [productId]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">Loading product...</div>;
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <Link to="/products" className="text-emerald-400 hover:underline">Back to products</Link>
      </div>
    );
  }

  const price = Number(product.price ?? product.suggested_price ?? product.unit_price ?? 0);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <Link to={user ? "/buyer" : "/products"} className="text-sm text-emerald-400 hover:underline">Back to products</Link>
        <section className="grid gap-8 md:grid-cols-2 bg-white/[0.03] border border-white/10 rounded-3xl p-6 md:p-10">
          <div className="h-80 bg-slate-900 rounded-2xl flex items-center justify-center overflow-hidden">
            {product.image_url || product.imageUrl ? (
              <img src={formatImageUrl(product.image_url || product.imageUrl)} alt={product.name || "Product"} className="max-h-full max-w-full object-contain" />
            ) : <span className="text-slate-500">No image available</span>}
          </div>
          <div className="space-y-5">
            <p className="text-xs uppercase tracking-widest text-emerald-400">{product.category || "Product"}</p>
            <h1 className="text-4xl font-black">{product.name || product.brand || "Product"}</h1>
            <p className="text-2xl font-bold text-emerald-400">{Math.round(price).toLocaleString()} FCFA</p>
            <p className="text-sm text-slate-400">{product.stock_quantity ?? 0} units available</p>
            <Link to={user ? "/buyer" : "/"} className="inline-flex bg-emerald-600 hover:bg-emerald-500 px-5 py-3 rounded-xl font-bold text-sm">Continue shopping</Link>
          </div>
        </section>
      </div>
    </main>
  );
}