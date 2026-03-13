import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getIssues, getIssueCounts } from "@/lib/actions/issues";
import { formatDate, getSeverityColor } from "@/lib/utils";

const ISSUE_TYPE_LABELS: Record<string, string> = {
  MISSING_COST_BASIS: "Missing cost basis",
  UNMATCHED_TRANSFER: "Unmatched transfer",
  DUPLICATE_TRANSACTION: "Duplicate transaction",
  MISSING_PRICE: "Missing price",
  UNKNOWN_ASSET: "Unknown asset",
  UNCLASSIFIED_TX: "Unclassified transaction",
  IMPOSSIBLE_BALANCE: "Impossible balance",
  DISPOSAL_EXCEEDS_HOLDINGS: "Disposal exceeds holdings",
  PARTIAL_HISTORY: "Partial history",
  TIMESTAMP_MISMATCH: "Timestamp mismatch",
  AMBIGUOUS_OWNERSHIP: "Ambiguous ownership",
  FEE_INCONSISTENCY: "Fee inconsistency",
  UNSUPPORTED_TX_TYPE: "Unsupported type",
};

const SEVERITY_ICONS: Record<string, string> = {
  CRITICAL: "🚨",
  WARNING: "⚠️",
  INFO: "ℹ️",
};

export default async function IssuesPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ severity?: string; status?: string; page?: string }>;
}) {
  const { workspaceId } = await params;
  const sp = await searchParams;
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const page = parseInt(sp.page ?? "1");
  const [{ issues, total }, counts] = await Promise.all([
    getIssues(workspaceId, {
      severity: sp.severity,
      status: sp.status ?? "OPEN",
      page,
    }),
    getIssueCounts(workspaceId),
  ]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Issues</h1>
        <p className="text-slate-500 text-sm mt-1">
          Accounting problems that need your attention
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Total open</div>
          <div className="text-2xl font-bold text-slate-800">{counts.total}</div>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <div className="text-xs text-red-500 mb-1">Critical</div>
          <div className="text-2xl font-bold text-red-600">{counts.critical}</div>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-4">
          <div className="text-xs text-amber-500 mb-1">Warnings</div>
          <div className="text-2xl font-bold text-amber-600">{counts.warning}</div>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4">
          <div className="text-xs text-blue-500 mb-1">Info</div>
          <div className="text-2xl font-bold text-blue-600">{counts.info}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {["", "CRITICAL", "WARNING", "INFO"].map((sev) => (
          <Link
            key={sev}
            href={sev ? `?severity=${sev}&status=OPEN` : `?status=OPEN`}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              (sp.severity ?? "") === sev
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {sev || "All"}
          </Link>
        ))}
        <div className="flex-1" />
        <Link
          href="?status=RESOLVED"
          className="text-xs text-slate-400 hover:text-slate-600 underline"
        >
          View resolved
        </Link>
      </div>

      {/* Issues list */}
      <div className="space-y-3">
        {issues.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
            <div className="text-4xl mb-4">✅</div>
            <div className="font-medium text-slate-700 mb-2">No open issues</div>
            <div className="text-sm text-slate-400">
              Your accounting data looks clean
            </div>
          </div>
        ) : (
          issues.map((issue) => (
            <div
              key={issue.id}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start gap-4">
                <span className="text-xl mt-0.5 flex-shrink-0">
                  {SEVERITY_ICONS[issue.severity]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getSeverityColor(issue.severity)}`}>
                      {issue.severity}
                    </span>
                    <span className="text-xs text-slate-400">
                      {ISSUE_TYPE_LABELS[issue.type] ?? issue.type}
                    </span>
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs text-slate-400">
                      {formatDate(issue.createdAt)}
                    </span>
                  </div>
                  <div className="font-medium text-slate-800 mb-1">{issue.title}</div>
                  <div className="text-sm text-slate-500 leading-relaxed">
                    {issue.description}
                  </div>
                  {issue.linkedTx && (
                    <div className="mt-2">
                      <Link
                        href={`/dashboard/${workspaceId}/transactions/${issue.linkedTxId}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View transaction: {issue.linkedTx.asset.symbol} ·{" "}
                        {formatDate(issue.linkedTx.timestamp)}
                      </Link>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <ResolveButton issueId={issue.id} />
                  <IgnoreButton issueId={issue.id} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {total > 50 && (
        <div className="mt-4 text-center text-sm text-slate-400">
          Showing 50 of {total} issues ·{" "}
          <Link href={`?page=${page + 1}&status=OPEN`} className="text-blue-600 hover:underline">
            Load more
          </Link>
        </div>
      )}
    </div>
  );
}

function ResolveButton({ issueId }: { issueId: string }) {
  return (
    <form>
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="resolution" value="RESOLVED" />
      <button
        type="submit"
        className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors"
      >
        Resolve
      </button>
    </form>
  );
}

function IgnoreButton({ issueId }: { issueId: string }) {
  return (
    <form>
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="resolution" value="IGNORED" />
      <button
        type="submit"
        className="text-xs bg-slate-50 border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      >
        Ignore
      </button>
    </form>
  );
}
