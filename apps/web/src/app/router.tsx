import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Review from "../pages/Review";
import Login from "../features/auth/login";
import Register from "../features/auth/register";
import Dashboard from "../pages/dashboard";
import BuyerOrders from "../app/buyer/orders/page";
import AdminDashboard from "../pages/AdminDashboard";
import CheckoutPage from "../pages/CheckoutPage";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import ProductCreateForm from "../components/products/ProductCreateForm";
import ProductDetails from "../pages/ProductDetails";
import CatalogBrowsePage from "../pages/CatalogBrowsePage";
import ContactPage from "../pages/ContactPage";
import NotFoundPage from "../pages/NotFoundPage";
import BuyerLayout from "./buyer/BuyerLayout";
import BuyerDashboardPage from "./buyer/DashboardPage";
import WishlistPage from "./buyer/WishlistPage";
import OrderTrackingPage from "./buyer/OrderTrackingPage";
import VendorOrderDetailsPage from "./vendor/OrderDetailsPage";

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
        <Route path="/categories" element={<CatalogBrowsePage mode="categories" />} />
        <Route path="/search" element={<CatalogBrowsePage mode="search" />} />
        <Route path="/contact" element={<ContactPage />} />

        {/* Buyer workspace; access and navigation remain buyer/customer-only. */}
        <Route element={<ProtectedRoute allowedRoles={buyerRoles}><BuyerLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<BuyerDashboardPage />} />
          <Route path="/buyer" element={<Dashboard viewMode="buyer" />} />
          <Route path="/buyer/cart" element={<Dashboard viewMode="buyer" />} />
          <Route path="/buyer/wishlist" element={<WishlistPage />} />
          <Route path="/buyer/checkout" element={<CheckoutPage />} />
          <Route path="/buyer/orders" element={<BuyerOrders />} />
          <Route path="/buyer/orders/:orderId" element={<BuyerOrders />} />
          <Route path="/track-order" element={<OrderTrackingPage />} />
        </Route>
        <Route path="/buyer/profile" element={<Navigate to="/dashboard" replace />} />

        {/* Vendor area */}
        <Route path="/vendor/dashboard" element={<ProtectedRoute allowedRoles={vendorRoles}><Dashboard viewMode="vendor" initialVendorSection="overview" /></ProtectedRoute>} />
        <Route path="/vendor/upload" element={<ProtectedRoute allowedRoles={vendorRoles}><Dashboard viewMode="vendor" initialVendorSection="upload" /></ProtectedRoute>} />
        <Route path="/vendor/products" element={<ProtectedRoute allowedRoles={vendorRoles}><Dashboard viewMode="vendor" initialVendorSection="catalog" /></ProtectedRoute>} />
        <Route path="/vendor/products/new" element={<ProtectedRoute allowedRoles={vendorRoles}><ProductCreateForm /></ProtectedRoute>} />
        <Route path="/vendor/products/:productId/edit" element={<ProtectedRoute allowedRoles={vendorRoles}><ProductCreateForm /></ProtectedRoute>} />
        <Route path="/vendor/ai/upload" element={<Navigate to="/vendor/upload" replace />} />
        <Route path="/vendor/ai/review" element={<ProtectedRoute allowedRoles={vendorRoles}><Review /></ProtectedRoute>} />
        <Route path="/vendor/orders" element={<ProtectedRoute allowedRoles={vendorRoles}><Dashboard viewMode="vendor" initialVendorSection="orders" /></ProtectedRoute>} />
        <Route path="/vendor/orders/:orderId" element={<ProtectedRoute allowedRoles={vendorRoles}><VendorOrderDetailsPage /></ProtectedRoute>} />
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
        <Route path="/checkout" element={<Navigate to="/buyer/checkout" replace />} />
        <Route path="/upload" element={<Navigate to="/vendor/ai/upload" replace />} />
        <Route path="/review" element={<Navigate to="/vendor/ai/review" replace />} />
        <Route path="/marketplace" element={<Navigate to="/" replace />} />
        <Route path="/orders" element={<Navigate to="/buyer/orders" replace />} />
        <Route path="/wishlist" element={<Navigate to="/buyer/wishlist" replace />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}