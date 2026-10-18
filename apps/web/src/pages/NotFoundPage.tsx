import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-center text-white">
      <section>
        <p className="text-sm font-black uppercase tracking-[0.25em] text-brand">404</p>
        <h1 className="mt-3 text-3xl font-black">Page not found</h1>
        <p className="mt-3 text-sm text-slate-400">The page you are looking for does not exist or may have moved.</p>
        <Link to="/" className="mt-6 inline-flex rounded-xl bg-brand px-5 py-3 text-sm font-bold hover:bg-brand-hover">Return to marketplace</Link>
      </section>
    </main>
  );
}
