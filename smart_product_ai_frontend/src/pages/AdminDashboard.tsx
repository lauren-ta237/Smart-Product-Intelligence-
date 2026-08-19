import React, { useEffect, useState, useRef } from "react";
import { api } from "../api/client";
import { useNavigate } from "react-router-dom";

// Types
interface PlatformStats {
  total_revenue: number;
  active_vendors: number;
  total_published_products: number;
  total_buyer_orders: number;
  active_api_subscribers: number;
}

interface AIPipelineMetrics {
  completed_jobs: number;
  failed_jobs: number;
  avg_processing_time_seconds: number;
  total_detected_items: number;
}

interface ModerationProduct {
  id: string;
  vendor_id?: string;
  name: string;
  category?: string;
  brand?: string;
  sku?: string;
  price: number;
  stock_quantity: number;
  image_url?: string;
  approved: boolean;
}

interface DeveloperKey {
  id: string;
  developer_id: string;
  prefix: string;
  tier: "FREE" | "PRO" | "ENTERPRISE";
  is_active: boolean;
  calls_made: number;
  rate_limit_max: number;
  developer_email?: string;
  created_at?: string;
}

interface OrderRecord {
  id: string;
  date: string;
  status: string;
  total_price: number;
  tracking_number?: string;
  carrier?: string;
  estimated_delivery?: string;
  items: Array<{ product_name: string; quantity: number; price: number }>;
}

interface RegisteredVendor {
  id: string;
  email: string;
  company_name?: string;
  country?: string;
  city?: string;
  is_active: boolean;
  is_verified: boolean;
}

interface RegisteredAdmin {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  country?: string;
  city?: string;
  language?: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "moderation" | "vendors" | "developers" | "orders" | "admins">("overview");

  // State
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [aiMetrics, setAIMetrics] = useState<AIPipelineMetrics | null>(null);
  const [products, setProducts] = useState<ModerationProduct[]>([]);
  const [devKeys, setDevKeys] = useState<DeveloperKey[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [vendors, setVendors] = useState<RegisteredVendor[]>([]);
  const [adminsList, setAdminsList] = useState<RegisteredAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  // Price Suggestion State
  const [suggestName, setSuggestName] = useState("");
  const [suggestGrade, setSuggestGrade] = useState("Grade A Premium");
  const [suggestedPrice, setSuggestedPrice] = useState<{ min: number; target: number; max: number } | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // 🔌 Redesigned UX State for API Key Generation
  const [genDevId, setGenDevId] = useState("");
  const [genTier, setGenTier] = useState<"FREE" | "PRO" | "ENTERPRISE">("FREE");
  const [genRateLimit, setGenRateLimit] = useState(1000);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // Dynamic eligible user search for issuing keys
  const [userQuery, setUserQuery] = useState("");
  const [eligibleUsers, setEligibleUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 👥 Admin Management State
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminModalMode, setAdminModalMode] = useState<"create" | "edit" | "reset">("create");
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminCountry, setAdminCountry] = useState("Cameroon");
  const [adminCity, setAdminCity] = useState("Yaounde");
  const [adminLanguage, setAdminLanguage] = useState("en");
  const [adminIsActive, setAdminIsActive] = useState(true);
  const [adminModalError, setAdminModalError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, aiRes, prodRes, keyRes, ordRes, vendRes, adminRes] = await Promise.all([
        api.get("/admin/analytics"),
        api.get("/admin/ai-pipeline"),
        api.get("/admin/moderation"),
        api.get("/admin/api-keys"),
        api.get("/orders/buyer"), // Reuse global order viewer lists safely
        api.get("/admin/vendors"),
        api.get("/admin/admins")
      ]);

      setStats(statsRes.data);
      setAIMetrics(aiRes.data);
      setProducts(prodRes.data);
      setDevKeys(keyRes.data);
      setOrders(ordRes.data);
      setVendors(vendRes.data);
      setAdminsList(adminRes.data);
    } catch (err) {
      console.error("Failed to load superadmin metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Debounced search for Key Issuing Dropdown
  useEffect(() => {
    if (!userQuery.trim()) {
      setEligibleUsers([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const res = await api.get(`/admin/users?q=${encodeURIComponent(userQuery)}`);
        setEligibleUsers(res.data);
      } catch (err) {
        console.error("Error fetching eligible users:", err);
      } finally {
        setUserSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [userQuery]);

  // Handle outside dropdown clicks
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePriceSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestName.trim()) return;

    setSuggestLoading(true);
    setSuggestedPrice(null);
    try {
      const res = await api.post("/admin/price-suggestion", {
        product_name: suggestName,
        grade: suggestGrade
      });
      setSuggestedPrice({
        min: res.data.min_price,
        target: res.data.target_price,
        max: res.data.max_price
      });
    } catch (err) {
      alert("Pricing calculation failed.");
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleModerateProduct = async (productId: string, approved: boolean, targetPrice?: number) => {
    try {
      await api.patch(`/admin/moderation/${productId}`, null, {
        params: {
          approved,
          price: targetPrice
        }
      });
      fetchData(); // Refresh metrics list
    } catch (err) {
      alert("Failed to moderate product.");
    }
  };

  const handleCreateAPIKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genDevId) {
      alert("Please search and select an eligible user first.");
      return;
    }

    try {
      const res = await api.post("/admin/api-keys", {
        developer_id: genDevId,
        tier: genTier,
        rate_limit_max: Number(genRateLimit)
      });
      setNewlyCreatedKey(res.data.raw_key);
      setGenDevId("");
      setSelectedUser(null);
      setUserQuery("");
      fetchData(); // Immediately refresh the API key table
    } catch (err) {
      alert("Failed to generate API Key.");
    }
  };

  const handleRevokeAPIKey = async (keyId: string) => {
    try {
      await api.post(`/admin/api-keys/${keyId}/revoke`);
      fetchData();
    } catch (err) {
      alert("Failed to toggle key status.");
    }
  };

  const handleToggleVendor = async (vendorId: string, isActive: boolean, isVerified: boolean) => {
    try {
      await api.patch(`/admin/vendors/${vendorId}/status`, null, {
        params: {
          is_active: isActive,
          is_verified: isVerified
        }
      });
      fetchData();
    } catch (err) {
      alert("Failed to override vendor profile status.");
    }
  };

  // 👥 Admin Management Actions
  const handleOpenCreateAdmin = () => {
    setAdminModalMode("create");
    setAdminEmail("");
    setAdminPassword("");
    setAdminFirstName("");
    setAdminLastName("");
    setAdminCountry("Cameroon");
    setAdminCity("Yaounde");
    setAdminLanguage("en");
    setAdminIsActive(true);
    setAdminModalError("");
    setAdminModalOpen(true);
  };

  const handleOpenEditAdmin = (admin: RegisteredAdmin) => {
    setAdminModalMode("edit");
    setSelectedAdminId(admin.id);
    setAdminEmail(admin.email);
    setAdminFirstName(admin.first_name || "");
    setAdminLastName(admin.last_name || "");
    setAdminCountry(admin.country || "Cameroon");
    setAdminCity(admin.city || "Yaounde");
    setAdminLanguage(admin.language || "en");
    setAdminIsActive(admin.is_active);
    setAdminModalError("");
    setAdminModalOpen(true);
  };

  const handleOpenResetPassword = (adminId: string) => {
    setAdminModalMode("reset");
    setSelectedAdminId(adminId);
    setAdminPassword("");
    setAdminModalError("");
    setAdminModalOpen(true);
  };

  const handleAdminFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminModalError("");

    try {
      if (adminModalMode === "create") {
        await api.post("/admin/admins", {
          email: adminEmail,
          password: adminPassword,
          first_name: adminFirstName.trim() || null,
          last_name: adminLastName.trim() || null,
          country: adminCountry.trim() || null,
          city: adminCity.trim() || null,
          language: adminLanguage
        });
      } else if (adminModalMode === "edit") {
        if (!selectedAdminId) return;
        await api.patch(`/admin/admins/${selectedAdminId}`, {
          email: adminEmail,
          first_name: adminFirstName.trim() || null,
          last_name: adminLastName.trim() || null,
          country: adminCountry.trim() || null,
          city: adminCity.trim() || null,
          language: adminLanguage,
          is_active: adminIsActive
        });
      } else if (adminModalMode === "reset") {
        if (!selectedAdminId) return;
        await api.post(`/admin/admins/${selectedAdminId}/reset-password`, {
          new_password: adminPassword
        });
      }
      setAdminModalOpen(false);
      fetchData(); // Immediately refresh administration registries
    } catch (err: any) {
      setAdminModalError(err.response?.data?.detail || "An error occurred handling admin registry details.");
    }
  };

  const handleToggleAdminStatus = async (admin: RegisteredAdmin) => {
    try {
      await api.patch(`/admin/admins/${admin.id}`, {
        is_active: !admin.is_active
      });
      fetchData();
    } catch (err) {
      alert("Failed to toggle account active state.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-slate-400 font-medium">Syncing Superadmin Control Portal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white antialiased p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="bg-white/[0.02] backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Superadmin Control Portal
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              Global Platform Metrics, AI Pipeline Monitoring, Moderation, & Developer API Ecosystem Management
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
          >
            ← View Marketplace
          </button>
        </header>

        {/* TAB CONTROLS */}
        <div className="flex flex-wrap items-center bg-white/[0.03] border border-white/5 p-2 rounded-2xl gap-2 text-xs font-semibold font-mono">
          {[
            { id: "overview", label: "📊 Analytics & AI" },
            { id: "moderation", label: "🛡️ Moderation" },
            { id: "vendors", label: "🏬 Vendors" },
            { id: "developers", label: "🔌 API Keys" },
            { id: "admins", label: "👥 Administrators" },
            { id: "orders", label: "🛒 Order Logs" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ========================================== */}
        {/* TAB 1: PLATFORM OVERVIEW */}
        {/* ========================================== */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">Total Revenue</span>
                <h3 className="text-3xl font-black text-emerald-400 mt-2">${stats?.total_revenue?.toFixed(2)}</h3>
              </div>
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">Active Vendors</span>
                <h3 className="text-3xl font-black text-slate-100 mt-2">{stats?.active_vendors}</h3>
              </div>
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">Published Products</span>
                <h3 className="text-3xl font-black text-slate-100 mt-2">{stats?.total_published_products}</h3>
              </div>
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">Total Orders</span>
                <h3 className="text-3xl font-black text-slate-100 mt-2">{stats?.total_buyer_orders}</h3>
              </div>
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">API Subscribers</span>
                <h3 className="text-3xl font-black text-indigo-400 mt-2">{stats?.active_api_subscribers}</h3>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-start">
              {/* AI Gemini 2.5 Monitor */}
              <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 space-y-4">
                <h3 className="text-lg font-bold tracking-tight">Gemini 2.5 Flash Pipeline Status</h3>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-950 p-4 rounded-xl border border-white/5">
                    <span className="text-slate-500 font-bold uppercase tracking-wider block text-[9px]">Completed Jobs</span>
                    <span className="text-xl font-bold text-emerald-400 block mt-1">{aiMetrics?.completed_jobs}</span>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-white/5">
                    <span className="text-slate-500 font-bold uppercase tracking-wider block text-[9px]">Failed Jobs</span>
                    <span className="text-xl font-bold text-rose-500 block mt-1">{aiMetrics?.failed_jobs}</span>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-white/5 col-span-2 flex justify-between items-center">
                    <div>
                      <span className="text-slate-500 font-bold uppercase tracking-wider block text-[9px]">Avg Processing Time</span>
                      <span className="text-slate-200 font-bold text-lg mt-0.5 block">{aiMetrics?.avg_processing_time_seconds}s</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 font-bold uppercase tracking-wider block text-[9px]">Total Items Detected</span>
                      <span className="text-slate-200 font-bold text-lg mt-0.5 block">{aiMetrics?.total_detected_items} units</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Dynamic Price Suggestion Engine */}
              <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 space-y-4">
                <h3 className="text-lg font-bold tracking-tight">AI Dynamic Price Suggestion</h3>
                <p className="text-xs text-slate-400">
                  Analyze inventory pricing trends and produce quality grades to calculate optimal market limits.
                </p>

                <form onSubmit={handlePriceSuggestion} className="space-y-3 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Product Search Term</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Organic Apples, Soda Bottle"
                      value={suggestName}
                      onChange={(e) => setSuggestName(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Produce Grade</label>
                    <select
                      value={suggestGrade}
                      onChange={(e) => setSuggestGrade(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="Grade A Premium">Grade A Premium (High Quality)</option>
                      <option value="Grade B Choice">Grade B Choice (Moderate Quality)</option>
                      <option value="Standard">Standard / Basic Produce</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={suggestLoading}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all cursor-pointer"
                  >
                    {suggestLoading ? "Calculating Price Bounds..." : "Query Optimal suggested Price"}
                  </button>
                </form>

                {suggestedPrice && (
                  <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-xl space-y-2 mt-4 text-xs">
                    <span className="text-emerald-400 font-bold uppercase block tracking-wider text-[10px]">Sugggested Pricing Boundaries</span>
                    <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
                      <div>
                        <span className="text-[9px] text-slate-400 block mb-0.5">MIN PRICE</span>
                        <span className="text-sm font-bold text-slate-200">${suggestedPrice.min}</span>
                      </div>
                      <div className="border-x border-white/5">
                        <span className="text-[9px] text-emerald-400 block mb-0.5">TARGET PRICE</span>
                        <span className="text-base font-extrabold text-emerald-400">${suggestedPrice.target}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block mb-0.5">MAX PRICE</span>
                        <span className="text-sm font-bold text-slate-200">${suggestedPrice.max}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: CATALOG MODERATION */}
        {/* ========================================== */}
        {activeTab === "moderation" && (
          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 space-y-4 overflow-hidden animate-in fade-in duration-200">
            <h3 className="text-lg font-bold tracking-tight border-b border-white/5 pb-4">
              Catalog Listing Moderation Ledger
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300 divide-y divide-white/5">
                <thead className="text-[10px] text-slate-500 uppercase tracking-wider bg-slate-950/40">
                  <tr>
                    <th className="py-3 px-4">Produce Details</th>
                    <th className="py-3 px-4">SKU / Category</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Inventory</th>
                    <th className="py-3 px-4">Fulfillment Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-4 px-4 font-semibold text-white">{p.name}</td>
                      <td className="py-4 px-4 font-mono text-slate-400">{p.sku || "N/A"} <span className="text-[10px] text-slate-500">({p.category || "General"})</span></td>
                      <td className="py-4 px-4">
                        {p.image_url && (
                          <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded-md inline-block mr-2" onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80"; }} />
                        )}
                        <span className="font-mono text-emerald-400 font-bold">${p.price?.toFixed(2)}</span>
                      </td>
                      <td className="py-4 px-4 font-medium">{p.stock_quantity} units</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          p.approved ? "bg-emerald-500/20 text-emerald-400" : "bg-yellow-500/20 text-yellow-300"
                        }`}>
                          {p.approved ? "Published" : "Pending Audit"}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {!p.approved ? (
                          <button
                            onClick={() => handleModerateProduct(p.id, true)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg tracking-wide cursor-pointer"
                          >
                            Approve Listing
                          </button>
                        ) : (
                          <button
                            onClick={() => handleModerateProduct(p.id, false)}
                            className="bg-white/5 border border-white/5 hover:bg-white/10 text-slate-300 font-medium px-3 py-1.5 rounded-lg cursor-pointer"
                          >
                            Take Down
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSuggestName(p.name);
                            setActiveTab("overview");
                          }}
                          className="bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-400 font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                        >
                          Check AI Price
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: VENDOR MANAGEMENT */}
        {/* ========================================== */}
        {activeTab === "vendors" && (
          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 space-y-4 animate-in fade-in duration-200">
            <h3 className="text-lg font-bold tracking-tight border-b border-white/5 pb-4">
              Registered Vendor Profiles
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300 divide-y divide-white/5">
                <thead className="text-[10px] text-slate-500 uppercase tracking-wider bg-slate-950/40">
                  <tr>
                    <th className="py-3 px-4">Company Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Verification</th>
                    <th className="py-3 px-4">Account status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {vendors.map((v) => (
                    <tr key={v.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-4 px-4 font-bold text-white">{v.company_name || "Test Store"}</td>
                      <td className="py-4 px-4 text-slate-400 font-mono">{v.email}</td>
                      <td className="py-4 px-4">{v.city && v.country ? `${v.city}, ${v.country}` : "Global"}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          v.is_verified ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"
                        }`}>
                          {v.is_verified ? "Verified ✓" : "Unverified"}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          v.is_active ? "bg-indigo-500/20 text-indigo-400" : "bg-red-500/20 text-red-400"
                        }`}>
                          {v.is_active ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {!v.is_verified ? (
                          <button
                            onClick={() => handleToggleVendor(v.id, v.is_active, true)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg tracking-wide cursor-pointer"
                          >
                            Verify Vendor
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleVendor(v.id, v.is_active, false)}
                            className="bg-white/5 border border-white/5 hover:bg-white/10 text-slate-400 px-3 py-1.5 rounded-lg cursor-pointer"
                          >
                            Revoke Verification
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleVendor(v.id, !v.is_active, v.is_verified)}
                          className={`font-semibold px-3 py-1.5 rounded-lg cursor-pointer ${
                            v.is_active 
                              ? "bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400" 
                              : "bg-indigo-600 text-white hover:bg-indigo-500"
                          }`}
                        >
                          {v.is_active ? "Suspend Vendor" : "Restore Account"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 4: API & DEVELOPERS (REDESIGNED UX)    */}
        {/* ========================================== */}
        {activeTab === "developers" && (
          <div className="grid md:grid-cols-3 gap-8 items-start animate-in fade-in duration-200">
            
            {/* Generate Key Form */}
            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 space-y-4">
              <h3 className="text-lg font-bold tracking-tight">Issue Client API Key</h3>
              <p className="text-xs text-slate-400">
                Register a secure developer access token with assigned subscription tiers and rate limits.
              </p>

              <form onSubmit={handleCreateAPIKey} className="space-y-4 text-xs">
                
                {/* 🔌 Redesigned User Search Dropdown Selection (No Typing UUIDs) */}
                <div className="relative" ref={dropdownRef}>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                    Select Developer Account *
                  </label>
                  
                  {selectedUser ? (
                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-3.5 rounded-xl flex items-center justify-between text-xs text-indigo-300 font-medium">
                      <div className="truncate pr-2">
                        <span className="font-bold text-white block">{selectedUser.email}</span>
                        <span className="text-[10px] opacity-75 font-mono">
                          {selectedUser.first_name || ""} {selectedUser.last_name || ""} ({selectedUser.role})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUser(null);
                          setGenDevId("");
                        }}
                        className="text-indigo-400 hover:text-white font-bold p-1 select-none text-sm transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={userQuery}
                          onFocus={() => setShowUserDropdown(true)}
                          onChange={(e) => {
                            setUserQuery(e.target.value);
                            setShowUserDropdown(true);
                          }}
                          placeholder="Search users by email or name..."
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500"
                        />
                        {userSearchLoading && (
                          <div className="absolute right-3.5 top-3">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-400"></div>
                          </div>
                        )}
                      </div>

                      {showUserDropdown && eligibleUsers.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-white/10 rounded-xl shadow-2xl divide-y divide-white/5 scrollbar-thin scrollbar-thumb-slate-800">
                          {eligibleUsers.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => {
                                setSelectedUser(user);
                                setGenDevId(user.id);
                                setShowUserDropdown(false);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-indigo-600/[0.15] hover:text-white transition-colors flex flex-col gap-0.5"
                            >
                              <span className="text-white font-medium text-xs truncate">{user.email}</span>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                <span>{user.first_name || ""} {user.last_name || ""}</span>
                                {user.company_name && <span>• {user.company_name}</span>}
                                <span className="bg-white/5 text-slate-400 px-1 rounded text-[8px] uppercase">{user.role}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Subscription Tier</label>
                    <select
                      value={genTier}
                      onChange={(e) => setGenTier(e.target.value as any)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="FREE">Free Plan</option>
                      <option value="PRO">Pro Plan</option>
                      <option value="ENTERPRISE">Enterprise Plan</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Daily rate limit</label>
                    <input
                      type="number"
                      required
                      value={genRateLimit}
                      onChange={(e) => setGenRateLimit(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all cursor-pointer"
                >
                  Generate Developer Key
                </button>
              </form>

              {/* 🟢 One-Time Key Display Alert with clipboard Copy button */}
              {newlyCreatedKey && (
                <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-xl space-y-2 mt-4 text-xs animate-in zoom-in duration-150">
                  <span className="text-amber-400 font-bold uppercase block tracking-wider text-[10px]">⚠️ API Access Token Generated</span>
                  <p className="text-slate-400 text-[11px]">Copy this key hash now. It will not be shown again:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={newlyCreatedKey}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-[11px]"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newlyCreatedKey);
                        alert("Copied to clipboard!");
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 rounded-lg text-xs tracking-wider"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Developer Keys Table */}
            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 space-y-4 md:col-span-2 overflow-hidden">
              <h3 className="text-lg font-bold tracking-tight">Active API Subscription Tokens</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300 divide-y divide-white/5">
                  <thead className="text-[10px] text-slate-500 uppercase tracking-wider bg-slate-950/40">
                    <tr>
                      <th className="py-3 px-4">Key prefix</th>
                      <th className="py-3 px-4">Owner Identity</th>
                      <th className="py-3 px-4">Tier</th>
                      <th className="py-3 px-4">Usage</th>
                      <th className="py-3 px-4">Daily Limit</th>
                      <th className="py-3 px-4">Created</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {devKeys.map((key) => (
                      <tr key={key.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="py-4 px-4 font-mono font-bold text-slate-200">{key.prefix}...</td>
                        <td className="py-4 px-4 text-slate-300 font-semibold">{key.developer_email || "Deleted User"}</td>
                        <td className="py-4 px-4 font-medium">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            key.tier === "ENTERPRISE" ? "bg-purple-500/20 text-purple-300" :
                            key.tier === "PRO" ? "bg-blue-500/20 text-blue-300" :
                            "bg-white/5 text-slate-400"
                          }`}>
                            {key.tier}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono font-medium">{key.calls_made} calls</td>
                        <td className="py-4 px-4 font-mono text-slate-500">/{key.rate_limit_max} daily</td>
                        <td className="py-4 px-4 text-slate-400 font-medium">
                          {key.created_at ? new Date(key.created_at).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            key.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                          }`}>
                            {key.is_active ? "Enabled" : "Revoked"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleRevokeAPIKey(key.id)}
                            className={`font-semibold px-3 py-1.5 rounded-lg cursor-pointer ${
                              key.is_active 
                                ? "bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400" 
                                : "bg-emerald-600 text-white hover:bg-emerald-500"
                            }`}
                          >
                            {key.is_active ? "Revoke Key" : "Enable Key"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 5: ADMINISTRATOR MANAGEMENT (NEW)       */}
        {/* ========================================== */}
        {activeTab === "admins" && (
          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 space-y-4 animate-in fade-in duration-200">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h3 className="text-lg font-bold tracking-tight">System Administrators Registry</h3>
                <p className="text-xs text-slate-400">Complete administrative account lists, credential resets, and activity controls</p>
              </div>
              <button
                onClick={handleOpenCreateAdmin}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all"
              >
                + Add Administrator
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300 divide-y divide-white/5">
                <thead className="text-[10px] text-slate-500 uppercase tracking-wider bg-slate-950/40">
                  <tr>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Lang</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {adminsList.map((admin) => (
                    <tr key={admin.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-slate-200">{admin.email}</td>
                      <td className="py-4 px-4 font-semibold">
                        {admin.first_name || admin.last_name ? `${admin.first_name || ""} ${admin.last_name || ""}` : "System Admin"}
                      </td>
                      <td className="py-4 px-4">
                        {admin.city && admin.country ? `${admin.city}, ${admin.country}` : "Global"}
                      </td>
                      <td className="py-4 px-4 uppercase font-mono tracking-wider">{admin.language || "en"}</td>
                      <td className="py-4 px-4 text-slate-400">
                        {new Date(admin.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          admin.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                        }`}>
                          {admin.is_active ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEditAdmin(admin)}
                          className="bg-white/5 border border-white/5 hover:bg-white/10 text-slate-300 font-semibold px-2.5 py-1.5 rounded-lg"
                        >
                          Edit Info
                        </button>
                        <button
                          onClick={() => handleOpenResetPassword(admin.id)}
                          className="bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/40 text-indigo-400 font-bold px-2.5 py-1.5 rounded-lg"
                        >
                          Reset Pass
                        </button>
                        <button
                          onClick={() => handleToggleAdminStatus(admin)}
                          className={`font-semibold px-2.5 py-1.5 rounded-lg ${
                            admin.is_active 
                              ? "bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400" 
                              : "bg-emerald-600 text-white hover:bg-emerald-500"
                          }`}
                        >
                          {admin.is_active ? "Suspend" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 6: SYSTEM ORDERS */}
        {/* ========================================== */}
        {activeTab === "orders" && (
          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 space-y-4 animate-in fade-in duration-200">
            <h3 className="text-lg font-bold tracking-tight border-b border-white/5 pb-4">
              Cross-Vendor Transactions & Order Tracking Logs
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300 divide-y divide-white/5">
                <thead className="text-[10px] text-slate-500 uppercase tracking-wider bg-slate-950/40">
                  <tr>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Purchased Items</th>
                    <th className="py-3 px-4">Total Settled</th>
                    <th className="py-3 px-4">Carrier Tracking</th>
                    <th className="py-3 px-4">Transit Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-slate-200">{o.id}</td>
                      <td className="py-4 px-4 text-slate-400 font-medium">{o.date}</td>
                      <td className="py-4 px-4 max-w-xs truncate font-medium">
                        {o.items.map(i => `${i.product_name} (x${i.quantity})`).join(", ")}
                      </td>
                      <td className="py-4 px-4 font-mono text-emerald-400 font-bold">${o.total_price?.toFixed(2)}</td>
                      <td className="py-4 px-4 font-mono text-slate-500">
                        {o.carrier ? `${o.carrier} - ${o.tracking_number}` : "Awaiting Carrier Dispatch"}
                      </td>
                      <td className="py-4 px-4 font-semibold">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          o.status === "DELIVERED" ? "bg-emerald-500/20 text-emerald-400" :
                          o.status === "SHIPPED" ? "bg-indigo-500/20 text-indigo-300" :
                          "bg-yellow-500/20 text-yellow-300"
                        }`}>
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* 👥 ADMIN MANAGEMENT MODAL FORM */}
      {adminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAdminModalOpen(false)} />

          <form
            onSubmit={handleAdminFormSubmit}
            className="relative bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-md w-full text-xs text-slate-300 space-y-4 shadow-2xl z-10 animate-in zoom-in duration-150"
          >
            <h3 className="text-lg font-bold text-white tracking-tight">
              {adminModalMode === "create" && "Add New Administrator Account"}
              {adminModalMode === "edit" && "Edit Administrator Profile"}
              {adminModalMode === "reset" && "Secure Password Reset"}
            </h3>

            {adminModalError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                ⚠️ {adminModalError}
              </div>
            )}

            {adminModalMode !== "reset" && (
              <>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">First Name</label>
                    <input
                      type="text"
                      value={adminFirstName}
                      onChange={(e) => setAdminFirstName(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Last Name</label>
                    <input
                      type="text"
                      value={adminLastName}
                      onChange={(e) => setAdminLastName(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Country</label>
                    <input
                      type="text"
                      value={adminCountry}
                      onChange={(e) => setAdminCountry(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">City</label>
                    <input
                      type="text"
                      value={adminCity}
                      onChange={(e) => setAdminCity(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Preferred Language</label>
                  <select
                    value={adminLanguage}
                    onChange={(e) => setAdminLanguage(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="en">English</option>
                    <option value="fr">French</option>
                    <option value="es">Spanish</option>
                  </select>
                </div>

                {adminModalMode === "edit" && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="adminIsActive"
                      checked={adminIsActive}
                      onChange={(e) => setAdminIsActive(e.target.checked)}
                      className="rounded border-white/10 bg-slate-950 text-indigo-600 focus:ring-0"
                    />
                    <label htmlFor="adminIsActive" className="text-slate-300 font-medium">Account is Active</label>
                  </div>
                )}
              </>
            )}

            {(adminModalMode === "create" || adminModalMode === "reset") && (
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                  {adminModalMode === "create" ? "Temporary password *" : "New Secure Password *"}
                </label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t border-white/5">
              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 font-bold text-white rounded-xl transition-all"
              >
                {adminModalMode === "create" && "Create Registry Profile"}
                {adminModalMode === "edit" && "Update Account Details"}
                {adminModalMode === "reset" && "Update Security Password"}
              </button>
              <button
                type="button"
                onClick={() => setAdminModalOpen(false)}
                className="px-4 py-2.5 bg-white/5 border border-white/5 hover:bg-white/10 rounded-xl font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}