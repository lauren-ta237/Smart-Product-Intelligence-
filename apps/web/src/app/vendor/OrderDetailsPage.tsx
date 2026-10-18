import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Link, useParams } from "react-router-dom";
import { getVendorOrder, type OrderRecord } from "../../api/orders";

export default function VendorOrderDetailsPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!orderId) return () => { active = false; };
    getVendorOrder(orderId)
      .then((result) => {
        if (active) setOrder(result);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(isAxiosError(requestError) && requestError.response?.status === 404
          ? "This order was not found in your store."
          : "Vendor order details could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [orderId]);

  const visibleError = orderId ? error : "An order ID is required.";

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-5 text-white sm:p-8">
      <Link to="/vendor/orders" className="text-sm font-semibold text-brand hover:text-orange-300">← Back to vendor orders</Link>
      {loading ? (
        <p role="status" className="py-12 text-sm text-slate-400">Loading order details…</p>
      ) : visibleError || !order ? (
        <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">{visibleError ?? "Order not found."}</p>
      ) : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
            <div><p className="text-xs font-bold uppercase tracking-widest text-brand">Store order</p><h1 className="mt-2 break-all text-2xl font-black">Order {order.id}</h1></div>
            <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold uppercase text-slate-300">{order.status.replaceAll("_", " ")}</span>
          </header>
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="font-bold">Items</h2>
            <ul className="mt-4 divide-y divide-white/5">
              {order.items.map((item, index) => <li key={`${item.product_name}-${index}`} className="flex justify-between gap-4 py-3 text-sm"><span>{item.product_name} × {item.quantity}</span><span>{(item.price * item.quantity).toLocaleString()} FCFA</span></li>)}
            </ul>
            <p className="mt-4 border-t border-white/10 pt-4 text-right font-black">Total: {Number(order.total_price).toLocaleString()} FCFA</p>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="font-bold">Shipment information</h2>
            {order.carrier || order.tracking_number || (order.estimated_delivery && order.estimated_delivery !== "Pending Update") ? (
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                {order.carrier && <div><dt className="text-xs text-slate-500">Carrier</dt><dd className="mt-1">{order.carrier}</dd></div>}
                {order.tracking_number && <div><dt className="text-xs text-slate-500">Tracking number</dt><dd className="mt-1 break-all font-mono">{order.tracking_number}</dd></div>}
                {order.estimated_delivery && order.estimated_delivery !== "Pending Update" && <div><dt className="text-xs text-slate-500">Estimated delivery</dt><dd className="mt-1">{order.estimated_delivery}</dd></div>}
              </dl>
            ) : <p className="mt-3 text-sm text-slate-400">Shipment details have not been provided yet.</p>}
          </section>
        </>
      )}
    </main>
  );
}
