"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type ShellProps = {
  title: string;
  description: React.ReactNode;
  headerBottom?: React.ReactNode;
  children: React.ReactNode;
};

export function Shell({ title, description, headerBottom, children }: ShellProps) {
  const pathname = usePathname();
  const navLinks = [
    {
      href: "/",
      label: "Overview",
      active:
        pathname === "/" ||
        pathname === "/login" ||
        pathname.startsWith("/invite/"),
    },
    {
      href: "/admin",
      label: "Admin",
      active: pathname.startsWith("/admin"),
    },
    {
      href: "/owner/auction",
      label: "Owner View",
      active:
        pathname.startsWith("/owner") || pathname.startsWith("/leaderboard"),
    },
  ] as const;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(12,135,94,0.18),_transparent_24%),radial-gradient(circle_at_85%_0%,_rgba(244,63,94,0.14),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.16),_transparent_28%),linear-gradient(180deg,_#fbfcfb_0%,_#eef4f1_52%,_#e9f1ee_100%)] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(255,255,255,0.88)),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] p-6 shadow-[0_26px_60px_rgba(8,20,32,0.10)] backdrop-blur">
          <div className="pointer-events-none absolute" />
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="inline-flex rounded-full bg-[linear-gradient(135deg,rgba(12,135,94,0.12),rgba(255,255,255,0.92))] px-3 py-1 text-sm font-semibold uppercase tracking-[0.3em] text-turf shadow-sm">
                IPL Fantasy Auction
              </p>
              <h1
                className="text-4xl font-semibold tracking-tight text-ink md:text-5xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {title}
              </h1>
              <div className="max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                {description}
              </div>
            </div>
            <nav className="flex items-center self-start rounded-full border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-1.5 shadow-[0_14px_30px_rgba(15,23,42,0.08)]">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  className={cn(
                    "inline-flex min-w-[118px] items-center justify-center rounded-full border px-4 py-2.5 text-sm font-semibold transition",
                    link.active
                      ? "border-ink bg-[linear-gradient(135deg,#081420,#17334a)] text-white shadow-[0_10px_24px_rgba(8,20,32,0.18)]"
                      : "border-transparent bg-white/70 text-slate-700 hover:border-slate-200 hover:bg-white",
                  )}
                  href={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          {headerBottom ? <div className="mt-5 border-t border-slate-200/80 pt-4">{headerBottom}</div> : null}
        </header>
        {children}
      </div>
    </main>
  );
}
