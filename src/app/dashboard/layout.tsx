import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { getWorkspaces } from "@/lib/actions/workspace";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspaces = await getWorkspaces();

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-500 rounded-md flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">T</span>
            </div>
            <span className="font-semibold text-white text-sm tracking-tight">TaxMate</span>
          </Link>
        </div>

        {/* Workspace selector */}
        {workspaces.length > 0 && (
          <div className="px-3 py-3 border-b border-slate-800">
            <div className="text-xs text-slate-500 mb-1 px-2">Workspace</div>
            <select className="w-full bg-slate-800 text-slate-200 text-xs rounded-md px-2 py-1.5 border border-slate-700 focus:outline-none focus:border-blue-500">
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {workspaces.length > 0 ? (
            <NavLinks workspaceId={workspaces[0].id} />
          ) : (
            <div className="text-slate-500 text-xs px-2">
              No workspace yet
            </div>
          )}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-7 h-7",
                },
              }}
            />
            <span className="text-slate-400 text-xs">Account</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function NavLinks({ workspaceId }: { workspaceId: string }) {
  const base = `/dashboard/${workspaceId}`;

  const sections = [
    {
      items: [
        { href: base, label: "Dashboard", icon: "⬛" },
        { href: `${base}/imports`, label: "Imports", icon: "📥" },
        { href: `${base}/transactions`, label: "Transactions", icon: "↕️" },
        { href: `${base}/holdings`, label: "Holdings", icon: "💼" },
        { href: `${base}/tax-lots`, label: "Tax Lots", icon: "📦" },
      ],
    },
    {
      label: "Analysis",
      items: [
        { href: `${base}/issues`, label: "Issues", icon: "⚠️" },
        { href: `${base}/reports`, label: "Reports", icon: "📋" },
      ],
    },
    {
      label: "Settings",
      items: [
        { href: `${base}/settings`, label: "Settings", icon: "⚙️" },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      {sections.map((section, i) => (
        <div key={i}>
          {section.label && (
            <div className="text-xs text-slate-500 px-2 mb-1 uppercase tracking-wider">
              {section.label}
            </div>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors text-sm"
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
