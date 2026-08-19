// smart_product_ai_frontend/src/features/auth/login.tsx
import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../store/auth";

export default function Login() {
  const navigate = useNavigate();
  const login = useAuth((state) => state.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const formatErrorMessage = (detail: any): string => {
    if (!detail) return "Invalid email or password";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) {
      return detail[0].msg;
    }
    return "Invalid email or password";
  };

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 🟢 Fixed: Path simplified to "/auth/login". 
      // Result: baseURL(/api/v1) + "/auth/login" = /api/v1/auth/login
      const response = await api.post("/auth/login", {
        email: email,
        password: password,
      });

      if (response.data.error) {
        setError(formatErrorMessage(response.data.error));
        return;
      }

      const token = response.data.access_token;
      const user = response.data.user;

      if (!token) {
        setError("Login failed. Token not received from server.");
        return;
      }

      login(token, user);

      const rawRole = user?.role?.toLowerCase() || "";

      // 🟢 Correct Dashboard Redirect Mapping
      if (rawRole === "admin" || rawRole === "superadmin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err: any) {
      const rawDetail = err.response?.data?.detail;
      setError(formatErrorMessage(rawDetail));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6 antialiased">
      <form
        onSubmit={handleLogin}
        className="bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-8 w-full max-w-md space-y-6"
      >
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-1">
            Smart Product AI
          </h1>
          <p className="text-slate-400 text-sm font-medium">Portal Access</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-mono break-words leading-relaxed">
            ⚠️ {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
              Email Address
            </label>
            <input
              className="w-full bg-white/[0.02] border border-white/10 text-white p-3.5 rounded-xl focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-600/10 text-sm transition-all"
              placeholder="user@domain.com"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
              Password
            </label>
            <div className="relative w-full flex items-center">
              <input
                className="w-full bg-white/[0.02] border border-white/10 text-white p-3.5 pr-12 rounded-xl focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-600/10 text-sm transition-all"
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all focus:outline-none text-base select-none"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁️" : "🙈"}
              </button>
            </div>
          </div>
        </div>

        <button
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white p-3.5 rounded-xl font-semibold disabled:opacity-30 transition-all shadow-lg shadow-indigo-600/10 mt-2 text-sm tracking-wide cursor-pointer"
        >
          {loading ? "Verifying Credentials..." : "Sign In"}
        </button>

        <div className="text-center pt-2">
          <Link
            to="/register"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
          >
            Don't have an account? Register
          </Link>
        </div>
      </form>
    </div>
  );
}