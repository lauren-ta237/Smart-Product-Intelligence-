import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, PackageCheck } from "lucide-react";
import { getBuyerOrders } from "../../../api/orders";
import BuyerSidebar from "../../../components/BuyerSidebar";
import { useAuth } from "../../../store/auth";
import VendorOrders from "../../../components/vendor/VendorOrders";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value || "Date unavailable"
    : date.toLocaleString();
}

function formatMoney(value: number) {
  return `${Number(value).toLocaleString()} FCFA`;
}

function StatusBadge({ status }: { status?: string | null }) {
  return (
    <span className="inline-flex rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-bold capitalize text-brand">
      {status?.replaceAll("_", " ") || "Unknown"}
    </span>
  );
}

export default function BuyerOrders() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { user } = useAuth();
  const isVendor = user?.role?.toLowerCase() === "vendor";

  const {
    data: orders = [],
    isPending: loading,
    isError: error,
    refetch,
  } = useQuery({
    queryKey: ["buyer-orders", user?.id],
    queryFn: getBuyerOrders,
    enabled: !isVendor,
  });

  if (isVendor) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-white antialiased md:p-10">
        <div className="mx-auto max-w-7xl space-y-8">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <h1 className="text-3xl font-bold">Track Orders</h1>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">Order fulfillment management (FCFA)</p>
            </div>
            <button
              onClick={() => navigate("/vendor/dashboard")}
              className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-black uppercase"
            >
              Back to Dashboard
            </button>
          </header>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
            <VendorOrders />
          </div>
        </div>
      </div>
    );
  }

  const order = orderId ? orders.find((item) => item.id === orderId) : undefined;

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white antialiased sm:p-6 lg:p-10">
      <div className="mx-auto grid max-w-[90rem] grid-cols-1 items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <BuyerSidebar />
        <main className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-1">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand">Buyer dashboard</p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{orderId ? "Order details" : "My orders"}</h1>
              <p className="mt-1 text-sm text-slate-400">
                {orderId ? "Review your order and available fulfillment updates." : "Review order status and fulfillment details."}
              </p>
            </div>
            {orderId && (
              <Link
                to="/buyer/orders"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                <ArrowLeft size={16} /> Back to orders
              </Link>
            )}
          </header>

          {loading ? (
            <div role="status" className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-slate-400">
              Loading your orders…
            </div>
          ) : error ? (
            <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
              <p className="font-semibold text-white">Your orders could not be loaded.</p>
              <p className="mt-2 text-sm text-slate-400">Please check your connection and try again.</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-hover"
              >
                Try again
              </button>
            </div>
          ) : orderId && !order ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
              <PackageCheck size={32} className="mx-auto text-slate-500" />
              <h2 className="mt-4 text-lg font-bold">Order not found</h2>
              <p className="mt-2 text-sm text-slate-400">This order is unavailable or does not belong to your account.</p>
              <Link to="/buyer/orders" className="mt-5 inline-flex rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-hover">
                View my orders
              </Link>
            </div>
          ) : order ? (
            <section className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Order number</p>
                  <p className="mt-2 break-all font-mono text-sm text-slate-200">{order.id}</p>
                  <p className="mt-2 text-sm text-slate-400">Placed {formatDate(order.date)}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Payment status</p>
                  <p className="mt-2 text-sm font-semibold capitalize text-slate-100">
                    {order.payment_status?.toLowerCase() || "Unavailable"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Order status</p>
                  <div className="mt-2"><StatusBadge status={order.status} /></div>
                </div>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-300">Products</h2>
                <div className="divide-y divide-white/10 rounded-2xl border border-white/10">
                  {order.items.map((item, index) => (
                    <div key={`${item.product_id ?? item.product_name}-${index}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-white">{item.product_name}</p>
                        <p className="mt-1 text-sm text-slate-400">Quantity: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm text-slate-200">{formatMoney(item.price)} each</p>
                        <p className="mt-1 text-xs text-slate-500">Line total: {formatMoney(item.price * item.quantity)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {(order.carrier || order.tracking_number || order.estimated_delivery) && (
                <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Delivery information</h2>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    {order.carrier && <div><dt className="text-slate-500">Carrier</dt><dd className="mt-1 text-slate-200">{order.carrier}</dd></div>}
                    {order.tracking_number && <div><dt className="text-slate-500">Tracking number</dt><dd className="mt-1 break-all font-mono text-slate-200">{order.tracking_number}</dd></div>}
                    {order.estimated_delivery && <div><dt className="text-slate-500">Estimated delivery</dt><dd className="mt-1 text-slate-200">{order.estimated_delivery}</dd></div>}
                  </dl>
                </section>
              )}

              <div className="flex items-center justify-between border-t border-white/10 pt-5">
                <span className="font-semibold text-slate-300">Order total</span>
                <span className="text-xl font-black text-emerald-400">{formatMoney(order.total_price)}</span>
              </div>
            </section>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
              <PackageCheck size={32} className="mx-auto text-slate-500" />
              <h2 className="mt-4 font-bold text-white">No orders yet</h2>
              <p className="mt-2 text-sm text-slate-400">Your completed checkouts will appear here.</p>
              <Link to="/" className="mt-5 inline-flex rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-hover">
                Browse products
              </Link>
            </div>
          ) : (
            <section className="space-y-3">
              {orders.map((item) => (
                <Link
                  key={item.id}
                  to={`/dashboard/orders/${encodeURIComponent(item.id)}`}
                  className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand/40 hover:bg-white/[0.05] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-semibold text-white">Order {item.id}</p>
                    <p className="mt-1 text-sm text-slate-400">{formatDate(item.date)}</p>
                  </div>
                  <StatusBadge status={item.status} />
                  <span className="font-mono font-bold text-emerald-400">{formatMoney(item.total_price)}</span>
                </Link>
              ))}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
