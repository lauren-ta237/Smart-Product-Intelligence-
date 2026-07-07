import { api } from "./client";

/*
 Gets vendor dashboard statistics.
 Backend will return:
 {
   images: 120,
   products: 450,
   accuracy: 0.96,
   approved: 390
 }
*/
export async function getDashboardStats() {
  const res = await api.get(
    // 🟢 Fixed: Added the missing /v1 prefix to match your backend metrics route
    "/v1/dashboard/stats"
  );
  return res.data;
}