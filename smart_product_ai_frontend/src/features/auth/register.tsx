// smart_product_ai_frontend/src/features/auth/register.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    company_name: "",
    email: "",
    password: "",
    country: "",
    city: "",
    language: "en",
    role: "buyer" // Aligns with the Pydantic registry enum
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(field: string, value: string) {
    setForm({
      ...form,
      [field]: value
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 🟢 Fixed: Path simplified to remove /v1 prefix
      await api.post("/auth/register", form);
      navigate("/login");
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Registration failed. Please verify your details."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6 antialiased">
      <form
        onSubmit={handleSubmit}
        className="bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-8 w-full max-w-md space-y-4 text-white"
      >
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Create Account
          </h1>
          <p className="text-slate-400 text-xs mt-1">Register for Smart Product AI</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-mono">
            ⚠️ {error}
          </div>
        )}

        {/* Dynamic Role Switcher dropdown */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Account Type</label>
          <select
            className="w-full bg-white/[0.02] border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-indigo-500/50 text-xs"
            value={form.role}
            onChange={(e) => updateField("role", e.target.value)}
          >
            <option className="bg-slate-900" value="buyer">Marketplace Buyer</option>
            <option className="bg-slate-900" value="vendor">Retail Store Vendor</option>
          </select>
        </div>

        {form.role === "vendor" && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Company/Store Name</label>
            <input
              className="w-full bg-white/[0.02] border border-white/10 text-white p-3 rounded-xl text-xs"
              placeholder="e.g. Douala Fresh Organic Store"
              value={form.company_name}
              onChange={(e) => updateField("company_name", e.target.value)}
            />
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Email Address</label>
          <input
            className="w-full bg-white/[0.02] border border-white/10 text-white p-3 rounded-xl text-xs"
            placeholder="email@example.com"
            type="email"
            required
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Password</label>
          <input
            className="w-full bg-white/[0.02] border border-white/10 text-white p-3 rounded-xl text-xs"
            placeholder="••••••••"
            type="password"
            required
            value={form.password}
            onChange={(e) => updateField("password", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Country</label>
            <input
              className="w-full bg-white/[0.02] border border-white/10 text-white p-3 rounded-xl text-xs"
              placeholder="e.g. Cameroon"
              value={form.country}
              onChange={(e) => updateField("country", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">City</label>
            <input
              className="w-full bg-white/[0.02] border border-white/10 text-white p-3 rounded-xl text-xs"
              placeholder="e.g. Yaounde"
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Preferred Language</label>
          <select
            className="w-full bg-white/[0.02] border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-indigo-500/50 text-xs"
            value={form.language}
            onChange={(e) => updateField("language", e.target.value)}
          >
            <option className="bg-slate-900" value="en">English</option>
            <option className="bg-slate-900" value="fr">French</option>
            <option className="bg-slate-900" value="es">Spanish</option>
          </select>
        </div>

        <button
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white p-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40"
        >
          {loading ? "Creating Account..." : "Register"}
        </button>

        <div className="text-center pt-2">
          <Link to="/login" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
            Already have an account? Sign In
          </Link>
        </div>
      </form>
    </div>
  );
}