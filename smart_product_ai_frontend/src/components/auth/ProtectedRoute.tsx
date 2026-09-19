import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../store/auth";
import { api } from "../../api/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const token = useAuth((state) => state.token);
  const user = useAuth((state) => state.user);
  const [isReady, setIsReady] = useState(false);
  const location = useLocation();

  useEffect(() => {
    async function initAuth() {
      if (token && (!user || !user.role)) {
        try {
          const res = await api.get("/auth/me");
          if (res.data) {
            useAuth.getState().login(token, res.data);
          }
        } catch {
          // fallback if session check fails
        }
      }
      setIsReady(true);
    }
    initAuth();
  }, [token, user]);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="animate-pulse text-sm text-slate-400">Verifying session permissions...</div>
      </div>
    );
  }

  // Redirect to login if user is unauthenticated
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = String(user?.role || "").trim().toLowerCase();

  // Role-based guard check
  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    if (!normalizedAllowed.includes(userRole)) {
      if ((userRole === "admin" || userRole === "superadmin") && location.pathname !== "/admin") {
        return <Navigate to="/admin" replace />;
      }
      if (userRole === "vendor" && !location.pathname.startsWith("/vendor/")) {
        return <Navigate to="/vendor/dashboard" replace />;
      }
      if (userRole === "buyer" || userRole === "customer") {
        return <Navigate to="/buyer" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}