import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createDataSource } from "@/lib/actions/import";
import Link from "next/link";

export default async function NewImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { workspaceId } = await params;
  const sp = await searchParams;
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const type = sp.type ?? "EXCHANGE_CSV";

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/dashboard/${workspaceId}/imports`}
          className="text-sm text-slate-400 hover:text-slate-600 mb-4 inline-flex items-center gap-1"
        >
          ← Back to imports
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Add data source</h1>
        <p className="text-slate-500 text-sm mt-1">
          Connect an exchange or upload a CSV file
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <form action={createDataSource}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="type" value={type} />

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Exchange / Provider
              </label>
              <select
                name="providerName"
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select exchange</option>
                <option value="binance">Binance</option>
                <option value="coinbase">Coinbase / Coinbase Pro</option>
                <option value="kraken">Kraken</option>
                <option value="kucoin">KuCoin</option>
                <option value="bybit">Bybit</option>
                <option value="okx">OKX</option>
                <option value="crypto.com">Crypto.com</option>
                <option value="gemini">Gemini</option>
                <option value="bitfinex">Bitfinex</option>
                <option value="generic">Generic / Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Label
              </label>
              <input
                name="label"
                type="text"
                placeholder="e.g. My Binance Account"
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {type === "EXCHANGE_CSV" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  CSV File
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-blue-300 transition-colors">
                  <div className="text-3xl mb-2">📄</div>
                  <div className="text-sm font-medium text-slate-600 mb-1">
                    Drop your CSV file here
                  </div>
                  <div className="text-xs text-slate-400 mb-3">
                    Supports Binance, Coinbase, Kraken, and generic CSV formats
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    className="text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-200 file:text-xs file:bg-white file:text-slate-600 hover:file:bg-slate-50"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  The file will be parsed and deduplicated automatically.
                  Original data is preserved for auditing.
                </p>
              </div>
            )}

            <div className="pt-2 flex gap-3">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white py-2.5 px-6 rounded-lg text-sm font-medium transition-colors"
              >
                {type === "EXCHANGE_CSV" ? "Upload and import" : "Add source"}
              </button>
              <Link
                href={`/dashboard/${workspaceId}/imports`}
                className="py-2.5 px-6 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
