import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Link, useParams } from "react-router-dom";
import { getBuyerOrder, getBuyerOrders, type OrderRecord } from "../../../api/orders";

function displayDate(value?: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

export default function BuyerOrders() {
  const { orderId } = useParams();
  const [loadState, setLoadState] = useState<{
    key: string | null;
    orders: OrderRecord[];
    order: OrderRecord | null;
    loading: boolean;
    error: string | null;
  }>({ key: null, orders: [], order: null, loading: true, error: null });
  const requestKey = orderId ?? null;

  useEffect(() => {
    let active = true;
    const request = orderId ? getBuyerOrder(orderId) : getBuyerOrders();
    request
      .then((result) => {
        if (!active) return;
        setLoadState({
          key: requestKey,
          orders: orderId ? [] : result as OrderRecord[],
          order: orderId ? result as OrderRecord : null,
          loading: false,
          error: null,
        });
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (isAxiosError(requestError) && requestError.response?.status === 404) {
          setLoadState({ key: requestKey, orders: [], order: null, loading: false, error: "That order was not found in your account." });
        } else if (isAxiosError(requestError) && requestError.response?.status === 422) {
          setLoadState({ key: requestKey, orders: [], order: null, loading: false, error: "The order ID is not valid." });
        } else {
          setLoadState({ key: requestKey, orders: [], order: null, loading: false, error: "Your order information could not be loaded. Please try again." });
        }
      })
    return () => {
      active = false;
    };
  }, [orderId, requestKey]);

  const loading = loadState.key !== requestKey || loadState.loading;
  const error = loadState.key === requestKey ? loadState.error : null;
  const order = loadState.key === requestKey ? loadState.order : null;
  const orders = loadState.key === requestKey ? loadState.orders : [];

  if (loading) {
    return <div className="p-8 text-sm text-slate-400" role="status">Loading order information…</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-5 p-5 sm:p-8">
        <Link to="/dashboard/orders" className="text-sm font-semibold text-brand hover:text-orange-300">← Back to orders</Link>
        <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-300">{error}</div>
      </div>
    );
  }

  if (orderId && order) {
    return (
      <main className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8">
        <Link to="/dashboard/orders" className="text-sm font-semibold text-brand hover:text-orange-300">← Back to order history</Link>
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand">Order details</p>
            <h1 className="mt-2 break-all text-2xl font-black">Order {order.id}</h1>
            <p className="mt-2 text-sm text-slate-400">Placed {displayDate(order.created_at)}</p>
          </div>
          <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-bold uppercase text-brand">{order.status.replaceAll("_", " ")}</span>
        </header>
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h2 className="text-lg font-bold">Items</h2>
          {order.items.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No items are available for this order.</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/5">
              {order.items.map((item, index) => (
                <li key={`${item.product_name}-${index}`} className="flex flex-wrap justify-between gap-2 py-4 text-sm">
                  <span className="text-slate-200">{item.product_name} <span className="text-slate-500">× {item.quantity}</span></span>
                  <span className="font-semibold text-slate-200">{(item.price * item.quantity).toLocaleString()} FCFA</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-between border-t border-white/10 pt-4 font-bold">
            <span>Total</span><span>{Number(order.total_price).toLocaleString()} FCFA</span>
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h2 className="text-lg font-bold">Shipment information</h2>
          {order.carrier || order.tracking_number || (order.estimated_delivery && order.estimated_delivery !== "Pending Update") ? (
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
              {order.carrier && <div><dt className="text-xs text-slate-500">Carrier</dt><dd className="mt-1 text-slate-200">{order.carrier}</dd></div>}
              {order.tracking_number && <div><dt className="text-xs text-slate-500">Tracking number</dt><dd className="mt-1 break-all font-mono text-slate-200">{order.tracking_number}</dd></div>}
              {order.estimated_delivery && order.estimated_delivery !== "Pending Update" && <div><dt className="text-xs text-slate-500">Estimated delivery</dt><dd className="mt-1 text-slate-200">{order.estimated_delivery}</dd></div>}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Shipment details have not been supplied yet. This page does not provide live carrier tracking.</p>
          )}
          <Link to={`/dashboard/track-order?orderId=${encodeURIComponent(order.id)}`} className="mt-5 inline-flex text-sm font-bold text-brand hover:text-orange-300">View tracking information →</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-3xl font-black">My orders</h1>
          <p className="mt-2 text-sm text-slate-400">View order history and shipment information.</p>
        </div>
        <Link to="/dashboard/track-order" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold hover:border-brand/40">Track an order</Link>
      </header>
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <p className="text-sm text-slate-300">You have no orders yet.</p>
          <Link to="/products" className="mt-3 inline-block text-sm font-bold text-brand hover:text-orange-300">Browse products</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((item) => (
            <li key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <Link to={`/dashboard/orders/${encodeURIComponent(item.id)}`} className="font-bold text-white hover:text-brand">Order {item.id}</Link>
                  <p className="mt-1 text-xs text-slate-500">{displayDate(item.created_at)} · {item.items.length} item{item.items.length === 1 ? "" : "s"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold">{Number(item.total_price).toLocaleString()} FCFA</span>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-300">{item.status.replaceAll("_", " ")}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
