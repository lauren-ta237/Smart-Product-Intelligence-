import { useState } from "react";
import axios, { AxiosError } from "axios";

// 1. Define explicit interfaces for your cart items and payload
export interface CartItem {
  id: string | number;
  name: string;
  quantity: number;
  price: number;
}

export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface OrderPayload {
  items: Array<{
    product_id: string | number;
    product_name: string;
    quantity: number;
    price: number;
  }>;
  total_price: number;
  payment_method: string;
  shipping_address: ShippingAddress;
}

// Type for FastAPI error responses (e.g., detail message)
interface FastApiErrorDetail {
  detail?: string;
}

export const CheckoutComponent = () => {
  // State variables with strict TypeScript types
  const [paymentMethod, setPaymentMethod] = useState<"card" | "momo" | "cod">("card");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [cardName, setCardName] = useState<string>("");
  const [expiry, setExpiry] = useState<string>("");
  const [cvv, setCvv] = useState<string>("");
  const [momoNumber, setMomoNumber] = useState<string>("");

  const [items, setItems] = useState<CartItem[]>([]);
  const [grandTotal, setGrandTotal] = useState<number>(0);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    fullName: "",
    addressLine1: "",
    city: "",
    postalCode: "",
    country: "",
  });

  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [step, setStep] = useState<"checkout" | "success">("checkout");

  // Clear cart and reset calculated totals
  const checkout = () => {
    setItems([]);
    setGrandTotal(0);
  };

  // Payment Validation & Processing
  const handlePayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");

    // 1. Validation based on selected payment method
    if (paymentMethod === "card") {
      const cleanCardNum = cardNumber.replace(/\s/g, "");

      if (cardName.trim().length < 3) {
        setErrorMessage("Please enter the full name on the card.");
        return;
      }

      if (cleanCardNum.length !== 16) {
        setErrorMessage("Please enter a valid 16-digit card number.");
        return;
      }

      // Validates MM/YY format strictly
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
        setErrorMessage("Please enter a valid expiry date (MM/YY).");
        return;
      }

      if (cvv.length < 3 || cvv.length > 4) {
        setErrorMessage("Please enter a valid CVV.");
        return;
      }
    } else if (paymentMethod === "momo") {
      if (!momoNumber || momoNumber.trim().length < 9) {
        setErrorMessage("Please enter a valid Mobile Money phone number.");
        return;
      }
    }

    // 2. Prevent submitting empty cart orders
    if (!items || items.length === 0) {
      setErrorMessage("Your cart is empty.");
      return;
    }

    setIsProcessing(true);

    try {
      // Construct typed payload
      const orderPayload: OrderPayload = {
        items: items.map((item) => ({
          product_id:
            typeof item.id === "string" && item.id.startsWith("p")
              ? parseInt(item.id.replace("p", ""), 10) || item.id
              : item.id,
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        total_price: grandTotal,
        payment_method: paymentMethod,
        shipping_address: shippingAddress,
      };

      // 3. Send payload to FastAPI backend
      await axios.post("/orders", orderPayload);

      checkout(); // Clear cart and trigger success state
      setStep("success");
    } catch (err: unknown) {
      console.error("[PostgreSQL Checkout Syncer Error]:", err);

      // Strongly-typed error handling for Axios/FastAPI errors
      if (axios.isAxiosError(err)) {
        const serverError = err as AxiosError<FastApiErrorDetail>;
        setErrorMessage(
          serverError.response?.data?.detail || "Fulfillment registry failed. Please try again."
        );
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === "success") {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Order Placed Successfully!</h2>
        <p>Thank you for your purchase.</p>
        <button type="button" onClick={() => setStep("checkout")}>
          Back to Checkout
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "1.5rem" }}>
      <h2>Checkout</h2>

      {errorMessage && (
        <div style={{ color: "red", marginBottom: "1rem" }}>{errorMessage}</div>
      )}

      {/* Cart Summary */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h3>Cart Items ({items.length})</h3>
        {items.length === 0 ? (
          <p>Your cart is empty.</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                {item.name} - x{item.quantity} (${item.price * item.quantity})
              </li>
            ))}
          </ul>
        )}
        <p><strong>Grand Total:</strong> ${grandTotal.toFixed(2)}</p>
      </section>

      <form onSubmit={handlePayment}>
        {/* Shipping Address Inputs */}
        <fieldset style={{ marginBottom: "1.5rem" }}>
          <legend>Shipping Address</legend>
          <input
            type="text"
            placeholder="Full Name"
            value={shippingAddress.fullName}
            onChange={(e) => setShippingAddress({ ...shippingAddress, fullName: e.target.value })}
            style={{ width: "100%", marginBottom: "0.5rem" }}
          />
          <input
            type="text"
            placeholder="Address Line 1"
            value={shippingAddress.addressLine1}
            onChange={(e) => setShippingAddress({ ...shippingAddress, addressLine1: e.target.value })}
            style={{ width: "100%", marginBottom: "0.5rem" }}
          />
          <input
            type="text"
            placeholder="City"
            value={shippingAddress.city}
            onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
            style={{ width: "48%", marginRight: "4%", marginBottom: "0.5rem" }}
          />
          <input
            type="text"
            placeholder="Postal Code"
            value={shippingAddress.postalCode}
            onChange={(e) => setShippingAddress({ ...shippingAddress, postalCode: e.target.value })}
            style={{ width: "48%", marginBottom: "0.5rem" }}
          />
          <input
            type="text"
            placeholder="Country"
            value={shippingAddress.country}
            onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
            style={{ width: "100%" }}
          />
        </fieldset>

        {/* Payment Method Selector */}
        <fieldset style={{ marginBottom: "1.5rem" }}>
          <legend>Payment Method</legend>
          <label style={{ marginRight: "1rem" }}>
            <input
              type="radio"
              value="card"
              checked={paymentMethod === "card"}
              onChange={() => setPaymentMethod("card")}
            />
            Credit/Debit Card
          </label>
          <label style={{ marginRight: "1rem" }}>
            <input
              type="radio"
              value="momo"
              checked={paymentMethod === "momo"}
              onChange={() => setPaymentMethod("momo")}
            />
            Mobile Money
          </label>
          <label>
            <input
              type="radio"
              value="cod"
              checked={paymentMethod === "cod"}
              onChange={() => setPaymentMethod("cod")}
            />
            Cash on Delivery
          </label>
        </fieldset>

        {/* Dynamic Fields for Card Payment */}
        {paymentMethod === "card" && (
          <fieldset style={{ marginBottom: "1.5rem" }}>
            <legend>Card Details</legend>
            <input
              type="text"
              placeholder="Name on Card"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              style={{ width: "100%", marginBottom: "0.5rem" }}
            />
            <input
              type="text"
              placeholder="16-digit Card Number"
              maxLength={16}
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              style={{ width: "100%", marginBottom: "0.5rem" }}
            />
            <input
              type="text"
              placeholder="MM/YY"
              maxLength={5}
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              style={{ width: "48%", marginRight: "4%" }}
            />
            <input
              type="password"
              placeholder="CVV"
              maxLength={4}
              value={cvv}
              onChange={(e) => setCvv(e.target.value)}
              style={{ width: "48%" }}
            />
          </fieldset>
        )}

        {/* Dynamic Fields for Mobile Money */}
        {paymentMethod === "momo" && (
          <fieldset style={{ marginBottom: "1.5rem" }}>
            <legend>Mobile Money Details</legend>
            <input
              type="tel"
              placeholder="Mobile Phone Number"
              value={momoNumber}
              onChange={(e) => setMomoNumber(e.target.value)}
              style={{ width: "100%" }}
            />
          </fieldset>
        )}

        <button type="submit" disabled={isProcessing} style={{ width: "100%", padding: "0.75rem" }}>
          {isProcessing ? "Processing Payment..." : "Place Order"}
        </button>
      </form>
    </div>
  );
};