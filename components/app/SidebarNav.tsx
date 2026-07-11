"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/cx";
import {
  HomeIcon,
  FolderIcon,
  PlusIcon,
  LayersIcon,
} from "@/components/icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: HomeIcon },
  { href: "/projects", label: "Projects", Icon: FolderIcon },
  { href: "/stories/new", label: "New Story", Icon: PlusIcon },
  { href: "/domains", label: "Business Domains", Icon: LayersIcon },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, Icon }) => {
        const active =
          href === "/dashboard"
            ? pathname === href
            : pathname.startsWith(href.replace("/new", ""));
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-brand-50 text-brand"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            <Icon className={clsx("h-5 w-5", active ? "text-brand" : "text-slate-400")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
