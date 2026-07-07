import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../store/auth";

export default function Login() {
  const navigate = useNavigate();
  const login = useAuth(state => state.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // State hook to safely toggle input mask types dynamically
  const [showPassword, setShowPassword] = useState(false);

  // Parse complex FastAPI/Pydantic validation objects or fallback safely
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
      // Build URLSearchParams to match Python's OAuth2PasswordRequestForm structure
      const formData = new URLSearchParams();
      formData.append("username", email); // Maps state 'email' to backend 'username'
      formData.append("password", password);

      const response = await api.post("/v1/auth/login", formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      // Handle custom error payload flags safely if needed
      if (response.data.error) {
        setError(formatErrorMessage(response.data.error));
        return;
      }

      // Extract the standard token values returned by your router
      const token = response.data.access_token;
      
      // 🟢 Fixed: Explicitly cache token matching the global client interceptor namespace
      localStorage.setItem("access_token", token);
      
      // Sync auth state manager context and move forward
      login(token);
      navigate("/");
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
          <p className="text-slate-400 text-sm font-medium">Vendor Intelligence Gateway</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-mono break-words leading-relaxed">
            ⚠️ {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Email field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Email Address</label>
            <input
              className="w-full bg-white/[0.02] border border-white/10 text-white p-3.5 rounded-xl focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-600/10 text-sm transition-all"
              placeholder="name@vendor.com"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {/* Password Input field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Password</label>
            <div className="relative w-full flex items-center">
              <input
                className="w-full bg-white/[0.02] border border-white/10 text-white p-3.5 pr-12 rounded-xl focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-600/10 text-sm transition-all"
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              
              {/* Eye icon toggler */}
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
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white p-3.5 rounded-xl font-semibold disabled:opacity-30 transition-all shadow-lg shadow-indigo-600/10 mt-2 text-sm tracking-wide"
        >
          {loading ? "Verifying Credentials..." : "Sign Into Vendor Portal"}
        </button>
      </form>
    </div>
  );
}