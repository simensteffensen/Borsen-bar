import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/actions/workspace";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) redirect("/dashboard");

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">
          Workspace configuration and preferences
        </p>
      </div>

      {/* Workspace settings */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-4">
        <h2 className="font-semibold text-slate-800 mb-4">Workspace settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Workspace name
            </label>
            <input
              type="text"
              defaultValue={workspace.name}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tax country
            </label>
            <select
              defaultValue={workspace.taxCountry}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="NO">Norway 🇳🇴</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Base currency
            </label>
            <select
              defaultValue={workspace.baseCurrency}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="NOK">NOK — Norwegian Krone</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tax calculation settings */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-4">
        <h2 className="font-semibold text-slate-800 mb-1">Tax calculation</h2>
        <p className="text-slate-500 text-xs mb-4">
          These settings affect how gains and losses are calculated
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Default accounting method
            </label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="FIFO">FIFO — First In, First Out</option>
              <option value="HIFO">HIFO — Highest In, First Out</option>
              <option value="LIFO">LIFO — Last In, First Out</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">
              FIFO is most commonly used in Norway. HIFO minimizes taxable gains.
            </p>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-slate-100">
            <div>
              <div className="text-sm font-medium text-slate-700">Wealth tax tracking</div>
              <div className="text-xs text-slate-400">Include year-end holdings for formueskatt reporting</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
            </label>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-slate-100">
            <div>
              <div className="text-sm font-medium text-slate-700">Include DeFi income</div>
              <div className="text-xs text-slate-400">Classify staking/LP rewards as taxable income</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
            </label>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white border border-red-200 rounded-2xl p-6">
        <h2 className="font-semibold text-red-700 mb-1">Danger zone</h2>
        <p className="text-slate-500 text-xs mb-4">
          These actions are irreversible
        </p>
        <div className="flex gap-3">
          <button className="text-xs border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors">
            Delete all transactions
          </button>
          <button className="text-xs border border-red-300 bg-red-50 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors">
            Delete workspace
          </button>
        </div>
      </div>
    </div>
  );
}
