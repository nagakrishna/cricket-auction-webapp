import { Shell } from "@/components/layout/shell";
import { OwnerNav } from "@/components/layout/owner-nav";
import { requireRole } from "@/lib/auth/session";

export default async function OwnerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireRole("TEAM_OWNER");

  return (
    <Shell
      title="Live Team Room"
      description="Nominate players, bid live, and track every roster move as the auction unfolds."
      headerBottom={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex justify-start">
            <OwnerNav />
          </div>
          <div className="flex justify-start lg:justify-end">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-turf/20 bg-[linear-gradient(135deg,rgba(12,135,94,0.16),rgba(255,255,255,0.98))] px-3 py-2 text-sm text-slate-700 shadow-[0_12px_24px_rgba(12,135,94,0.10)]">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-turf">
                  Signed in
                </span>
                <span className="font-semibold text-ink">{user.displayName}</span>
              </div>
              <form action="/logout" method="POST">
                <button
                  className="rounded-full border border-rose/20 bg-[linear-gradient(135deg,rgba(244,63,94,0.12),rgba(255,255,255,0.98))] px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_12px_24px_rgba(244,63,94,0.10)] transition hover:border-rose/30 hover:bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(255,255,255,1))]"
                  type="submit"
                >
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </Shell>
  );
}
