import { api } from "./client";

export interface OrderItemInput {
  product_id?: string | null;
  product_name: string;
  quantity: number;
  price: number;
}

export interface CreateOrderPayload {
  items: OrderItemInput[];
  total_price?: number;
}

// 🟢 FIXED: Updated to lowercase values matching the backend OrderStatus model
export interface UpdateOrderStatusPayload {
  status: 
    | "pending" 
    | "accepted" 
    | "preparing" 
    | "packed" 
    | "processing" 
    | "shipped" 
    | "out_for_delivery" 
    | "delivered" 
    | "completed" 
    | "cancelled";
  tracking_number?: string | null;
  carrier?: string | null;
  estimated_delivery?: string | null;
}

// Post a new order (Buyer Checkout)
export const createOrder = async (payload: CreateOrderPayload) => {
  const response = await api.post("/orders", payload);
  return response.data;
};

// Fetch buyer order history
export const getBuyerOrders = async () => {
  const response = await api.get("/orders/buyer");
  return response.data;
};

// Fetch incoming vendor orders
export const getVendorOrders = async () => {
  const response = await api.get("/orders/vendor");
  return response.data;
};

// Update order status/fulfillment (Vendor Panel)
export const updateOrderStatus = async (orderId: string, payload: UpdateOrderStatusPayload) => {
  const response = await api.patch(`/orders/${orderId}/status`, payload);
  return response.data;
};