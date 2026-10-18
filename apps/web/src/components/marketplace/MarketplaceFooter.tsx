import { Link } from "react-router-dom";

export default function MarketplaceFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-16 overflow-hidden rounded-3xl border border-white/10 bg-slate-900 text-slate-300">
      <div className="bg-gradient-to-r from-orange-700 to-orange-500 px-5 py-4 text-sm font-medium text-white sm:px-8">
        Discover products and manage your marketplace activity in one place.
      </div>

      <div className="grid gap-9 px-5 py-9 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:gap-12 lg:px-10 lg:py-11">
        <section className="space-y-4">
          <Link to="/" className="inline-flex items-center" aria-label="Smart Product Intelligence home">
            <span className="text-lg font-black tracking-tight text-white">
              SmartProduct<span className="text-brand">.AI</span>
            </span>
          </Link>
          <p className="max-w-sm text-sm leading-relaxed text-slate-400">
            An AI-powered product intelligence marketplace for discovering verified listings and managing product catalogs.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-white">About us</h2>
          <p className="text-sm leading-relaxed text-slate-400">
            We help buyers discover products and help vendors organize their listings with AI-assisted product analysis.
          </p>
          <Link to="/products" className="inline-flex text-sm font-semibold text-brand transition hover:text-orange-300">
            Explore the marketplace
          </Link>
        </section>

        <nav aria-label="Help center" className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-white">Help center</h2>
          <ul className="space-y-3 text-sm">
            <li><Link to="/products" className="transition hover:text-brand">Browse products</Link></li>
            <li><Link to="/categories" className="transition hover:text-brand">Browse categories</Link></li>
            <li><Link to="/search" className="transition hover:text-brand">Search products</Link></li>
            <li><Link to="/track-order" className="transition hover:text-brand">Track an order</Link></li>
            <li><Link to="/contact" className="transition hover:text-brand">Contact</Link></li>
            <li><Link to="/buyer/orders" className="transition hover:text-brand">Order history</Link></li>
          </ul>
          <address className="space-y-2 text-xs not-italic leading-relaxed text-slate-400">
            <a href="mailto:nsambulauranta@gmail.com" className="block transition hover:text-brand">nsambulauranta@gmail.com</a>
            <a href="tel:675965385" className="block transition hover:text-brand">675965385</a>
          </address>
        </nav>

        <section className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-white">Policies</h2>
          <p className="text-sm leading-relaxed text-slate-400">
            Privacy Policy and Terms of Service pages are not available yet.
          </p>
          <span className="inline-flex rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Pages coming soon
          </span>
        </section>
      </div>

      <div className="border-t border-white/10 bg-slate-950/60 px-5 py-4 text-center text-xs text-slate-500 sm:px-8">
        © {currentYear} Smart Product Intelligence. All rights reserved.
      </div>
    </footer>
  );
}
