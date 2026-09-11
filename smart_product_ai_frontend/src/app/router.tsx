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

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main Buyer Marketplace - Publicly accessible to guests, buyers, vendors, and admins */}
        <Route path="/" element={<Dashboard viewMode="buyer" />} />

        {/* Vendor Dashboard - Protected Route restricted to vendors and admins */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["vendor", "admin"]}>
              <Dashboard viewMode="vendor" />
            </ProtectedRoute>
          }
        />

        {/* Superadmin Dashboard - Protected Route restricted to admins */}
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

        {/* Vendor Audit/Upload routes */}
        <Route
          path="/review"
          element={
            <ProtectedRoute allowedRoles={["vendor", "admin"]}>
              <Review />
            </ProtectedRoute>
          }
        />

        <Route
          path="/upload"
          element={
            <ProtectedRoute allowedRoles={["vendor", "admin"]}>
              <Upload />
            </ProtectedRoute>
          }
        />

        {/* Auxiliary Route Fallbacks */}
        <Route path="/marketplace" element={<Navigate to="/" replace />} />
        <Route path="/orders" element={<Navigate to="/buyer/orders" replace />} />
        <Route path="/wishlist" element={<Navigate to="/" replace />} />

        {/* Fallback 404 Route redirecting to root landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}