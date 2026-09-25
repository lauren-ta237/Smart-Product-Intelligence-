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
import ProductCreateForm from "../components/products/ProductCreateForm";
import ApiKeyManager from "../components/developer/ApiKeyManager";
import ProductDetails from "../pages/ProductDetails";

const buyerRoles = ["buyer", "customer"];
const vendorRoles = ["vendor", "admin", "superadmin"];
const adminRoles = ["admin", "superadmin"];

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public marketplace */}
        <Route path="/" element={<Dashboard viewMode="buyer" />} />
        <Route path="/products" element={<Dashboard viewMode="buyer" />} />
        <Route path="/products/:productId" element={<ProductDetails />} />

        {/* Buyer area */}
        <Route
          path="/buyer"
          element={
            <ProtectedRoute allowedRoles={buyerRoles}>
              <Dashboard viewMode="buyer" />
            </ProtectedRoute>
          }
        />
        <Route path="/buyer/cart" element={<ProtectedRoute allowedRoles={buyerRoles}><Dashboard viewMode="buyer" /></ProtectedRoute>} />
        <Route path="/buyer/wishlist" element={<ProtectedRoute allowedRoles={buyerRoles}><Dashboard viewMode="buyer" /></ProtectedRoute>} />
        <Route path="/buyer/checkout" element={<ProtectedRoute allowedRoles={buyerRoles}><CheckoutPage /></ProtectedRoute>} />
        <Route path="/buyer/orders" element={<ProtectedRoute allowedRoles={buyerRoles}><BuyerOrders /></ProtectedRoute>} />
        <Route path="/buyer/orders/:orderId" element={<ProtectedRoute allowedRoles={buyerRoles}><BuyerOrders /></ProtectedRoute>} />
        <Route path="/buyer/profile" element={<ProtectedRoute allowedRoles={buyerRoles}><Dashboard viewMode="buyer" /></ProtectedRoute>} />

        {/* Vendor area */}
        <Route path="/vendor/dashboard" element={<ProtectedRoute allowedRoles={vendorRoles}><Dashboard viewMode="vendor" initialVendorSection="overview" /></ProtectedRoute>} />
        <Route path="/vendor/upload" element={<ProtectedRoute allowedRoles={vendorRoles}><Dashboard viewMode="vendor" initialVendorSection="upload" /></ProtectedRoute>} />
        <Route path="/vendor/products" element={<ProtectedRoute allowedRoles={vendorRoles}><Dashboard viewMode="vendor" initialVendorSection="catalog" /></ProtectedRoute>} />
        <Route path="/vendor/products/new" element={<ProtectedRoute allowedRoles={vendorRoles}><ProductCreateForm /></ProtectedRoute>} />
        <Route path="/vendor/products/:productId/edit" element={<ProtectedRoute allowedRoles={vendorRoles}><ProductCreateForm /></ProtectedRoute>} />
        <Route path="/vendor/ai/upload" element={<Navigate to="/vendor/upload" replace />} />
        <Route path="/vendor/ai/review" element={<ProtectedRoute allowedRoles={vendorRoles}><Review /></ProtectedRoute>} />
        <Route path="/vendor/orders" element={<ProtectedRoute allowedRoles={vendorRoles}><Dashboard viewMode="vendor" initialVendorSection="orders" /></ProtectedRoute>} />
        <Route path="/vendor/orders/:orderId" element={<ProtectedRoute allowedRoles={vendorRoles}><BuyerOrders /></ProtectedRoute>} />
        <Route path="/vendor/apiKeys" element={<ProtectedRoute allowedRoles={vendorRoles}><Dashboard viewMode="vendor" initialVendorSection="developer" /></ProtectedRoute>} />
        <Route path="/vendor/developer/api-keys" element={<Navigate to="/vendor/apiKeys" replace />} />

        {/* Admin area */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={adminRoles}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/users" element={<ProtectedRoute allowedRoles={adminRoles}><AdminDashboard initialTab="admins" /></ProtectedRoute>} />
        <Route path="/admin/vendors" element={<ProtectedRoute allowedRoles={adminRoles}><AdminDashboard initialTab="vendors" /></ProtectedRoute>} />
        <Route path="/admin/products" element={<ProtectedRoute allowedRoles={adminRoles}><AdminDashboard initialTab="moderation" /></ProtectedRoute>} />
        <Route path="/admin/orders" element={<ProtectedRoute allowedRoles={adminRoles}><AdminDashboard initialTab="orders" /></ProtectedRoute>} />
        <Route path="/admin/api-keys" element={<ProtectedRoute allowedRoles={adminRoles}><AdminDashboard initialTab="developers" /></ProtectedRoute>} />
        <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={adminRoles}><AdminDashboard initialTab="overview" /></ProtectedRoute>} />

        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Backward-compatible aliases */}
        <Route path="/dashboard" element={<Navigate to="/vendor/dashboard" replace />} />
        <Route path="/checkout" element={<Navigate to="/buyer/checkout" replace />} />
        <Route path="/upload" element={<Navigate to="/vendor/ai/upload" replace />} />
        <Route path="/review" element={<Navigate to="/vendor/ai/review" replace />} />
        <Route path="/marketplace" element={<Navigate to="/" replace />} />
        <Route path="/orders" element={<Navigate to="/buyer/orders" replace />} />
        <Route path="/wishlist" element={<Navigate to="/buyer/wishlist" replace />} />

        {/* Fallback 404 Route redirecting to root landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}