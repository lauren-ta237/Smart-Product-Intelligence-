import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getBuyerOrders } from "../../api/orders";
import { useAuth } from "../../store/auth";
import { useCart } from "../../store/cart";
import { useWishlist } from "../../store/wishlist";
import { useWishlistSync } from "../../hooks/useWishlistSync";

interface BuyerOrderSummary {
  id: string;
  created_at?: string | null;
  status: string;
  total_price: number;
  items: Array<{ product_name: string; quantity: number; price: number }>;
}

export default function BuyerDashboardPage() {
  const user = useAuth((state) => state.user);
  const cartCount = useCart((state) => state.items.reduce((total, item) => total + item.quantity, 0));
  const wishlist = useWishlist((state) => state.items);
  const wishlistLoading = useWishlist((state) => state.isLoading);
  const wishlistError = useWishlist((state) => state.error);
  const hydrateWishlist = useWishlist((state) => state.hydrateWishlist);
  const location = useLocation();
  const [orders, setOrders] = useState<BuyerOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useWishlistSync();

  useEffect(() => {
    let active = true;
    getBuyerOrders()
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch(() => {
        if (active) setError("Your recent orders could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const newestOrders = orders.slice(0, 3);
  const showProfile = location.hash === "#profile";

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-5 sm:p-8 lg:p-10">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Buyer workspace</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
            {showProfile ? "Your profile" : `Welcome${user?.name ? `, ${user.name}` : " back"}`}
          </h1>
          <p className="mt-2 text-sm text-slate-400">Manage your purchases, saved products, and account.</p>
        </div>
        <Link to="/products" className="inline-flex w-fit items-center rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-hover">
          Browse products
        </Link>
      </header>

      {showProfile ? (
        <section id="profile" className="max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-bold">Account information</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="mt-1 text-slate-200">{user?.email || "Not provided"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Account type</dt>
              <dd className="mt-1 capitalize text-slate-200">{user?.role?.toLowerCase() || "Buyer"}</dd>
            </div>
          </dl>
          <p className="mt-5 text-xs text-slate-500">Profile editing and password management are available through the existing account settings APIs but do not yet have a buyer-facing settings form.</p>
        </section>
      ) : (
        <>
          <section aria-label="Account summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Orders", value: loading ? "…" : orders.length, href: "/buyer/orders" },
              { label: "Saved products", value: wishlistLoading ? "…" : wishlist.length, href: "/buyer/wishlist" },
              { label: "Items in cart", value: cartCount, href: "/buyer/cart" },
              { label: "Account", value: "View profile", href: "/dashboard#profile" },
            ].map((summary) => (
              <Link key={summary.label} to={summary.href} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand/40 hover:bg-white/[0.05]">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{summary.label}</p>
                <p className="mt-3 text-2xl font-black text-white">{summary.value}</p>
              </Link>
            ))}
          </section>

          {(error || wishlistError) && (
            <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {error || wishlistError}
              {wishlistError && user?.id && (
                <button type="button" onClick={() => void hydrateWishlist(user.id!)} className="ml-3 font-bold underline">
                  Retry wishlist
                </button>
              )}
            </div>
          )}

          <section aria-labelledby="recent-orders-title" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 id="recent-orders-title" className="text-lg font-bold">Recent orders</h2>
                <p className="mt-1 text-xs text-slate-500">Order information from your account.</p>
              </div>
              <Link to="/buyer/orders" className="text-sm font-bold text-brand hover:text-orange-300">View all</Link>
            </div>
            {loading ? (
              <p className="py-10 text-center text-sm text-slate-500" role="status">Loading your orders…</p>
            ) : error ? (
              <p className="py-8 text-sm text-slate-400">Order history is temporarily unavailable.</p>
            ) : newestOrders.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-400">You have not placed an order yet.</p>
                <Link to="/products" className="mt-3 inline-block text-sm font-bold text-brand hover:text-orange-300">Explore the marketplace</Link>
              </div>
            ) : (
              <ul className="mt-5 divide-y divide-white/5">
                {newestOrders.map((order) => (
                  <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <Link to={`/buyer/orders/${encodeURIComponent(order.id)}`} className="font-semibold text-white hover:text-brand">
                        Order {order.id.slice(0, 8)}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString() : "Date unavailable"} · {order.items.length} line item{order.items.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-200">{Number(order.total_price).toLocaleString()} FCFA</span>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-300">{String(order.status).replaceAll("_", " ")}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
