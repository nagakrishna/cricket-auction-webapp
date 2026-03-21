import { Panel } from "@/components/ui/panel";
import type { AuctionSnapshot } from "@/lib/realtime/events";

type TeamPicksBoardProps = {
  snapshot: AuctionSnapshot;
  highlightedTeamId?: string;
  title?: string;
  eyebrow?: string;
};

export function TeamPicksBoard({
  snapshot,
  highlightedTeamId,
  title = "All team picks",
  eyebrow = "Rosters",
}: TeamPicksBoardProps) {
  return (
    <Panel title={title} eyebrow={eyebrow}>
      <div className="grid gap-4 lg:grid-cols-2">
        {snapshot.leaderboard.map((team) => {
          const picks = snapshot.rosterEntries.filter((entry) => entry.teamId === team.teamId);
          const isHighlighted = team.teamId === highlightedTeamId;

          return (
            <section
              key={team.teamId}
              className={`rounded-[1.5rem] border px-4 py-4 ${
                isHighlighted
                  ? "border-turf/30 bg-[linear-gradient(180deg,rgba(12,135,94,0.10),rgba(255,255,255,0.96))]"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-ink">{team.teamName}</div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {team.shortCode} • {team.players} / {snapshot.settings.rosterSize} players
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-500">Spend</div>
                  <div className="text-xl font-bold text-ink">{team.spend}</div>
                </div>
              </div>

              <div className="mt-3 grid gap-2">
                {picks.length > 0 ? (
                  picks.map((pick) => (
                    <div
                      key={pick.id}
                      className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-ink">{pick.playerName}</span>
                        <span className="text-xs font-bold uppercase tracking-[0.14em] text-turf">
                          {pick.role}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {pick.phase === "BIDDING"
                          ? `Bidding pick • ${pick.amount}`
                          : "Snake draft pick"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                    No players assigned yet.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </Panel>
  );
}
