import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navigation */}
      <nav className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="font-semibold text-lg tracking-tight">TaxMate</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-blue-950 border border-blue-800 rounded-full px-3 py-1 text-xs text-blue-300 mb-6">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
            Built for Norwegian tax rules
          </div>
          <h1 className="text-5xl font-bold leading-tight mb-6 tracking-tight">
            Crypto tax accounting
            <br />
            <span className="text-blue-400">you can actually trust</span>
          </h1>
          <p className="text-slate-400 text-xl leading-relaxed mb-10 max-w-2xl">
            Import all your crypto transactions, reconcile automatically, calculate
            gains and losses under Norwegian tax rules, and export a clean,
            auditable report for Skatteetaten.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/sign-up"
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-colors text-base"
            >
              Start for free
            </Link>
            <Link
              href="#features"
              className="text-slate-400 hover:text-white transition-colors text-base px-6 py-3"
            >
              See how it works →
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-6 py-12 border-y border-slate-800">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { label: "Supported exchanges", value: "20+" },
            { label: "Transaction types", value: "50+" },
            { label: "Blockchain networks", value: "10+" },
            { label: "Tax rules versioned", value: "Norway 2021–2024" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold text-white mb-1">{s.value}</div>
              <div className="text-slate-500 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div id="features" className="max-w-7xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-bold mb-4 tracking-tight">
          What TaxMate handles for you
        </h2>
        <p className="text-slate-400 text-lg mb-16 max-w-2xl">
          Not just a calculator. A full accounting engine for your crypto activity.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors"
            >
              <div className="text-2xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tax rules callout */}
      <div className="max-w-7xl mx-auto px-6 pb-24">
        <div className="bg-blue-950 border border-blue-800 rounded-2xl p-10">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold mb-4">Norway-first. Precision-first.</h2>
            <p className="text-blue-200 leading-relaxed mb-6">
              Every transaction is classified against Norwegian tax rules — crypto-to-crypto
              swaps trigger capital gains, staking rewards are income, own-wallet transfers
              are non-taxable. All calculations are shown with full audit trails.
            </p>
            <div className="flex gap-3 flex-wrap">
              {[
                "FIFO / HIFO cost basis",
                "NOK valuation at date",
                "Skatteetaten-ready exports",
                "Prior year corrections",
              ].map((tag) => (
                <span
                  key={tag}
                  className="bg-blue-900 border border-blue-700 text-blue-200 text-xs px-3 py-1.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-slate-500 text-sm">
            © 2024 TaxMate. For informational purposes. Consult a tax advisor for advice.
          </div>
          <div className="text-slate-500 text-sm">Norway 🇳🇴</div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: "📥",
    title: "Universal import",
    description:
      "CSV files from any exchange, on-chain wallet scanning, API connections. All normalized into one canonical ledger.",
  },
  {
    icon: "🔍",
    title: "Automatic reconciliation",
    description:
      "Detects own-wallet transfers, bridge pairs, duplicates, and impossible balance situations before they affect your report.",
  },
  {
    icon: "📊",
    title: "Norwegian tax rules",
    description:
      "Every transaction classified against Skatteetaten guidance. Swaps, staking rewards, airdrops — all handled correctly.",
  },
  {
    icon: "⚖️",
    title: "FIFO / HIFO cost basis",
    description:
      "Accurate lot tracking across all assets. Choose your accounting method and see the impact on your tax outcome.",
  },
  {
    icon: "🔗",
    title: "Full audit trail",
    description:
      "Every number is traceable. Click any gain or loss to see exact acquisition lots, prices, sources, and assumptions.",
  },
  {
    icon: "📋",
    title: "Professional reports",
    description:
      "Generate PDF and CSV tax summaries, disposal reports, and prior-year correction packages for your accountant.",
  },
  {
    icon: "⚠️",
    title: "Issue detection",
    description:
      "Never silently hide accounting problems. Issues are surfaced with severity ratings and guided resolution paths.",
  },
  {
    icon: "💰",
    title: "Portfolio dashboard",
    description:
      "Track holdings, unrealized gains, taxable exposure, and portfolio history in one clean dashboard.",
  },
  {
    icon: "🏛️",
    title: "Prior year corrections",
    description:
      "Recalculate prior tax years and generate correction documentation for Skatteetaten voluntary corrections.",
  },
];
