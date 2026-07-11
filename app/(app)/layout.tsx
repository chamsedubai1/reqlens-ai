import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { logoutAction } from "@/app/actions/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/stories/new", label: "New Story" },
  { href: "/domains", label: "Business Domains" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white p-4">
        <div className="mb-6 text-lg font-bold text-brand">ReqLens AI</div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-200 pt-4 text-sm">
          <div className="font-medium text-slate-900">{profile.fullName}</div>
          <div className="text-slate-500">{profile.role}</div>
          <form action={logoutAction}>
            <button type="submit" className="mt-2 text-brand hover:underline">
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 p-8">{children}</main>
    </div>
  );
}
