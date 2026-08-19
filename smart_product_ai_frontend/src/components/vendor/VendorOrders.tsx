// smart_product_ai_frontend/src/components/vendor/VendorOrders.tsx
import React, { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../store/auth";
import { useQueryClient } from "@tanstack/react-query";

export interface VendorOrder {
  id: string;
  date: string;
  status: string;
  total_price: number;
  tracking_number?: string;
  carrier?: string;
  estimated_delivery?: string;
  buyer_name?: string;
  buyer_contact?: string;
  delivery_address?: string;
  items: Array<{ product_name: string; quantity: number; price: number }>;
}

export default function VendorOrders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<VendorOrder | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await api.get("/orders/vendor");
      setOrders(res.data);
    } catch (err) {
      console.error("Fulfillment Panel Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const updateStatus = async (orderId: string, status: string, tracking?: string, carrier?: string) => {
    setUpdating(true);
    try {
      await api.patch(`/orders/${orderId}/status`, {
        status,
        tracking_number: tracking || selectedOrder?.tracking_number,
        carrier: carrier || selectedOrder?.carrier,
        estimated_delivery: "3-5 Business Days"
      });
      fetchOrders();
      setSelectedOrder(null);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      alert("Failed to update status.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="animate-pulse text-slate-500 text-xs">Syncing logs...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Order Fulfillment Ledger</h2>
      <div className="grid grid-cols-1 gap-4">
        {orders.map(order => (
          <div key={order.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl space-y-4">
            <div className="flex flex-col md:flex-row justify-between border-b border-white/5 pb-4 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">ID: {order.id}</p>
                <h4 className="font-bold text-slate-200">{order.buyer_name} ({order.buyer_contact})</h4>
                <p className="text-xs text-slate-400">📍 {order.delivery_address}</p>
              </div>
              <div className="text-right">
                <p className="text-emerald-400 font-black text-xl">${order.total_price.toFixed(2)}</p>
                <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase">{order.status}</span>
              </div>
            </div>

            <div className="space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs text-slate-400">
                  <span>{item.product_name} x{item.quantity}</span>
                  <span className="font-mono">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-4">
              {order.status === "PENDING" && <button onClick={() => updateStatus(order.id, "ACCEPTED")} className="bg-emerald-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-black uppercase">Confirm Order</button>}
              {order.status === "ACCEPTED" && <button onClick={() => updateStatus(order.id, "PREPARING")} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase">Start Preparation</button>}
              {order.status === "PREPARING" && <button onClick={() => updateStatus(order.id, "PACKED")} className="bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-black uppercase">Mark Packed</button>}
              {order.status === "PACKED" && <button onClick={() => setSelectedOrder(order)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase">Assign Shipping</button>}
              {order.status === "SHIPPED" && <button onClick={() => updateStatus(order.id, "OUT_FOR_DELIVERY")} className="bg-teal-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-black uppercase">Out for Delivery</button>}
              {order.status === "OUT_FOR_DELIVERY" && <button onClick={() => updateStatus(order.id, "DELIVERED")} className="bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-black uppercase">Confirm Delivery</button>}
            </div>
          </div>
        ))}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full space-y-6 shadow-2xl">
            <h3 className="text-xl font-bold">Ship Order</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase">Carrier</label>
                <input id="carrier" type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mt-1" placeholder="e.g. DHL" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase">Tracking #</label>
                <input id="track" type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mt-1" placeholder="TRK123456" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => {
                const c = (document.getElementById("carrier") as HTMLInputElement).value;
                const t = (document.getElementById("track") as HTMLInputElement).value;
                updateStatus(selectedOrder.id, "SHIPPED", t, c);
              }} className="flex-1 bg-indigo-600 py-3 rounded-xl font-bold text-xs uppercase">Ship Now</button>
              <button onClick={() => setSelectedOrder(null)} className="flex-1 bg-white/5 py-3 rounded-xl font-bold text-xs uppercase">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}