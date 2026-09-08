import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../store/cart";
import { useAuth } from "../store/auth";
import { api } from "../api/client";

interface MobileMoneyDetails {
  provider: "MTN" | "Orange";
  phoneNumber: string;
}

interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

type PaymentMethod = "MTN" | "ORANGE";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);

  const { items, clearCart } = useCart();

  const [shipping, setShipping] = useState<ShippingAddress>({
    fullName: user?.email ? user.email.split("@")[0] : "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Cameroon",
  });

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("MTN");

  const [mobileMoney, setMobileMoney] =
    useState<MobileMoneyDetails>({
      provider: "MTN",
      phoneNumber: "+237 ",
    });

  const [activeStep, setActiveStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] =
    useState<boolean>(false);
  const [submitStepText, setSubmitStepText] =
    useState<string>("");
  const [errorMsg, setErrorMsg] =
    useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] =
    useState<boolean>(false);
  const [createdOrderIds, setCreatedOrderIds] =
    useState<string[]>([]);

  const handlePaymentMethodChange = (
    method: PaymentMethod
  ) => {
    setPaymentMethod(method);
    setMobileMoney((prev) => ({
      ...prev,
      provider: method === "MTN" ? "MTN" : "Orange",
    }));
    setErrorMsg(null);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith("+237")) {
      val = "+237 " + val.replace(/^\+?237\s*/, "");
    }
    setMobileMoney({
      ...mobileMoney,
      phoneNumber: val,
    });
  };

  // Pricing calculations performed natively in CFA (XAF)
  const pricingBreakdown = useMemo(() => {
    const subtotal = items.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0
    );
    const shippingCost = subtotal > 30000 ? 0 : 2500;
    const tax = subtotal * 0.01; 
    const total = subtotal + shippingCost + tax;

    return {
      subtotal,
      shippingCost,
      tax,
      total,
    };
  }, [items]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (
      !shipping.fullName.trim() ||
      !shipping.addressLine1.trim() ||
      !shipping.city.trim()
    ) {
      setErrorMsg(
        "Please complete all required fields in the Shipping Address."
      );
      setActiveStep(1);
      return;
    }

    const cleanPhoneNumber = mobileMoney.phoneNumber.replace(/\D/g, "");
    if (cleanPhoneNumber.length < 11) {
      setErrorMsg(
        `Please enter a valid ${
          paymentMethod === "MTN"
            ? "MTN Mobile Money"
            : "Orange Money"
        } phone number.`
      );
      setActiveStep(2);
      return;
    }

    setIsSubmitting(true);
    setSubmitStepText(
      `Verifying ${paymentMethod === "MTN" ? "MTN Mobile Money" : "Orange Money"} payment...`
    );

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSubmitStepText("Creating cross-vendor orders in ledger...");

      const orderPayload = {
        vendor_id: "d03e1cba-0150-45e2-8ee9-8815ce6602e4",
        items: items.map((item) => ({
          product_id: item.id.startsWith("mock-") ? null : item.id,
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        total_price: pricingBreakdown.total,
        payment_method: paymentMethod,
        payment_provider: mobileMoney.provider,
        payment_phone_number: mobileMoney.phoneNumber,
        currency: "XAF",
      };

      const response = await api.post("/orders", orderPayload);

      setSubmitStepText("Syncing transaction ledger clearance...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (response.data && response.data.order_ids) {
        setCreatedOrderIds(response.data.order_ids);
      }

      setShowSuccessModal(true);
      clearCart();
    } catch (err: any) {
      console.error("[PostgreSQL Checkout Syncer Error]:", err);
      setErrorMsg(
        err.response?.data?.detail ||
          "Checkout synchronization failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
      setSubmitStepText("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white p-6 md:p-12 antialiased relative">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-center pb-6 border-b border-white/10">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
              Secure Checkout
            </h1>
            <p className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider">
              🔒 SSL 256-Bit Mobile Money Checkout (XAF)
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
          >
            ← Keep Shopping
          </button>
        </header>

        {errorMsg && (
          <div className="p-4 bg-rose-500/15 border border-rose-500/25 text-rose-400 text-xs rounded-2xl flex items-center gap-2 animate-bounce">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {items.length === 0 && !showSuccessModal ? (
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-16 text-center max-w-lg mx-auto space-y-4">
            <span className="text-5xl block">🛒</span>
            <h2 className="text-xl font-bold">Your Checkout Cart is Empty</h2>
            <button
              onClick={() => navigate("/")}
              className="mt-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl tracking-wider uppercase transition-all shadow-lg cursor-pointer"
            >
              Browse Catalog
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-6">
              
              <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 md:p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-black">1</span>
                    Shipping Destination Address
                  </h3>
                  {activeStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setActiveStep(1)}
                      className="text-xs text-emerald-400 font-bold hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {activeStep === 1 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                        Full Recipient Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={shipping.fullName}
                        onChange={(e) =>
                          setShipping({ ...shipping, fullName: e.target.value })
                        }
                        placeholder="e.g. Jean Dupont"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                        Address Line 1 *
                      </label>
                      <input
                        type="text"
                        required
                        value={shipping.addressLine1}
                        onChange={(e) =>
                          setShipping({ ...shipping, addressLine1: e.target.value })
                        }
                        placeholder="Street Address, P.O. Box"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                        City *
                      </label>
                      <input
                        type="text"
                        required
                        value={shipping.city}
                        onChange={(e) =>
                          setShipping({ ...shipping, city: e.target.value })
                        }
                        placeholder="e.g. Douala"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                        Country *
                      </label>
                      <input
                        type="text"
                        required
                        value={shipping.country}
                        onChange={(e) =>
                          setShipping({ ...shipping, country: e.target.value })
                        }
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="md:col-span-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveStep(2)}
                        className="px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 font-bold rounded-xl tracking-wider uppercase transition-all cursor-pointer"
                      >
                        Proceed to Payment Choice
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs pl-8 font-medium">
                    {shipping.fullName} • {shipping.addressLine1}, {shipping.city}, {shipping.country}
                  </p>
                )}
              </div>

              <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 md:p-8 space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2.5 border-b border-white/5 pb-4">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-black">2</span>
                  Choose Mobile Money Payment
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold uppercase tracking-wider pt-2">
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodChange("MTN")}
                    className={`p-5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                      paymentMethod === "MTN"
                        ? "border-yellow-400 bg-yellow-400/10 text-yellow-400 shadow-md shadow-yellow-500/10"
                        : "border-white/5 bg-slate-950/40 text-slate-400 hover:border-white/10 hover:text-white"
                    }`}
                  >
                    <span className="text-3xl">📱</span>
                    <span className="text-sm font-black">MTN Mobile Money</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePaymentMethodChange("ORANGE")}
                    className={`p-5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                      paymentMethod === "ORANGE"
                        ? "border-orange-500 bg-orange-500/10 text-orange-400 shadow-md shadow-orange-500/10"
                        : "border-white/5 bg-slate-950/40 text-slate-400 hover:border-white/10 hover:text-white"
                    }`}
                  >
                    <span className="text-3xl">📱</span>
                    <span className="text-sm font-black">Orange Money</span>
                  </button>
                </div>

                <div className="pt-4">
                  <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                    <div>
                      <p className="font-bold text-slate-200 text-sm">
                        {paymentMethod === "MTN" ? "📱 MTN Mobile Money" : "📱 Orange Money"}
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        Enter your phone number. Authorized natively in FCFA.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        required
                        value={mobileMoney.phoneNumber}
                        onChange={handlePhoneChange}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 md:p-8 space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2.5 border-b border-white/5 pb-4">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-black">3</span>
                  Review Order
                </h3>
                <ul className="divide-y divide-white/5">
                  {items.map((item) => (
                    <li key={item.id} className="py-4 flex justify-between items-center text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center text-lg">
                          🥦
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{item.name}</p>
                          <p className="text-slate-400 font-mono mt-0.5">
                            {Math.round(item.price).toLocaleString()} FCFA x {item.quantity}
                          </p>
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-slate-200">
                        {Math.round(item.price * item.quantity).toLocaleString()} FCFA
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-6 lg:sticky lg:top-8">
              <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold border-b border-white/5 pb-3">Pricing Summary</h3>
                <div className="space-y-2 text-xs font-medium text-slate-400 font-mono">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="text-slate-200">{Math.round(pricingBreakdown.subtotal).toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping fee</span>
                    <span className="text-slate-200">
                      {pricingBreakdown.shippingCost === 0 ? "FREE" : `${Math.round(pricingBreakdown.shippingCost).toLocaleString()} FCFA`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span className="text-slate-200">{Math.round(pricingBreakdown.tax).toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-white pt-3 border-t border-white/5 font-sans">
                    <span>Total</span>
                    <span className="text-emerald-400 font-black">{Math.round(pricingBreakdown.total).toLocaleString()} FCFA</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting || items.length === 0}
                  onClick={handlePlaceOrder}
                  className="w-full mt-4 py-4 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:from-slate-800 disabled:opacity-50 font-bold text-white rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span className="animate-pulse">{submitStepText || "Processing..."}</span>
                  ) : (
                    `Pay ${Math.round(pricingBreakdown.total).toLocaleString()} FCFA`
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <div className="relative bg-slate-900 border border-white/10 p-8 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl z-10">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-3xl mx-auto text-emerald-400">
              🎉
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight text-white">Order Successful!</h3>
              <p className="text-slate-400 text-xs">
                Your payment of {Math.round(pricingBreakdown.total).toLocaleString()} FCFA was validated.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-white rounded-xl text-xs uppercase tracking-wide cursor-pointer"
            >
              Back to Marketplace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}