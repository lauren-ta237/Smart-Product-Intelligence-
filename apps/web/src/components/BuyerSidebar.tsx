import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, LayoutDashboard, Package, ShoppingBag, UserRound, Heart, ShoppingCart } from "lucide-react";

const buyerLinks = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, active: (path: string, hash: string) => path === "/dashboard" && hash !== "#profile" },
  { label: "My Orders", to: "/buyer/orders", icon: Package, active: (path: string) => path.startsWith("/buyer/orders") || path.startsWith("/dashboard/orders") },
  { label: "Profile", to: "/dashboard#profile", icon: UserRound, active: (path: string, hash: string) => path === "/dashboard" && hash === "#profile" },
  { label: "Wishlist", to: "/buyer/wishlist", icon: Heart, active: (path: string) => path === "/buyer/wishlist" },
  { label: "Cart", to: "/buyer/cart", icon: ShoppingCart, active: (path: string) => path === "/buyer/cart" },
];

interface BuyerSidebarProps {
  onDashboardClick?: () => void;
  onProfileClick?: () => void;
}

export default function BuyerSidebar({ onDashboardClick, onProfileClick }: BuyerSidebarProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <aside className="h-fit rounded-2xl border border-white/10 bg-slate-900/80 p-3 shadow-xl lg:sticky lg:top-6">
      <button
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="buyer-dashboard-navigation"
        onClick={() => setMobileOpen((open) => !open)}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold text-white lg:hidden"
      >
        <span className="flex items-center gap-2"><ShoppingBag size={17} className="text-brand" /> Buyer menu</span>
        <ChevronDown size={16} className={`transition-transform ${mobileOpen ? "rotate-180" : ""}`} />
      </button>
      <nav
        id="buyer-dashboard-navigation"
        aria-label="Buyer dashboard"
        className={`${mobileOpen ? "mt-2 grid" : "hidden"} gap-1 lg:mt-0 lg:grid`}
      >
        {buyerLinks.map(({ label, to, icon: Icon, active }) => {
          const isActive = active(location.pathname, location.hash);
          return (
            <Link
              key={label}
              to={to}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                setMobileOpen(false);
                if (label === "Dashboard") onDashboardClick?.();
                if (label === "Profile") onProfileClick?.();
              }}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                isActive
                  ? "bg-brand text-white shadow-lg shadow-orange-950/30"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
