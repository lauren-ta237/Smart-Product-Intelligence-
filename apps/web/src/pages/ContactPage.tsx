import { Link } from "react-router-dom";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-white sm:px-6">
      <section className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-10">
        <Link to="/" className="text-sm font-semibold text-brand hover:text-orange-300">← Marketplace</Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-brand">Contact</p>
        <h1 className="mt-2 text-3xl font-black">Get in touch</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Contact the Smart Product Intelligence team by email or telephone. This site does not currently have a support form or message-delivery service.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a href="mailto:nsambulauranta@gmail.com" className="rounded-2xl border border-white/10 bg-slate-900 p-5 transition hover:border-brand/40">
            <span className="block text-xs font-bold uppercase tracking-widest text-slate-500">Email</span>
            <span className="mt-2 block break-all font-semibold text-white">nsambulauranta@gmail.com</span>
          </a>
          <a href="tel:675965385" className="rounded-2xl border border-white/10 bg-slate-900 p-5 transition hover:border-brand/40">
            <span className="block text-xs font-bold uppercase tracking-widest text-slate-500">Telephone</span>
            <span className="mt-2 block font-semibold text-white">675965385</span>
          </a>
        </div>
      </section>
    </main>
  );
}
