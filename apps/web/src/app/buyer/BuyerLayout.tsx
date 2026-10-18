import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../store/auth";
import { useWishlistSync } from "../../hooks/useWishlistSync";
import { useCart } from "../../store/cart";
import { useWishlist } from "../../store/wishlist";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: "⌂", end: true },
  { label: "My orders", to: "/dashboard/orders", icon: "▤" },
  { label: "Wishlist", to: "/dashboard/wishlist", icon: "♡" },
  { label: "Cart", to: "/dashboard/cart", icon: "🛒" },
  { label: "Profile", to: "/dashboard#profile", icon: "○" },
];

export default function BuyerLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);
  const cartCount = useCart((state) => state.items.reduce((total, item) => total + item.quantity, 0));
  const wishlistCount = useWishlist((state) => state.items.length);
  useWishlistSync();

  return (
    <div className="min-h-screen bg-slate-950 text-white md:flex">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/dashboard" className="font-black text-white">
          SmartProduct<span className="text-brand">.AI</span>
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="buyer-mobile-navigation"
          className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold"
        >
          {menuOpen ? "Close menu" : "Menu"}
        </button>
      </header>

      <aside className={`${menuOpen ? "block" : "hidden"} fixed inset-x-0 top-[57px] z-20 border-b border-white/10 bg-slate-950 p-4 md:sticky md:top-0 md:block md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r md:border-white/10 md:p-5`} id="buyer-mobile-navigation">
        <div className="hidden border-b border-white/10 pb-6 md:block">
          <Link to="/dashboard" className="text-lg font-black text-white">
            SmartProduct<span className="text-brand">.AI</span>
          </Link>
          <p className="mt-1 text-xs text-slate-500">Buyer workspace</p>
        </div>

        <div className="mb-5 mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 md:mt-6">
          <p className="truncate text-sm font-bold text-white">{user?.name || "Welcome back"}</p>
          <p className="mt-1 truncate text-xs text-slate-400">{user?.email}</p>
        </div>

        <nav aria-label="Buyer navigation" className="space-y-1">
          {navItems.map((item) => {
            const active = item.label === "Profile"
              ? location.pathname === "/dashboard" && location.hash === "#profile"
              : item.label === "Dashboard"
                ? location.pathname === "/dashboard" && location.hash !== "#profile"
                : undefined;
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? "page" : undefined}
                className={({ isActive }) => `flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  active || (active === undefined && isActive)
                    ? "bg-brand/15 text-brand"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span aria-hidden="true" className="w-5 text-center text-base">{item.icon}</span>
                  {item.label}
                </span>
                {item.label === "Cart" && cartCount > 0 && <span className="text-xs">{cartCount}</span>}
                {item.label === "Wishlist" && wishlistCount > 0 && <span className="text-xs">{wishlistCount}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-white/10 pt-4">
          <Link to="/" className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-white" onClick={() => setMenuOpen(false)}>
            ← Continue shopping
          </Link>
          <button
            type="button"
            onClick={() => {
              logout();
              setMenuOpen(false);
            }}
            className="mt-1 w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
