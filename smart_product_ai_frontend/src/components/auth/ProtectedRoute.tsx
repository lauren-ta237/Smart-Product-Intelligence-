import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../store/auth";

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
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="animate-pulse text-sm text-slate-400">Loading workspace...</div>
      </div>
    );
  }

  // 🟢 1. Redirect to register instead of login if user is unauthenticated
  if (!token) {
    return <Navigate to="/register" replace />;
  }

  const userRole = user?.role?.toLowerCase();

  // 2. Role-based guard check
  if (allowedRoles && allowedRoles.length > 0 && userRole) {
    if (!allowedRoles.includes(userRole)) {
      if ((userRole === "admin" || userRole === "superadmin") && location.pathname !== "/admin") {
        return <Navigate to="/admin" replace />;
      }
      if ((userRole === "buyer" || userRole === "customer") && location.pathname !== "/") {
        return <Navigate to="/" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}