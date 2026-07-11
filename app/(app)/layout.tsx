import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/brand/Logo";
import { SidebarNav } from "@/components/app/SidebarNav";
import { LogOutIcon } from "@/components/icons";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const initials = profile.fullName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="px-2 py-3">
          <Logo size="sm" />
        </div>

        <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </div>
        <div className="mt-2">
          <SidebarNav isAdmin={profile.role === "TENANT_ADMIN"} />
        </div>

        <div className="mt-auto space-y-2 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
              {initials || "U"}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{profile.fullName}</div>
              <div className="text-xs text-slate-500">{profile.role.replace("_", " ")}</div>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <LogOutIcon className="h-5 w-5 text-slate-400" />
              Log out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <Logo size="sm" />
          <form action={logoutAction}>
            <button type="submit" className="text-sm font-medium text-brand">Log out</button>
          </form>
        </header>
        <main className="flex-1 p-6 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
