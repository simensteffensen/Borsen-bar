import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getWorkspaces, createWorkspace } from "@/lib/actions/workspace";
import { prisma } from "@/lib/db";

export default async function DashboardIndexPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const workspaces = await getWorkspaces();

  if (workspaces.length === 0) {
    return <CreateWorkspacePage />;
  }

  redirect(`/dashboard/${workspaces[0].id}`);
}

function CreateWorkspacePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📊</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Create your workspace
          </h1>
          <p className="text-slate-500 text-sm">
            Set up your TaxMate workspace to start importing and calculating your crypto taxes.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <form action={createWorkspace}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Workspace name
                </label>
                <input
                  name="name"
                  type="text"
                  placeholder="e.g. My Crypto Portfolio"
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tax country
                </label>
                <select
                  name="taxCountry"
                  defaultValue="NO"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="NO">Norway 🇳🇴</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  More countries coming soon
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Base currency
                </label>
                <select
                  name="baseCurrency"
                  defaultValue="NOK"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="NOK">NOK — Norwegian Krone</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Create workspace
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          You can create multiple workspaces for different portfolios or clients.
        </p>
      </div>
    </div>
  );
}
