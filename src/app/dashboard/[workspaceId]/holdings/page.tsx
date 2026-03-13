import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getHoldings } from "@/lib/actions/holdings";
import { formatAmount, formatNok } from "@/lib/utils";

export default async function HoldingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const holdings = await getHoldings(workspaceId);

  const totalCostBasis = holdings.reduce(
    (sum, h) => sum + parseFloat(h.unrealizedCostBasisNok),
    0
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Holdings</h1>
        <p className="text-slate-500 text-sm mt-1">
          Your current asset positions and cost basis
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Total positions</div>
          <div className="text-2xl font-bold text-slate-800">{holdings.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Total cost basis (NOK)</div>
          <div className="text-2xl font-bold text-slate-800">
            {formatNok(totalCostBasis)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Current value (NOK)</div>
          <div className="text-2xl font-bold text-slate-400">—</div>
          <div className="text-xs text-slate-400">Connect price feed to see live values</div>
        </div>
      </div>

      {/* Holdings table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {holdings.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-4">💼</div>
            <div className="font-medium text-slate-600 mb-2">No holdings yet</div>
            <div className="text-sm mb-4">Import your transactions to track holdings</div>
            <Link
              href={`/dashboard/${workspaceId}/imports`}
              className="text-blue-600 text-sm hover:underline"
            >
              Import transactions →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr className="bg-slate-50">
                  <th>Asset</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Cost Basis (NOK)</th>
                  <th className="text-right">Current Value</th>
                  <th className="text-right">Unrealized G/L</th>
                  <th className="text-right">Lots</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.assetId}>
                    <td>
                      <div>
                        <div className="font-semibold text-slate-800">{h.symbol}</div>
                        {h.name && h.name !== h.symbol && (
                          <div className="text-xs text-slate-400">{h.name}</div>
                        )}
                      </div>
                    </td>
                    <td className="text-right font-mono text-sm text-slate-700">
                      {formatAmount(h.totalAmount, h.symbol)}
                    </td>
                    <td className="text-right font-medium text-slate-700">
                      {formatNok(h.unrealizedCostBasisNok)}
                    </td>
                    <td className="text-right text-slate-400 text-sm">—</td>
                    <td className="text-right text-slate-400 text-sm">—</td>
                    <td className="text-right">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {h.lotCount} lot{h.lotCount !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/${workspaceId}/tax-lots?asset=${h.assetId}`}
                        className="text-blue-600 text-xs hover:underline"
                      >
                        View lots
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <strong>Note:</strong> Current values require a live price feed connection. Cost basis
        is calculated from your imported acquisition data using your selected accounting method (FIFO).
      </div>
    </div>
  );
}
