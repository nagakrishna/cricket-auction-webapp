import Link from "next/link";

import { LeaderboardLivePage } from "@/components/auction/leaderboard-live-page";
import { Shell } from "@/components/layout/shell";
import { getCurrentSession } from "@/lib/auth/session";
import { getAuctionSnapshot } from "@/server/auction/auction-service";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const session = await getCurrentSession();
  const snapshot = await getAuctionSnapshot();
  const backHref =
    session?.user.role === "ADMIN"
      ? "/admin"
      : session?.user.role === "TEAM_OWNER"
        ? "/owner/auction"
        : "/";
  const backLabel =
    session?.user.role === "ADMIN"
      ? "Back to Admin Overview"
      : session?.user.role === "TEAM_OWNER"
        ? "Back to Live Room"
        : "Back to Overview";

  return (
    <Shell
      title="Live leaderboard"
      description="Follow the live room without logging in. See which team is on the clock, how spending is shaping the board, and how every roster is filling out."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/60 bg-white/85 px-4 py-4 shadow-panel backdrop-blur">
        <div className="text-sm text-slate-600">
          Use the leaderboard for transparent standings, then jump back into the live room when you want to act.
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
            href={backHref}
          >
            {backLabel}
          </Link>
          {session?.user.role !== "TEAM_OWNER" ? (
            <Link
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              href="/owner/auction"
            >
              Open Live Room
            </Link>
          ) : null}
        </div>
      </div>
      <LeaderboardLivePage initialSnapshot={snapshot} />
    </Shell>
  );
}
