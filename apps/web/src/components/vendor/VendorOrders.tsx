import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useQueryClient } from "@tanstack/react-query";

export interface VendorOrder {
  id: string;
  created_at?: string | null;
  status: string;
  total_price: number;
  tracking_number?: string;
  carrier?: string;
  estimated_delivery?: string;
  buyer_name?: string;
  buyer_contact?: string;
  items: Array<{ product_name: string; quantity: number; price: number }>;
}

export default function VendorOrders() {
  const queryClient = useQueryClient();
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<VendorOrder | null>(null);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [carrierInput, setCarrierInput] = useState("");
  const [trackingInput, setTrackingInput] = useState("");

  const fetchOrders = async () => {
    try {
      const res = await api.get("/orders/vendor");
      setOrders(res.data);
      setError(null);
    } catch (err) {
      setError("Vendor orders could not be loaded. Please retry.");
      console.error("Fulfillment Panel Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    api.get("/orders/vendor")
      .then((res) => {
        if (active) {
          setOrders(res.data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError("Vendor orders could not be loaded. Please retry.");
          console.error("Fulfillment Panel Error:", err);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const handleOpenShippingModal = (order: VendorOrder) => {
    setSelectedOrder(order);
    setCarrierInput(order.carrier || "");
    setTrackingInput(order.tracking_number || "");
  };

  const updateStatus = async (orderId: string, status: string, tracking?: string, carrier?: string) => {
    setUpdating(true);
    setActionError(null);
    try {
      await api.patch(`/orders/${orderId}/status`, {
        status,
        tracking_number: tracking !== undefined ? tracking : selectedOrder?.tracking_number,
        carrier: carrier !== undefined ? carrier : selectedOrder?.carrier,
      });
      await fetchOrders();
      setSelectedOrder(null);
      await queryClient.invalidateQueries({ queryKey: ["dashboard"], refetchType: "active" });
    } catch {
      setActionError("Failed to update order status. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="animate-pulse text-slate-500 text-xs uppercase font-black">Syncing ledger...</div>;
  if (error) return <div role="alert" className="space-y-3 text-sm text-red-300"><p>{error}</p><button type="button" onClick={() => { setLoading(true); void fetchOrders(); }} className="font-bold underline">Retry</button></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Order Fulfillment Ledger (FCFA)</h2>
      {actionError && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{actionError}</p>}
      {orders.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">No orders have been placed with your store yet.</p>}
      <div className="grid grid-cols-1 gap-4">
        {orders.map(order => {
          const currentStatus = order.status ? order.status.toLowerCase() : "";

          return (
            <div key={order.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl space-y-4">
              <div className="flex flex-col md:flex-row justify-between border-b border-white/5 pb-4 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">ID: {order.id}</p>
                  <h4 className="font-bold text-slate-200">{order.buyer_name} ({order.buyer_contact})</h4>
                  {order.created_at && <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString()}</p>}
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 font-black text-xl">{Math.round(order.total_price).toLocaleString()} FCFA</p>
                  <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase">{order.status}</span>
                </div>
              </div>

              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-slate-400">
                    <span className="font-bold">{item.product_name} x{item.quantity}</span>
                    <span className="font-mono">{Math.round(item.price * item.quantity).toLocaleString()} FCFA</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-4">
                <Link to={`/vendor/orders/${encodeURIComponent(order.id)}`} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-brand/40 hover:text-white">
                  Order details
                </Link>
                {currentStatus === "pending" && (
                  <button disabled={updating} onClick={() => updateStatus(order.id, "accepted")} className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer">
                    Confirm Order
                  </button>
                )}
                {currentStatus === "accepted" && (
                  <button disabled={updating} onClick={() => updateStatus(order.id, "preparing")} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer">
                    Start Preparation
                  </button>
                )}
                {currentStatus === "preparing" && (
                  <button disabled={updating} onClick={() => updateStatus(order.id, "packed")} className="bg-amber-600 hover:bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer">
                    Mark Packed
                  </button>
                )}
                {currentStatus === "packed" && (
                  <button disabled={updating} onClick={() => handleOpenShippingModal(order)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer">
                    Assign Shipping
                  </button>
                )}
                {currentStatus === "shipped" && (
                  <button disabled={updating} onClick={() => updateStatus(order.id, "out_for_delivery")} className="bg-teal-600 hover:bg-teal-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer">
                    Out for Delivery
                  </button>
                )}
                {currentStatus === "out_for_delivery" && (
                  <button disabled={updating} onClick={() => updateStatus(order.id, "delivered")} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer">
                    Confirm Delivery
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full space-y-6 shadow-2xl">
            <h3 className="text-xl font-bold">Ship Order</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase">Carrier</label>
                <input 
                  type="text" 
                  value={carrierInput}
                  onChange={(e) => setCarrierInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mt-1 text-sm text-white focus:outline-none focus:border-indigo-500" 
                  placeholder="e.g. DHL" 
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase">Tracking #</label>
                <input 
                  type="text" 
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mt-1 text-sm text-white focus:outline-none focus:border-indigo-500" 
                  placeholder="TRK123456" 
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                disabled={updating}
                onClick={() => updateStatus(selectedOrder.id, "shipped", trackingInput, carrierInput)} 
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold text-xs uppercase transition-all cursor-pointer"
              >
                {updating ? "Saving..." : "Ship Now"}
              </button>
              <button 
                onClick={() => setSelectedOrder(null)} 
                className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl font-bold text-xs uppercase transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}