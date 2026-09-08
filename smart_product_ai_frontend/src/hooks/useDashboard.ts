import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "../api/dashboard";
import { useAuth } from "../store/auth";

/*
  React Query hook for dashboard statistics.
  Modified to prevent unauthorized API calls for visitors or Buyers.
*/

export function useDashboard() {
  const { user, token } = useAuth();

  // Logic Change: Only enable the query if a token exists AND the user has sufficient privileges.
  // This prevents unauthenticated visitors from triggering a 401 and subsequent redirect.
  const isAuthorized = !!token && !!user && (user.role === "VENDOR" || user.role === "ADMIN");

  return useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboardStats,
    // 🛑 Strictly stops the query if the user is a guest, buyer, or unauthenticated.
    enabled: isAuthorized,
  });
}