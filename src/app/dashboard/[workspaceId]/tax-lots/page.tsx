import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTaxLots } from "@/lib/actions/holdings";
import { formatNok, formatAmount, formatDate } from "@/lib/utils";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  PURCHASE: "Purchase",
  REWARD: "Reward",
  AIRDROP: "Airdrop",
  MINING: "Mining",
  GIFT: "Gift",
  FORK: "Hard Fork",
  MIGRATION: "Migration",
  MANUAL: "Manual",
};

export default async function TaxLotsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ asset?: string }>;
}) {
  const { workspaceId } = await params;
  const sp = await searchParams;
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const lots = await getTaxLots(workspaceId, sp.asset);

  const activeLots = lots.filter(
    (l) => parseFloat(l.remainingAmount.toString()) > 0.000001
  );
  const exhaustedLots = lots.filter(
    (l) => parseFloat(l.remainingAmount.toString()) <= 0.000001
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Tax Lots</h1>
        <p className="text-slate-500 text-sm mt-1">
          Cost basis tracking — {activeLots.length} active lots, {exhaustedLots.length} exhausted
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {lots.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-4">📦</div>
            <div className="font-medium text-slate-600 mb-2">No tax lots yet</div>
            <div className="text-sm">Import buy/acquisition transactions to create tax lots</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr className="bg-slate-50">
                  <th>Asset</th>
                  <th>Acquired</th>
                  <th>Source</th>
                  <th className="text-right">Original amount</th>
                  <th className="text-right">Remaining</th>
                  <th className="text-right">Cost basis (NOK)</th>
                  <th className="text-right">Cost/unit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => {
                  const original = parseFloat(lot.originalAmount.toString());
                  const remaining = parseFloat(lot.remainingAmount.toString());
                  const costBasis = parseFloat(lot.costBasisNok.toString());
                  const costPerUnit = original > 0 ? costBasis / original : 0;
                  const isExhausted = remaining <= 0.000001;

                  return (
                    <tr key={lot.id} className={isExhausted ? "opacity-50" : ""}>
                      <td>
                        <span className="font-semibold text-slate-800">
                          {lot.asset.symbol}
                        </span>
                      </td>
                      <td className="text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(lot.acquisitionDate)}
                      </td>
                      <td>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {SOURCE_TYPE_LABELS[lot.sourceType] ?? lot.sourceType}
                        </span>
                      </td>
                      <td className="text-right font-mono text-sm text-slate-600">
                        {formatAmount(original.toString(), lot.asset.symbol)}
                      </td>
                      <td className="text-right font-mono text-sm">
                        <span className={isExhausted ? "text-slate-300" : "text-slate-700"}>
                          {isExhausted
                            ? "Exhausted"
                            : formatAmount(remaining.toString(), lot.asset.symbol)
                          }
                        </span>
                      </td>
                      <td className="text-right font-medium text-slate-700">
                        {formatNok(costBasis.toFixed(2))}
                      </td>
                      <td className="text-right text-xs text-slate-500">
                        {formatNok(costPerUnit.toFixed(2))}/{lot.asset.symbol}
                      </td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isExhausted
                            ? "bg-slate-100 text-slate-400"
                            : "bg-green-50 text-green-700"
                        }`}>
                          {isExhausted ? "Exhausted" : "Active"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <strong>FIFO method:</strong> Lots are consumed in acquisition order (oldest first) when
        calculating disposals. Lots with zero remaining balance have been fully matched to disposal events.
      </div>
    </div>
  );
}
