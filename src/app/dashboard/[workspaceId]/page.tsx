import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspace } from "@/lib/actions/workspace";
import { getIssueCounts } from "@/lib/actions/issues";
import { getHoldings } from "@/lib/actions/holdings";
import { getReports } from "@/lib/actions/reports";
import { prisma } from "@/lib/db";
import { formatNok, formatAmount, formatDate } from "@/lib/utils";

export default async function WorkspaceDashboard({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [workspace, issueCounts, holdings, reports] = await Promise.all([
    getWorkspace(workspaceId),
    getIssueCounts(workspaceId),
    getHoldings(workspaceId),
    getReports(workspaceId),
  ]);

  if (!workspace) notFound();

  // Recent transactions
  const recentTxs = await prisma.canonicalTransaction.findMany({
    where: { workspaceId },
    include: { asset: true },
    orderBy: { timestamp: "desc" },
    take: 8,
  });

  // Gain/loss this year
  const currentYear = new Date().getFullYear();
  const disposals = await prisma.disposalMatch.findMany({
    where: {
      workspaceId,
      disposalTx: {
        timestamp: {
          gte: new Date(`${currentYear}-01-01`),
          lt: new Date(`${currentYear + 1}-01-01`),
        },
      },
    },
  });

  let totalGain = 0;
  let totalLoss = 0;
  for (const d of disposals) {
    const gl = parseFloat(d.gainLossNok.toString());
    if (gl > 0) totalGain += gl;
    else totalLoss += Math.abs(gl);
  }
  const netGainLoss = totalGain - totalLoss;

  const base = `/dashboard/${workspaceId}`;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{workspace.name}</h1>
        <p className="text-slate-500 text-sm mt-1">
          {currentYear} Tax Year · {workspace.taxCountry} · {workspace.baseCurrency}
        </p>
      </div>

      {/* Alert: Issues */}
      {issueCounts.critical > 0 && (
        <Link href={`${base}/issues`}>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between hover:bg-red-100 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-red-600 text-lg">🚨</span>
              <div>
                <div className="text-red-700 font-medium text-sm">
                  {issueCounts.critical} critical issue{issueCounts.critical !== 1 ? "s" : ""} require attention
                </div>
                <div className="text-red-500 text-xs">
                  These may affect your tax report accuracy
                </div>
              </div>
            </div>
            <span className="text-red-500 text-sm">Review →</span>
          </div>
        </Link>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Realized gain/loss"
          value={formatNok(netGainLoss, { showSign: true })}
          subLabel={`${currentYear} YTD`}
          positive={netGainLoss >= 0}
          href={`${base}/reports`}
        />
        <MetricCard
          label="Holdings"
          value={`${holdings.length} assets`}
          subLabel={`${holdings.length} active positions`}
          href={`${base}/holdings`}
        />
        <MetricCard
          label="Open issues"
          value={issueCounts.total.toString()}
          subLabel={`${issueCounts.critical} critical`}
          warning={issueCounts.critical > 0}
          href={`${base}/issues`}
        />
        <MetricCard
          label="Reports"
          value={reports.length.toString()}
          subLabel={reports.length > 0 ? `Last: ${currentYear}` : "None generated"}
          href={`${base}/reports`}
        />
      </div>

      {/* Data sources status */}
      {workspace.dataSources.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <span className="text-3xl">📥</span>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Start by importing your transactions</h3>
              <p className="text-blue-700 text-sm mb-4">
                Connect your exchanges, upload CSV files, or add wallet addresses to get started.
              </p>
              <Link
                href={`${base}/imports`}
                className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors"
              >
                Import transactions
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent transactions */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 text-sm">Recent transactions</h2>
            <Link href={`${base}/transactions`} className="text-blue-600 text-xs hover:underline">
              View all
            </Link>
          </div>
          {recentTxs.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">
              No transactions yet. Import your data to get started.
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentTxs.map((tx) => (
                <div key={tx.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      tx.direction === "IN" ? "bg-green-400" :
                      tx.direction === "OUT" ? "bg-red-400" : "bg-slate-300"
                    }`} />
                    <div>
                      <div className="text-sm font-medium text-slate-800">
                        {tx.type.replace(/_/g, " ")}
                      </div>
                      <div className="text-xs text-slate-400">
                        {formatDate(tx.timestamp)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-700">
                      {formatAmount(tx.amount.toString(), tx.asset.symbol)}
                    </div>
                    {tx.fiatValue && (
                      <div className="text-xs text-slate-400">
                        {formatNok(tx.fiatValue.toString())}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Holdings summary */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 text-sm">Top holdings</h2>
            <Link href={`${base}/holdings`} className="text-blue-600 text-xs hover:underline">
              View all
            </Link>
          </div>
          {holdings.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">
              No holdings yet
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {holdings.slice(0, 8).map((h) => (
                <div key={h.assetId} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{h.symbol}</div>
                    <div className="text-xs text-slate-400">{h.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-700">
                      {formatAmount(h.totalAmount, h.symbol)}
                    </div>
                    <div className="text-xs text-slate-400">
                      {h.lotCount} lot{h.lotCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        {[
          { label: "Import data", icon: "📥", href: `${base}/imports` },
          { label: "Review issues", icon: "⚠️", href: `${base}/issues` },
          { label: "Generate report", icon: "📋", href: `${base}/reports` },
          { label: "View tax lots", icon: "📦", href: `${base}/tax-lots` },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors flex items-center gap-3"
          >
            <span className="text-xl">{action.icon}</span>
            <span className="text-sm font-medium text-slate-700">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subLabel,
  href,
  positive,
  warning,
}: {
  label: string;
  value: string;
  subLabel?: string;
  href: string;
  positive?: boolean;
  warning?: boolean;
}) {
  return (
    <Link href={href}>
      <div className={`bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow ${
        warning ? "border-amber-200" : "border-slate-200"
      }`}>
        <div className="text-xs text-slate-500 mb-2">{label}</div>
        <div className={`text-xl font-bold mb-1 ${
          positive === true ? "text-green-600" :
          positive === false ? "text-red-600" :
          warning ? "text-amber-600" :
          "text-slate-900"
        }`}>
          {value}
        </div>
        {subLabel && (
          <div className="text-xs text-slate-400">{subLabel}</div>
        )}
      </div>
    </Link>
  );
}
