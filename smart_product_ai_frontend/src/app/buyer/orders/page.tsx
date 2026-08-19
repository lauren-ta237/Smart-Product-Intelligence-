
// smart_product_ai_frontend/src/app/buyer/orders/page.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../api/client";

interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
}

interface BuyerOrder {
  id: string;
  date: string;
  status: string;
  total_price: number;
  tracking_number?: string;
  carrier?: string;
  estimated_delivery?: string;
  items: OrderItem[];
}

export default function BuyerOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBuyerOrders = async () => {
    try {
      const res = await api.get("/orders/buyer");
      setOrders(res.data);
    } catch (err) {
      console.error("Order history fetch failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuyerOrders();
  }, []);

  const getStepColor = (currentStatus: string, step: string) => {
    const sequence = [
      "PENDING",
      "ACCEPTED",
      "PREPARING",
      "PACKED",
      "SHIPPED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
    ];

    const currentIndex = sequence.indexOf(currentStatus);
    const stepIndex = sequence.indexOf(step);

    if (currentStatus === "CANCELLED") {
      return "bg-red-500/20 text-red-400";
    }

    if (stepIndex <= currentIndex) {
      return "bg-emerald-500 text-slate-950 font-black";
    }

    return "bg-white/5 text-slate-600";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">
        Syncing Tracking Ledger...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10 antialiased">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex justify-between items-center border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-bold">Shipment Tracking</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
              Real-time Fulfillment Updates
            </p>
          </div>

          <button
            onClick={() => navigate("/")}
            className="bg-white/5 px-6 py-2.5 rounded-xl text-xs font-black uppercase border border-white/10"
          >
            Back to Market
          </button>
        </header>

        <div className="space-y-8">
          {orders.length === 0 ? (
            <p className="text-center py-20 text-slate-600">
              No shipments found.
            </p>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl"
              >
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                  <span className="font-mono text-xs text-slate-500">
                    ID: {order.id}
                  </span>

                  <span className="text-emerald-400 font-black text-lg">
                    ${order.total_price.toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Tracking Status */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                      Tracking Status
                    </h4>

                    <div className="space-y-3">
                      {[
                        "PENDING",
                        "ACCEPTED",
                        "PREPARING",
                        "PACKED",
                        "SHIPPED",
                        "OUT_FOR_DELIVERY",
                        "DELIVERED",
                      ].map((step) => (
                        <div
                          key={step}
                          className="flex items-center gap-4"
                        >
                          <div
                            className={`w-3 h-3 rounded-full ${getStepColor(
                              order.status,
                              step
                            )} shadow-xl`}
                          />

                          <span
                            className={`text-[10px] font-black tracking-widest ${
                              order.status === step
                                ? "text-emerald-400"
                                : "text-slate-500"
                            }`}
                          >
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Logistics + Manifest */}
                  <div className="space-y-6">
                    <div className="bg-slate-950 p-6 rounded-2xl border border-white/5 space-y-4">
                      <h4 className="text-[10px] font-black uppercase text-slate-500">
                        Logistics Info
                      </h4>

                      <div className="space-y-2">
                        <p className="text-xs">
                          Carrier:{" "}
                          <span className="text-slate-200 font-bold">
                            {order.carrier || "Pending Assignment"}
                          </span>
                        </p>

                        <p className="text-xs">
                          Tracking:{" "}
                          <span className="text-slate-200 font-mono font-bold">
                            {order.tracking_number || "Awaiting Dispatch"}
                          </span>
                        </p>

                        <p className="text-xs">
                          Est. Delivery:{" "}
                          <span className="text-slate-200 font-bold">
                            {order.estimated_delivery || "Not available"}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Manifest */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase text-slate-500">
                        Manifest
                      </h4>

                      {order.items && order.items.length > 0 ? (
                        order.items.map((i, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between text-xs font-bold text-slate-300"
                          >
                            <span>
                              {i.product_name} x{i.quantity}
                            </span>

                            <span className="font-mono">
                              ${(i.price * i.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-slate-600 italic">
                          No items listed in manifest.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
