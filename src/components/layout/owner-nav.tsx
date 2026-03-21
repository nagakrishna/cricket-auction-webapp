"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [
  { href: "/owner/auction", label: "Live Room" },
  { href: "/leaderboard", label: "Leaderboard" },
] as const satisfies ReadonlyArray<{ href: Route; label: string }>;

export function OwnerNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            pathname === link.href ||
              (link.href === "/owner/auction" && pathname === "/owner/snake-draft")
              ? "bg-[linear-gradient(135deg,#0c875e,#19a974)] text-white shadow-[0_12px_26px_rgba(12,135,94,0.22)] ring-4 ring-turf/15"
              : "border border-slate-200 bg-white/86 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-white",
          )}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
