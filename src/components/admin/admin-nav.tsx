"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/setup", label: "Setup" },
  { href: "/admin/auctions", label: "History" },
  { href: "/admin/auction", label: "Live Auction" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/rankings", label: "Rankings" },
  { href: "/admin/invites", label: "Invites" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/logs", label: "Logs" },
] as const satisfies ReadonlyArray<{ href: Route; label: string }>;

export function AdminNav() {
  const currentPath = usePathname();

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            currentPath === link.href
              ? "bg-[linear-gradient(135deg,#081420,#17334a)] text-white shadow-[0_12px_26px_rgba(8,20,32,0.18)] ring-4 ring-slate-200/60"
              : "border border-slate-200 bg-white/86 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-white",
          )}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
