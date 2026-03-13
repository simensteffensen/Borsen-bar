import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTransactions } from "@/lib/actions/transactions";
import {
  formatNok,
  formatAmount,
  formatDate,
  getTxTypeLabel,
  getStatusColor,
} from "@/lib/utils";

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ page?: string; status?: string; type?: string }>;
}) {
  const { workspaceId } = await params;
  const sp = await searchParams;
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const page = parseInt(sp.page ?? "1");
  const { transactions, total, pageSize } = await getTransactions(workspaceId, {
    page,
    status: sp.status,
    type: sp.type,
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-slate-500 text-sm mt-1">
            {total.toLocaleString()} total transactions
          </p>
        </div>
        <Link
          href={`/dashboard/${workspaceId}/imports`}
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors"
        >
          Import more
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex gap-3 flex-wrap">
        <StatusFilter current={sp.status} workspaceId={workspaceId} />
        <TypeFilter current={sp.type} workspaceId={workspaceId} />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {transactions.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-4">↕️</div>
            <div className="font-medium text-slate-600 mb-2">No transactions found</div>
            <div className="text-sm">Import your crypto history to get started</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr className="bg-slate-50">
                  <th>Date</th>
                  <th>Type</th>
                  <th>Asset</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Value (NOK)</th>
                  <th>Status</th>
                  <th>Issues</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="text-slate-500 text-xs whitespace-nowrap">
                      {formatDate(tx.timestamp)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          tx.direction === "IN" ? "bg-green-400" :
                          tx.direction === "OUT" ? "bg-red-400" : "bg-slate-300"
                        }`} />
                        <span className="text-sm text-slate-700 whitespace-nowrap">
                          {getTxTypeLabel(tx.type)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                        {tx.asset.symbol}
                      </span>
                    </td>
                    <td className="text-right font-mono text-sm text-slate-700">
                      {formatAmount(tx.amount.toString(), undefined, 8)}
                    </td>
                    <td className="text-right text-sm text-slate-600">
                      {tx.fiatValue
                        ? formatNok(tx.fiatValue.toString())
                        : <span className="text-slate-300 text-xs">—</span>
                      }
                    </td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(tx.status)}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td>
                      {tx.issues.length > 0 ? (
                        <span className="text-xs text-amber-600 font-medium">
                          {tx.issues.length} issue{tx.issues.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/${workspaceId}/transactions/${tx.id}`}
                        className="text-blue-600 text-xs hover:underline"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-slate-500">
            Page {page} of {totalPages} · {total.toLocaleString()} total
          </div>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`?page=${page - 1}`}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`?page=${page + 1}`}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusFilter({
  current,
  workspaceId,
}: {
  current?: string;
  workspaceId: string;
}) {
  const statuses = [
    { value: "", label: "All" },
    { value: "NORMALIZED", label: "Normalized" },
    { value: "FLAGGED", label: "Flagged" },
    { value: "RESOLVED", label: "Resolved" },
    { value: "IGNORED", label: "Ignored" },
  ];

  return (
    <div className="flex gap-1">
      {statuses.map((s) => (
        <Link
          key={s.value}
          href={s.value ? `?status=${s.value}` : "?"}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
            (current ?? "") === s.value
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}

function TypeFilter({
  current,
  workspaceId,
}: {
  current?: string;
  workspaceId: string;
}) {
  const types = [
    { value: "", label: "All types" },
    { value: "MARKET_BUY", label: "Buy" },
    { value: "MARKET_SELL", label: "Sell" },
    { value: "SPOT_SWAP", label: "Swap" },
    { value: "STAKING_REWARD", label: "Staking" },
    { value: "AIRDROP", label: "Airdrop" },
    { value: "SELF_TRANSFER", label: "Transfer" },
  ];

  return (
    <select
      className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      defaultValue={current ?? ""}
    >
      {types.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
