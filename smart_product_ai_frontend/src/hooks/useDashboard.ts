import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "../api/dashboard";
import { useAuth } from "../store/auth";

/*
  React Query handles:
  - loading
  - caching
  - refetching
*/

export function useDashboard() {
  const { user } = useAuth();

  // Only allow fetching if a user session exists and the user is a VENDOR or ADMIN
  const isAuthorized = !!user && (user.role === "VENDOR" || user.role === "ADMIN");

  return useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboardStats,
    // 🛑 Stops React Query from calling the endpoint if the user is a guest, buyer, or unauthenticated
    enabled: isAuthorized,
  });
}