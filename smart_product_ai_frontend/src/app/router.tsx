import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Review from "../pages/Review";
import Login from "../features/auth/login";
import Register from "../features/auth/register";
import Dashboard from "../pages/dashboard";
import Upload from "../features/upload/UploadDropzone";
import BuyerOrders from "../app/buyer/orders/page";
import AdminDashboard from "../pages/AdminDashboard";
import CheckoutPage from "../pages/CheckoutPage";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import { useAuth } from "../store/auth";

// A small helper wrapper for the root route to handle guests vs vendors
function RootRouteHandler() {
  const user = useAuth((state) => state.user);
  const rawRole = user?.role?.toLowerCase() || "";

  // If a vendor is logged in, or if they hit root, ensure they have access or redirect if necessary.
  // If they are a guest (no user), they can view the buyer marketplace freely.
  return <Dashboard />;
}

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main Marketplace Dashboard - Open to guests/buyers, but protected/tailored inside if needed */}
        <Route path="/" element={<RootRouteHandler />} />

        {/* Superadmin Dashboard */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Buyer Orders Dashboard */}
        <Route
          path="/buyer/orders"
          element={
            <ProtectedRoute allowedRoles={["buyer", "customer", "vendor", "admin"]}>
              <BuyerOrders />
            </ProtectedRoute>
          }
        />

        {/* Checkout Flow Protected Route */}
        <Route
          path="/checkout"
          element={
            <ProtectedRoute allowedRoles={["buyer", "customer"]}>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />

        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* General Audit/Upload routes */}
        <Route
          path="/review"
          element={
            <ProtectedRoute>
              <Review />
            </ProtectedRoute>
          }
        />

        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <Upload />
            </ProtectedRoute>
          }
        />

        {/* Auxiliary Route Fallbacks for Seamless Experience */}
        <Route path="/marketplace" element={<Navigate to="/" replace />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/orders" element={<Navigate to="/buyer/orders" replace />} />
        <Route path="/wishlist" element={<Navigate to="/" replace />} />
        
        {/* Fallback 404 Route redirecting to root landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}