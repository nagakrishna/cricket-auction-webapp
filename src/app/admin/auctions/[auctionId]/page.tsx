import { notFound } from "next/navigation";

import { Panel } from "@/components/ui/panel";
import { getAuctionHistoryDetail } from "@/server/admin/auction-catalog-service";

type AuctionHistoryPageProps = {
  params: Promise<{ auctionId: string }>;
};

export default async function AuctionHistoryPage({
  params,
}: AuctionHistoryPageProps) {
  const { auctionId } = await params;

  try {
    const { auction, leaderboard } = await getAuctionHistoryDetail(auctionId);

    return (
      <div className="grid gap-6">
        <Panel title={auction.name} eyebrow="History">
          <div className="mb-4 flex items-center justify-between gap-3 rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                Auction snapshot
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Review the final room state, standings, team assignments, and supporting audit trace for this auction.
              </div>
            </div>
            <div className="rounded-full bg-ink px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white">
              {auction.status}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Status: {auction.status}
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Phase: {auction.phase}
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Rounds: {auction.rounds.length}
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Picks: {auction.rosterEntries.length}
            </div>
          </div>
        </Panel>

        <div className="grid gap-6">
          <Panel title="Final leaderboard" eyebrow="Results">
            <div className="grid gap-3">
              {leaderboard.map((team: (typeof leaderboard)[number]) => (
                <div
                  key={team.teamId}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{team.teamName}</span>
                    <span>{team.spend}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {team.players} players drafted
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Player assignments" eyebrow="Rosters">
          <div className="grid gap-4 lg:grid-cols-2">
            {leaderboard.map((team: (typeof leaderboard)[number]) => (
              <div
                key={team.teamId}
                className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-ink">{team.teamName}</div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {team.shortCode} • {team.players} players • Spend {team.spend}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  {team.rosterEntries.length > 0 ? (
                    team.rosterEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{entry.player.name}</span>
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {entry.phase}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {entry.player.role} • {entry.player.iplTeam} • {entry.amount > 0 ? `Bid ${entry.amount}` : "Amount 0"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                      No players were assigned to this team in this auction.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Recent audit log" eyebrow="Trace">
          <div className="grid gap-3">
            {auction.auditLogs.map((log: (typeof auction.auditLogs)[number]) => (
              <div
                key={log.id}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">
                    {log.action}
                  </span>
                  <span className="text-xs text-slate-500">
                    {log.createdAt.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{log.message}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  } catch {
    notFound();
  }
}
