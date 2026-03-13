import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getReports, generateTaxReportAction } from "@/lib/actions/reports";
import { formatDate, formatNok } from "@/lib/utils";

const REPORT_TYPE_LABELS: Record<string, string> = {
  TAX_SUMMARY: "Tax Summary",
  DISPOSAL_REPORT: "Disposal Report",
  HOLDINGS_REPORT: "Holdings Report",
  TRANSACTION_LEDGER: "Transaction Ledger",
  ISSUES_REPORT: "Issues Report",
  PRIOR_YEAR_CORRECTION: "Prior Year Correction",
};

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const reports = await getReports(workspaceId);
  const currentYear = new Date().getFullYear();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tax Reports</h1>
          <p className="text-slate-500 text-sm mt-1">
            Generate and export tax summaries for Skatteetaten
          </p>
        </div>
      </div>

      {/* Generate new report */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
        <h2 className="font-semibold text-blue-900 mb-2">Generate {currentYear} Tax Report</h2>
        <p className="text-blue-700 text-sm mb-4">
          Calculate realized gains/losses, income events, and holdings for the current tax year.
        </p>
        <form action={generateTaxReportAction.bind(null, workspaceId, currentYear)}>
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="block text-xs font-medium text-blue-800 mb-1">Tax year</label>
              <select className="border border-blue-200 bg-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
                {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-800 mb-1">Accounting method</label>
              <select className="border border-blue-200 bg-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="FIFO">FIFO (First In, First Out)</option>
                <option value="HIFO">HIFO (Highest In, First Out)</option>
                <option value="LIFO">LIFO (Last In, First Out)</option>
              </select>
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-5 py-2 rounded-lg transition-colors"
            >
              Generate report
            </button>
          </div>
        </form>
      </div>

      {/* Report list */}
      {reports.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <div className="text-4xl mb-4">📋</div>
          <div className="font-medium text-slate-700 mb-2">No reports yet</div>
          <div className="text-sm text-slate-400">
            Generate your first tax report above
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const summary = report.summary as Record<string, string | number | null>;
            return (
              <div
                key={report.id}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-800">
                        {REPORT_TYPE_LABELS[report.reportType] ?? report.reportType}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {report.taxYear}
                      </span>
                      {report.isOutdated && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          Outdated
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        report.status === "FINAL"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {report.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mb-3">
                      Generated {formatDate(report.generatedAt)} · v{report.version}
                    </div>

                    {/* Summary metrics */}
                    {summary && (
                      <div className="flex gap-6 flex-wrap">
                        {summary.netRealizedGainLossNok != null && (
                          <div>
                            <div className="text-xs text-slate-400">Net realized G/L</div>
                            <div className={`font-semibold text-sm ${
                              parseFloat(String(summary.netRealizedGainLossNok)) >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}>
                              {formatNok(String(summary.netRealizedGainLossNok), { showSign: true })}
                            </div>
                          </div>
                        )}
                        {summary.totalTaxableIncomeNok != null && (
                          <div>
                            <div className="text-xs text-slate-400">Taxable income</div>
                            <div className="font-semibold text-sm text-slate-700">
                              {formatNok(String(summary.totalTaxableIncomeNok))}
                            </div>
                          </div>
                        )}
                        {summary.disposalCount != null && (
                          <div>
                            <div className="text-xs text-slate-400">Disposals</div>
                            <div className="font-semibold text-sm text-slate-700">
                              {String(summary.disposalCount)}
                            </div>
                          </div>
                        )}
                        {summary.openIssueCount != null && (
                          <div>
                            <div className="text-xs text-slate-400">Open issues</div>
                            <div className={`font-semibold text-sm ${
                              Number(summary.openIssueCount) > 0 ? "text-amber-600" : "text-green-600"
                            }`}>
                              {String(summary.openIssueCount)}
                            </div>
                          </div>
                        )}
                        {summary.confidence && (
                          <div>
                            <div className="text-xs text-slate-400">Confidence</div>
                            <div className={`font-semibold text-sm ${
                              summary.confidence === "high" ? "text-green-600" :
                              summary.confidence === "medium" ? "text-amber-600" :
                              "text-red-600"
                            }`}>
                              {String(summary.confidence).charAt(0).toUpperCase() + String(summary.confidence).slice(1)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0 ml-4">
                    <button className="text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                      Export CSV
                    </button>
                    <button className="text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                      Export PDF
                    </button>
                    <Link
                      href={`/dashboard/${workspaceId}/reports/${report.id}`}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-500 transition-colors"
                    >
                      View detail
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <strong>Disclaimer:</strong> TaxMate provides a best-effort calculation based on available data and
        our interpretation of Norwegian tax rules. This does not constitute tax advice. Always consult a
        qualified tax advisor (skatterådgiver) before submitting to Skatteetaten.
      </div>
    </div>
  );
}
