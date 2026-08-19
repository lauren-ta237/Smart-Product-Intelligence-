// smart_product_ai_frontend/src/api/dashboard.ts
import { api } from "./client";

export async function getDashboardStats() {
  // 🟢 Fixed: Removed /v1 prefix
  const res = await api.get("/dashboard/stats");
  return res.data;
}