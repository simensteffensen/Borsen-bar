import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDataSources } from "@/lib/actions/import";
import { formatDate } from "@/lib/utils";

const SYNC_STATUS_COLORS: Record<string, string> = {
  IDLE: "text-slate-500 bg-slate-50",
  PENDING: "text-blue-600 bg-blue-50",
  RUNNING: "text-blue-600 bg-blue-50",
  SUCCESS: "text-green-600 bg-green-50",
  FAILED: "text-red-600 bg-red-50",
  PARTIAL: "text-amber-600 bg-amber-50",
};

const PROVIDER_ICONS: Record<string, string> = {
  binance: "🔶",
  coinbase: "🔵",
  kraken: "🐙",
  bybit: "🟡",
  kucoin: "🟢",
  ethereum: "💎",
  solana: "🟣",
  default: "📁",
};

export default async function ImportsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const dataSources = await getDataSources(workspaceId);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Sources</h1>
          <p className="text-slate-500 text-sm mt-1">
            Import your crypto transaction history
          </p>
        </div>
      </div>

      {/* Import options */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <ImportOptionCard
          icon="📄"
          title="Exchange CSV"
          description="Upload a CSV export from Binance, Coinbase, Kraken, and others"
          type="EXCHANGE_CSV"
          workspaceId={workspaceId}
        />
        <ImportOptionCard
          icon="🔌"
          title="Exchange API"
          description="Connect directly via API for automatic sync"
          type="EXCHANGE_API"
          workspaceId={workspaceId}
          comingSoon
        />
        <ImportOptionCard
          icon="🔗"
          title="Wallet address"
          description="Scan an Ethereum, Solana, or other chain address"
          type="WALLET_ADDRESS"
          workspaceId={workspaceId}
          comingSoon
        />
      </div>

      {/* Connected sources */}
      {dataSources.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-800 mb-3">Connected sources</h2>
          <div className="space-y-3">
            {dataSources.map((ds) => {
              const icon =
                PROVIDER_ICONS[ds.providerName.toLowerCase()] ??
                PROVIDER_ICONS.default;
              const meta = ds.importMetadata as Record<string, unknown>;
              const lastImport = meta?.lastImport as Record<string, unknown> | undefined;

              return (
                <div
                  key={ds.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">{icon}</div>
                    <div>
                      <div className="font-medium text-slate-800">{ds.label}</div>
                      <div className="text-xs text-slate-400">
                        {ds.providerName} · {ds.type.replace(/_/g, " ")}
                      </div>
                      {ds.lastSyncedAt && (
                        <div className="text-xs text-slate-400">
                          Last synced: {formatDate(ds.lastSyncedAt)}
                        </div>
                      )}
                      {lastImport && (
                        <div className="text-xs text-slate-400">
                          {String(lastImport.importedCount ?? 0)} imported ·{" "}
                          {String(lastImport.skippedCount ?? 0)} skipped ·{" "}
                          {ds._count.rawImportRecords} total records
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${SYNC_STATUS_COLORS[ds.syncStatus] ?? "text-slate-500 bg-slate-50"}`}
                    >
                      {ds.syncStatus}
                    </span>
                    <Link
                      href={`/dashboard/${workspaceId}/imports/${ds.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {dataSources.length === 0 && (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-4">📥</div>
          <div className="font-medium text-slate-600 mb-2">No data sources yet</div>
          <div className="text-sm text-slate-400">
            Upload a CSV file or connect an exchange above to get started
          </div>
        </div>
      )}

      {/* Supported exchanges */}
      <div className="mt-8">
        <h3 className="text-sm font-medium text-slate-600 mb-3">Supported exchanges (CSV)</h3>
        <div className="flex gap-2 flex-wrap">
          {["Binance", "Coinbase", "Kraken", "KuCoin", "Bybit", "OKX", "Crypto.com", "Gemini", "Bitfinex"].map((ex) => (
            <span
              key={ex}
              className="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full"
            >
              {ex}
            </span>
          ))}
          <span className="text-xs bg-white border border-slate-200 text-slate-400 px-3 py-1.5 rounded-full">
            + more via generic CSV
          </span>
        </div>
      </div>
    </div>
  );
}

function ImportOptionCard({
  icon,
  title,
  description,
  type,
  workspaceId,
  comingSoon,
}: {
  icon: string;
  title: string;
  description: string;
  type: string;
  workspaceId: string;
  comingSoon?: boolean;
}) {
  return (
    <div className={`bg-white border rounded-xl p-5 ${comingSoon ? "border-slate-100 opacity-60" : "border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"}`}>
      <div className="text-2xl mb-3">{icon}</div>
      <div className="font-medium text-slate-800 mb-1">
        {title}
        {comingSoon && (
          <span className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            Soon
          </span>
        )}
      </div>
      <div className="text-xs text-slate-500 mb-4">{description}</div>
      {!comingSoon && (
        <Link
          href={`/dashboard/${workspaceId}/imports/new?type=${type}`}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-500 transition-colors inline-block"
        >
          Add source
        </Link>
      )}
    </div>
  );
}
