import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { Link, useSearchParams } from "react-router-dom";
import { getBuyerOrder, type OrderRecord } from "../../api/orders";

export default function OrderTrackingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";
  const [input, setInput] = useState(orderId);
  const [requestSequence, setRequestSequence] = useState(0);
  const [loadState, setLoadState] = useState<{
    key: string | null;
    order: OrderRecord | null;
    error: string | null;
  }>({ key: null, order: null, error: null });

  useEffect(() => {
    const id = orderId.trim();
    if (!id) return;
    let active = true;
    getBuyerOrder(id)
      .then((result) => {
        if (active) setLoadState({ key: id, order: result, error: null });
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        const message = isAxiosError(requestError) && requestError.response?.status === 404
          ? "No order with that ID was found in your account."
          : isAxiosError(requestError) && requestError.response?.status === 422
            ? "Enter a valid order ID."
            : "Tracking information could not be loaded. Please try again.";
        setLoadState({ key: id, order: null, error: message });
      });
    return () => { active = false; };
  }, [orderId, requestSequence]);

  const loading = Boolean(orderId) && loadState.key !== orderId;
  const order = loadState.key === orderId ? loadState.order : null;
  const error = loadState.key === orderId ? loadState.error : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = input.trim();
    if (!id) {
      setLoadState({ key: "", order: null, error: "Enter an order ID to continue." });
      return;
    }
    setSearchParams({ orderId: id });
    setRequestSequence((sequence) => sequence + 1);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-7 p-5 sm:p-8">
      <header className="border-b border-white/10 pb-5">
        <Link to="/dashboard/orders" className="text-sm font-semibold text-brand hover:text-orange-300">← Order history</Link>
        <h1 className="mt-4 text-3xl font-black">Track an order</h1>
        <p className="mt-2 text-sm text-slate-400">Look up shipment details for an order in your account.</p>
      </header>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="order-id" className="sr-only">Order ID</label>
        <input id="order-id" value={input} onChange={(event) => setInput(event.target.value)} autoComplete="off" placeholder="Enter your order ID" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-brand" />
        <button type="submit" disabled={loading} className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-hover disabled:opacity-60">{loading ? "Looking up…" : "Look up order"}</button>
      </form>
      {loading && <p role="status" className="text-sm text-slate-400">Loading order tracking information…</p>}
      {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
      {!loading && order && (
        <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="break-all font-bold">Order {order.id}</h2>
            <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-bold uppercase text-brand">{order.status.replaceAll("_", " ")}</span>
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-slate-500">Carrier</dt><dd className="mt-1 text-slate-200">{order.carrier || "Not supplied yet"}</dd></div>
            <div><dt className="text-xs text-slate-500">Tracking number</dt><dd className="mt-1 break-all font-mono text-slate-200">{order.tracking_number || "Not supplied yet"}</dd></div>
            {order.estimated_delivery && order.estimated_delivery !== "Pending Update" && (
              <div><dt className="text-xs text-slate-500">Estimated delivery</dt><dd className="mt-1 text-slate-200">{order.estimated_delivery}</dd></div>
            )}
          </dl>
          {!order.carrier && !order.tracking_number && (!order.estimated_delivery || order.estimated_delivery === "Pending Update") && (
            <p className="rounded-xl bg-slate-950/70 p-4 text-sm text-slate-400">The seller has not supplied shipment details yet. This service displays order data only and does not provide live carrier events.</p>
          )}
          <Link to={`/dashboard/orders/${encodeURIComponent(order.id)}`} className="inline-flex text-sm font-bold text-brand hover:text-orange-300">View order details →</Link>
        </section>
      )}
    </main>
  );
}
