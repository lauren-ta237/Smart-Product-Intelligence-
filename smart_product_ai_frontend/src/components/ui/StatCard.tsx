import React from "react";

interface Props {
  title: string;
  value: string | number;
  description: string;
  icon?: React.ReactNode;
}

export default function StatCard({
  title,
  value,
  description,
  icon
}: Props) {
  // Built-in high-quality icons fallback layout matching categories
  const getFallbackIcon = (cardTitle: string) => {
    switch (cardTitle?.toLowerCase()) {
      case "images": return "📁";
      case "products": return "🤖";
      case "accuracy": return "🎯";
      case "approved": return "✅";
      default: return "📊";
    }
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-xl hover:border-white/20 transition-all duration-300 flex justify-between items-start group">
      <div className="space-y-1">
        {/* Metric Header Title Token - Now bright slate text */}
        <p className="text-xs font-semibold tracking-wider uppercase text-slate-400 group-hover:text-slate-300 transition-colors">
          {description}
        </p>

        {/* Numeric Live Stat Counter - Explicitly forced to white text */}
        <h2 className={`text-4xl font-extrabold tracking-tight mt-2 transition-colors ${
          title?.toLowerCase() === "accuracy" ? "text-emerald-400" : "text-white"
        }`}>
          {value}
        </h2>

        {/* Engine Subtitle Info Bar */}
        <p className="text-xs text-slate-500 font-medium pt-1">
          {title} Engine Profile
        </p>
      </div>

      {/* Sleek Semi-Transparent Icon Wrapper */}
      <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/15 flex items-center justify-center text-lg shadow-inner group-hover:bg-white/[0.1] text-slate-300 transition-all duration-300 shrink-0">
        {icon ? icon : getFallbackIcon(title)}
      </div>
    </div>
  );
}