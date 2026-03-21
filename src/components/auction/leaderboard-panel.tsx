import { cn } from "@/lib/utils";
import type { AuctionSnapshot } from "@/lib/realtime/events";

type LeaderboardPanelProps = {
  leaderboard: AuctionSnapshot["leaderboard"];
  highlightedTeamId?: string;
  title?: string;
};

export function LeaderboardPanel({
  leaderboard,
  highlightedTeamId,
  title = "Leaderboard",
}: LeaderboardPanelProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/60 bg-white/85 p-5 shadow-panel backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
        {title}
      </p>
      <div className="mt-4 grid gap-2">
        {leaderboard.map((entry, index) => (
          <div
            key={entry.teamId}
            className={cn(
              "rounded-2xl px-4 py-3 text-sm transition",
              entry.teamId === highlightedTeamId
                ? "bg-[linear-gradient(135deg,rgba(12,135,94,0.14),rgba(12,135,94,0.06))] text-turf ring-2 ring-turf/20"
                : index === 0
                  ? "bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(255,255,255,0.92))] text-slate-800"
                  : "bg-slate-50 text-slate-700",
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-sm font-bold text-ink shadow-sm">
                  #{index + 1}
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold">
                    {entry.teamName}
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {entry.players} players • {entry.biddingWins} bidding wins
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{entry.spend}</div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{entry.shortCode}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
