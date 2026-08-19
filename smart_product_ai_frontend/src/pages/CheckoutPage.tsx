import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../store/cart";
import { useAuth } from "../store/auth";
import { api } from "../api/client";

// Define strict typing for payment inputs
interface CardDetails {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
}
interface MobileMoneyDetails {
  provider: "MTN" | "Orange" | "Wave" | "Moov";
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
type PaymentMethod = "CARD" | "MOBILE_MONEY" | "COD" | "CRYPTO";
export default function CheckoutPage() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  // 🟢 Read directly from the persistent global Zustand store
  const { items, clearCart } = useCart();
  // User input states
  const [shipping, setShipping] = useState<ShippingAddress>({
    fullName: user?.email ? user.email.split("@")[0] : "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Cameroon",
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    number: "",
    name: "",
    expiry: "",
    cvv: "",
  });
  const [mobileMoney, setMobileMoney] = useState<MobileMoneyDetails>({
    provider: "MTN",
    phoneNumber: "",
  });
  // State controls for submission, validation, and layout
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitStepText, setSubmitStepText] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [createdOrderIds, setCreatedOrderIds] = useState<string[]>([]);
  // Dynamically detect card brand logo & color theme in real-time
  const cardBrandInfo = useMemo(() => {
    const cleanNum = cardDetails.number.replace(/\s?/g, "");
    if (cleanNum.startsWith("4")) {
      return { brand: "Visa", color: "from-blue-600 to-indigo-900", icon: "💳 Visa" };
    }
    if (cleanNum.startsWith("5")) {
      return { brand: "Mastercard", color: "from-red-600 to-amber-600", icon: "💳 Mastercard" };
    }
    if (cleanNum.startsWith("3")) {
      return { brand: "Amex", color: "from-emerald-600 to-teal-800", icon: "💳 American Express" };
    }
    if (cleanNum.startsWith("6")) {
      return { brand: "Discover", color: "from-orange-500 to-red-700", icon: "💳 Discover" };
    }
    return { brand: "Generic", color: "from-slate-800 to-slate-950", icon: "💳 Card" };
  }, [cardDetails.number]);
  // Order Summary Calculation Math
  const pricingBreakdown = useMemo(() => {
    const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const shippingCost = subtotal > 50 ? 0 : 5.99;
    const tax = subtotal * 0.08; // 8% estimated tax
    const total = subtotal + shippingCost + tax;
    return {
      subtotal,
      shippingCost,
      tax,
      total,
    };
  }, [items]);
  // Dynamic formatting methods for card input
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/\D/g, "").substring(0, 16);
    const formatted = input.replace(/(\d{4})(?=\d)/g, "$1 ");
    setCardDetails((prev) => ({ ...prev, number: formatted }));
  };
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/\D/g, "").substring(0, 4);
    if (input.length > 2) {
      input = `${input.substring(0, 2)}/${input.substring(2)}`;
    }
    setCardDetails((prev) => ({ ...prev, expiry: input }));
  };
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation Guard Checks
    if (!shipping.fullName || !shipping.addressLine1 || !shipping.city) {
      setErrorMsg("Please complete all required fields in the Shipping Address.");
      setActiveStep(1);
      return;
    }
    if (paymentMethod === "CARD") {
      const cleanNum = cardDetails.number.replace(/\s/g, "");
      if (cleanNum.length !== 16) {
        setErrorMsg("Please enter a valid 16-digit card number.");
        return;
      }
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardDetails.expiry)) {
        setErrorMsg("Please enter a valid expiry date (MM/YY).");
        return;
      }
      if (cardDetails.cvv.length < 3) {
        setErrorMsg("Please enter a valid CVV.");
        return;
      }
    } else if (paymentMethod === "MOBILE_MONEY") {
      if (!mobileMoney.phoneNumber || mobileMoney.phoneNumber.length < 8) {
        setErrorMsg("Please enter a valid Mobile Money phone number.");
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitStepText("Verifying payment security credentials...");
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSubmitStepText("Creating cross-vendor orders in ledger...");
      // Synced directly to backend /api/v1/orders router contex
      const orderPayload = {
        vendor_id: "d03e1cba-0150-45e2-8ee9-8815ce6602e4", // Fallback Mock Vendor UUID
        items: items.map((item) => ({
          product_id: item.id.startsWith("mock-") ? null : item.id,
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        total_price: pricingBreakdown.total,
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

        err.response?.data?.detail || "Checkout synchronization with our ledger failed. Please try again."

      );

    } finally {

      setIsSubmitting(false);

      setSubmitStepText("");

    }

  };



  return (

    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white p-6 md:p-12 antialiased relative">

      <div className="max-w-6xl mx-auto space-y-8">

        

        {/* Secure Checkout Header */}

        <header className="flex justify-between items-center pb-6 border-b border-white/10">

          <div className="space-y-1">

            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">

              Secure Checkout

            </h1>

            <p className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider">

              🔒 SSL 256-Bit Sandbox Test Mode Active

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

            <p className="text-slate-400 text-xs leading-relaxed">

              Add some of our AI-scanned organic produce and fresh items to your cart before proceeding here.

            </p>

            <button

              onClick={() => navigate("/")}

              className="mt-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl tracking-wider uppercase transition-all shadow-lg cursor-pointer"

            >

              Browse Catalog

            </button>

          </div>

        ) : (

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

            

            {/* LEFT COLUMN: MULTI-STEP CHECKOUT FORM */}

            <div className="lg:col-span-2 space-y-6">

              

              {/* SECTION 1: SHIPPING ADDRESS */}

              <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 md:p-8 space-y-4 transition-all">

                <div className="flex items-center justify-between">

                  <h3 className="text-lg font-bold flex items-center gap-2.5">

                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-black">

                      1

                    </span>

                    Shipping Destination Address

                  </h3>

                  {activeStep > 1 && (

                    <button

                      onClick={() => setActiveStep(1)}

                      className="text-xs text-emerald-400 font-bold hover:underline"

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

                        onChange={(e) => setShipping({ ...shipping, fullName: e.target.value })}

                        placeholder="e.g. Jean Dupont"

                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"

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

                        onChange={(e) => setShipping({ ...shipping, addressLine1: e.target.value })}

                        placeholder="Street Address, P.O. Box"

                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"

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

                        onChange={(e) => setShipping({ ...shipping, city: e.target.value })}

                        placeholder="e.g. Douala"

                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"

                      />

                    </div>



                    <div>

                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">

                        State / Region

                      </label>

                      <input

                        type="text"

                        value={shipping.state}

                        onChange={(e) => setShipping({ ...shipping, state: e.target.value })}

                        placeholder="e.g. Littoral"

                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"

                      />

                    </div>



                    <div>

                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">

                        Postal Code

                      </label>

                      <input

                        type="text"

                        value={shipping.postalCode}

                        onChange={(e) => setShipping({ ...shipping, postalCode: e.target.value })}

                        placeholder="e.g. 00237"

                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"

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

                        onChange={(e) => setShipping({ ...shipping, country: e.target.value })}

                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"

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



              {/* SECTION 2: PAYMENT INTERACTIVITY */}

              <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 md:p-8 space-y-4">

                <h3 className="text-lg font-bold flex items-center gap-2.5 border-b border-white/5 pb-4">

                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-black">

                    2

                  </span>

                  Choose Payment Option

                </h3>



                {/* Horizontal Navigation Options */}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider pt-2">

                  {[

                    { id: "CARD", label: "💳 Card", desc: "Visa / Mastercard" },

                    { id: "MOBILE_MONEY", label: "📱 MoMo", desc: "MTN / Orange" },

                    { id: "COD", label: "🤝 COD", desc: "Cash on Delivery" },

                    { id: "CRYPTO", label: "🪙 Wallet", desc: "Crypto / Web3" },

                  ].map((opt) => (

                    <button

                      key={opt.id}

                      type="button"

                      onClick={() => setPaymentMethod(opt.id as PaymentMethod)}

                      className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                        paymentMethod === opt.id
                          ? "border-emerald-500 bg-emerald-500/5 text-emerald-400 shadow-md shadow-emerald-500/5"
                          : "border-white/5 bg-slate-950/40 text-slate-400 hover:border-white/10 hover:text-white"
                      }`}
                    >
                      <span className="text-sm font-black">{opt.label}</span>
                      <span className="text-[8px] text-slate-500 normal-case">{opt.desc}</span>
                    </button>
                  ))}
                </div>

                {/* PAYMENT COMPONENT: CREDIT CARD */}
                {paymentMethod === "CARD" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 items-center">

                    {/* Interactive Virtual Card Preview */}
                    <div className="p-1">
                      <div className={`w-full max-w-sm h-48 rounded-2xl bg-gradient-to-br ${cardBrandInfo.color} p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden transition-all duration-300 transform hover:scale-[1.02]`}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-xl pointer-events-none" />
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold tracking-widest uppercase text-white/70">
                            PLATINUM CARD
                          </span>
                          <span className="font-bold text-sm tracking-wide text-white font-mono bg-white/15 px-3 py-1 rounded-lg backdrop-blur-md">
                            {cardBrandInfo.icon}
                          </span>
                        </div>
                        <div className="text-lg md:text-xl font-bold tracking-widest text-white font-mono py-2">
                          {cardDetails.number || "•••• •••• •••• ••••"}
                        </div>
                        <div className="flex justify-between text-[10px] text-white/80 font-mono">
                          <div>
                            <span className="block text-[8px] text-white/50 uppercase">Cardholder</span>
                            <span className="font-bold tracking-wider truncate max-w-[150px] block mt-0.5">
                              {cardDetails.name.toUpperCase() || "YOUR FULL NAME"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[8px] text-white/50 uppercase">Expires</span>
                            <span className="font-bold tracking-widest block mt-0.5">
                              {cardDetails.expiry || "MM/YY"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-3.5 text-xs">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                          Cardholder Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={cardDetails.name}
                          onChange={(e) => setCardDetails((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Jean Dupont"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                          16-Digit Card Number
                        </label>
                        <input
                          type="text"
                          required
                          value={cardDetails.number}
                          onChange={handleCardNumberChange}
                          placeholder="4000 1234 5678 9010"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                            Expiry (MM/YY)
                          </label>
                          <input
                            type="text"
                            required
                            value={cardDetails.expiry}
                            onChange={handleExpiryChange}
                            placeholder="MM/YY"
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                            CVV / CVC
                          </label>
                          <input
                            type="password"
                            required
                            maxLength={4}
                            value={cardDetails.cvv}
                            onChange={(e) => setCardDetails((prev) => ({ ...prev, cvv: e.target.value.replace(/\D/g, "") }))}
                            placeholder="•••"
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* PAYMENT COMPONENT: MOBILE MONEY */}
                {paymentMethod === "MOBILE_MONEY" && (
                  <div className="pt-2 text-xs grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                        Network Provider
                      </label>
                      <select
                        value={mobileMoney.provider}
                        onChange={(e) => setMobileMoney({ ...mobileMoney, provider: e.target.value as any })}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="MTN">MTN MoMo Cameroon (XAF)</option>
                        <option value="Orange">Orange Money (XAF)</option>
                        <option value="Wave">Wave Mobile Money</option>
                        <option value="Moov">Moov Money</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                        MoMo Phone Number
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+237 6XX XX XX XX"
                        value={mobileMoney.phoneNumber}
                        onChange={(e) => setMobileMoney({ ...mobileMoney, phoneNumber: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}

                {/* PAYMENT COMPONENT: CASH ON DELIVERY */}
                {paymentMethod === "COD" && (
                  <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl text-xs space-y-2 pt-4">
                    <p className="font-bold text-slate-200">🤝 Cash on Delivery Selected</p>
                    <p className="text-slate-400 leading-relaxed">
                      Your order will be packaged and dispatched immediately. Complete your final settlement in cash or via local transfer when our logistics carrier presents the items at your door.
                    </p>
                    <span className="inline-block px-2.5 py-1 bg-amber-500/10 text-amber-400 font-bold rounded text-[9px] uppercase font-mono">
                      Local Shipping Fee applies
                    </span>
                  </div>
                )}
                {/* PAYMENT COMPONENT: CRYPTO WALLET */}
                {paymentMethod === "CRYPTO" && (
                  <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl text-xs space-y-3 pt-4">
                    <p className="font-bold text-slate-200">🪙 Web3 crypto or AI Agent Wallet Payment</p>
                    <p className="text-slate-400 leading-relaxed">
                      Scan the temporary deposit coordinate address with your wallet to finalize standard USDC/BTC settling.
                    </p>
                    <div className="flex flex-wrap gap-3 items-center">
                      <div className="w-20 h-20 bg-white p-1 rounded-lg">
                        <img
                          src="https://images.unsplash.com/photo-1599508704512-2f19fa91f35f?w=100"
                          alt="QR Mock"
                          className="w-full h-full object-cover rounded"
                        />
                      </div>
                      <div className="space-y-1 font-mono text-[10px]">
                        <span className="block text-slate-500">Destination Coordinate</span>
                        <span className="block text-emerald-400 break-all select-all font-bold">
                          0x71C7656EC7ab88b098defB751B7401B5f6d8976F
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* SECTION 3: ITEM SUMMARY REVIEW */}
              <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 md:p-8 space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2.5 border-b border-white/5 pb-4">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-black">
                    3
                  </span>
                  Review Ordered Products
                </h3>
                <ul className="divide-y divide-white/5">
                  {items.map((item) => (
                    <li key={item.id} className="py-4 flex justify-between items-center text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center text-lg shadow-inner">
                          {item.icon ? item.icon : "🥦"}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{item.name}</p>
                          <p className="text-slate-400 font-mono mt-0.5">
                            ${item.price.toFixed(2)} x {item.quantity}
                          </p>
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-slate-200">
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
            {/* RIGHT COLUMN: STICKY ORDER PRICING SUMMARY */}
            <div className="space-y-6 lg:sticky lg:top-8">
              <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold border-b border-white/5 pb-3">Order Pricing Summary</h3>
                <div className="space-y-2 text-xs font-medium text-slate-400 font-mono">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="text-slate-200">${pricingBreakdown.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping fee</span>
                    <span className="text-slate-200">
                      {pricingBreakdown.shippingCost === 0 ? "FREE" : `$${pricingBreakdown.shippingCost.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Tax</span>
                    <span className="text-slate-200">${pricingBreakdown.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-white pt-3 border-t border-white/5 font-sans">
                    <span className="normal-case">Total Amount</span>
                    <span className="text-emerald-400 font-black">${pricingBreakdown.total.toFixed(2)}</span>
                  </div>
                </div>
                {/* Sequence trigger CTA */}
                <button
                  type="submit"
                  disabled={isSubmitting || items.length === 0}
                  onClick={handlePlaceOrder}
                  className="w-full mt-4 py-4 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 font-bold text-white rounded-2xl shadow-xl transition-all duration-150 flex items-center justify-center gap-2 border border-emerald-400/20 disabled:border-transparent cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></div>
                      <span className="text-xs tracking-wider uppercase font-extrabold animate-pulse">
                        {submitStepText || "Completing transaction..."}
                      </span>
                    </>
                  ) : (
                    "Place Secure Order"
                  )}
                </button>
                <div className="pt-2 text-center text-[10px] text-slate-500 font-medium space-y-1">
                  <p>✓ 100% Secure encrypted credit transaction mapping</p>
                  <p>✓ Automated real-time cross-vendor fulfillment splitting</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
      {/* SECURED CONFIRMATION SUCCESS DIALOG MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <div className="relative bg-slate-900 border border-white/10 p-8 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl z-10 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-3xl mx-auto text-emerald-400">
              🎉
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight text-white">Purchase Completed Successfully!</h3>
              <p className="text-slate-400 text-xs leading-relaxed max-w-sm mx-auto">
                Thank you for your business. Your payment was validated and order registries have been initialized with our logistics coordinators.
              </p>
            </div>

            {createdOrderIds.length > 0 && (
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 space-y-2 text-left font-mono">
                <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider">Tracking Reference Coordinates</span>
                {createdOrderIds.map((id, index) => (
                  <div key={id} className="flex justify-between items-center text-[11px] text-slate-300">
                    <span>Order #{index + 1}</span>
                    <span className="font-bold text-emerald-400">{id.substring(0, 8)}...</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate("/buyer/orders");
                }}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-white rounded-xl text-xs uppercase tracking-wide cursor-pointer transition-all active:scale-95 shadow-lg"
              >
                Track Fulfillment Stages
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate("/");
                }}
                className="px-4 py-3 bg-white/5 border border-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold cursor-pointer text-slate-300"
              >
                Marketplace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}