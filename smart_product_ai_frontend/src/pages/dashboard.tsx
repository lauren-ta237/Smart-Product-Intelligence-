import { Link } from "react-router-dom";
import StatCard from "../components/ui/StatCard";
import { motion } from "framer-motion";
import { useDashboard } from "../hooks/useDashboard";

export default function Dashboard() {
  // Integrate the custom dashboard hook to pull live analytics
  const { data, isLoading } = useDashboard();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white antialiased">
      {/* Wrapped the main dashboard layouts with motion for smooth entry animations */}
      <motion.div
        initial={{
          opacity: 0,
          y: 20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        transition={{
          duration: 0.5
        }}
        className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto"
      >
        <header className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Smart Product AI
          </h1>
          <p className="text-slate-400 mt-2 font-medium">
            AI powered vendor intelligence
          </p>
        </header>

        <main className="space-y-8">
          {/* Statistics section with dynamic data properties */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Images"
              value={isLoading ? "..." : data?.images ?? 0}
              description="Uploaded images"
            />

            <StatCard
              title="Products"
              value={isLoading ? "..." : data?.products ?? 0}
              description="Detected products"
            />

            <StatCard
              title="Accuracy"
              value={
                isLoading 
                  ? "..." 
                  : data?.accuracy 
                    ? Math.round(data.accuracy * 100) + "%" 
                    : "0%"
              }
              description="AI confidence"
            />

            <StatCard
              title="Approved"
              value={isLoading ? "..." : data?.approved ?? 0}
              description="Marketplace ready"
            />
          </div>

          {/* Actions & Insights Workspace Grid */}
          <div className="grid md:grid-cols-2 gap-6 items-stretch">
            
            {/* LEFT ROW CONTAINER: Houses the dual-action triggers stacked cleanly together */}
            <div className="flex flex-col gap-6 h-full justify-between">
              
              {/* ACTION 1: Run AI Analysis */}
              <Link
                to="/upload"
                className="block group flex-1"
              >
                <motion.div
                  whileHover={{ y: -4, boxShadow: "0 20px 40px -15px rgba(99, 102, 241, 0.3)" }}
                  whileTap={{ scale: 0.99 }}
                  className="h-full min-h-[140px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 border border-indigo-500/30 rounded-3xl p-8 shadow-2xl flex flex-col justify-center transition-colors"
                >
                  <p className="text-indigo-100/90 text-lg font-medium leading-relaxed group-hover:text-white transition-colors">
                    Analyze product images using AI
                  </p>
                </motion.div>
              </Link>

              {/* ACTION 2: PERSISTENT CATALOG REVIEW SYSTEM */}
              <Link
                to="/review"
                className="block group flex-1"
              >
                <motion.div
                  whileHover={{ y: -4, boxShadow: "0 20px 40px -15px rgba(16, 185, 129, 0.15)" }}
                  whileTap={{ scale: 0.99 }}
                  className="h-full min-h-[140px] bg-white/[0.03] hover:bg-white/[0.05] backdrop-blur-xl border border-white/10 hover:border-emerald-500/30 rounded-3xl p-8 shadow-2xl flex flex-col justify-center transition-all duration-200"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                        Review Saved Products
                      </h3>
                      <p className="text-slate-400 text-sm mt-1 font-medium">
                        Audit localized batch entries committed to inventory database logs.
                      </p>
                    </div>
                    <span className="text-2xl p-3 rounded-2xl bg-white/[0.04] group-hover:bg-emerald-500/10 border border-white/5 group-hover:border-emerald-500/20 transition-all text-slate-400 group-hover:text-emerald-400">
                      📂
                    </span>
                  </div>
                </motion.div>
              </Link>
            </div>

            {/* RIGHT ROW CONTAINER: Activity log matching layout context */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight border-b border-white/5 pb-4">
                  AI Activity
                </h2>
                <ul className="mt-5 space-y-4 text-slate-300">
                  <li className="flex items-center gap-3 py-0.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50"></span>
                    <span className="font-medium text-sm">Image processed successfully</span>
                  </li>
                  <li className="flex items-center gap-3 py-0.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></span>
                    <span className="font-medium text-sm">3 products detected</span>
                  </li>
                  <li className="flex items-center gap-3 py-0.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"></span>
                    <span className="font-medium text-sm">Vendor approved product</span>
                  </li>
                </ul>
              </div>
            </div>

          </div>
        </main>
      </motion.div>
    </div>
  );
}
