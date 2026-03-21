import type { AuctionSnapshot } from "@/lib/realtime/events";
import { getBenchRole } from "@/server/auction/rules";
import type { PlayerRole } from "@prisma/client";

export function TeamSummary({
  snapshot,
  teamId,
}: {
  snapshot: AuctionSnapshot;
  teamId: string;
}) {
  const team = snapshot.leaderboard.find((entry) => entry.teamId === teamId);
  const roster = snapshot.rosterEntries.filter((entry) => entry.teamId === teamId);
  const roleCounts = roster.reduce<Record<PlayerRole, number>>(
    (counts, entry) => {
      counts[entry.role] += 1;
      return counts;
    },
    {
      BATSMAN: 0,
      BOWLER: 0,
      ALL_ROUNDER: 0,
      WICKETKEEPER: 0,
    },
  );

  if (!team) {
    return null;
  }

  const requirementRows = [
    ["Batsmen", roleCounts.BATSMAN, snapshot.settings.minBatsmen, snapshot.settings.maxBatsmen],
    ["Bowlers", roleCounts.BOWLER, snapshot.settings.minBowlers, snapshot.settings.maxBowlers],
    ["All-rounders", roleCounts.ALL_ROUNDER, snapshot.settings.minAllRounders, snapshot.settings.maxAllRounders],
    ["Wicketkeepers", roleCounts.WICKETKEEPER, snapshot.settings.minWicketkeepers, snapshot.settings.maxWicketkeepers],
  ] as const;
  const remainingSlots = Math.max(snapshot.settings.rosterSize - team.players, 0);
  const benchRole = getBenchRole(snapshot.settings, roleCounts);
  const benchRoleLabelMap = {
    BATSMAN: "Batsmen",
    BOWLER: "Bowlers",
    ALL_ROUNDER: "All-rounders",
    WICKETKEEPER: "Wicketkeepers",
  } as const;
  const benchRoleSingularLabelMap = {
    BATSMAN: "Batsman",
    BOWLER: "Bowler",
    ALL_ROUNDER: "All-rounder",
    WICKETKEEPER: "Wicketkeeper",
  } as const;

  return (
    <section className="rounded-[1.75rem] border border-turf/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,249,244,0.96))] p-5 shadow-panel backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
        Team summary
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-ink">{team.teamName}</h2>
        <span className="rounded-full bg-turf px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">
          {team.shortCode}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200/70">
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total spend</span>
          <span className="mt-1 block text-2xl font-bold text-ink">{team.spend}</span>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200/70">
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bidding wins</span>
          <span className="mt-1 block text-2xl font-bold text-ink">{team.biddingWins}/3</span>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200/70">
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Players</span>
          <span className="mt-1 block text-2xl font-bold text-ink">
            {team.players}/{snapshot.settings.rosterSize}
          </span>
        </div>
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-white/70 bg-white/80 px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Squad progress
            </p>
            <h3 className="mt-1 text-lg font-semibold text-ink">
              {remainingSlots === 0
                ? "Roster complete"
                : `${remainingSlots} slot${remainingSlots === 1 ? "" : "s"} left`}
            </h3>
          </div>
          <div className="rounded-full bg-turf/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-turf">
            {team.players}/{snapshot.settings.rosterSize}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Role requirements
              </p>
              <h4 className="mt-1 text-sm font-semibold text-ink">
                Keep your roster within target ranges
              </h4>
            </div>
          </div>
          {benchRole ? (
            <div className="mt-4 rounded-[1.4rem] border border-amber-300/80 bg-[linear-gradient(135deg,rgba(255,247,237,0.98),rgba(254,240,138,0.20))] px-4 py-4 shadow-[0_14px_28px_rgba(245,158,11,0.14)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-amber-800">
                  Bench Player Active
                </span>
                <span className="rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-900">
                  {benchRoleLabelMap[benchRole]}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-amber-950">
                You are carrying one extra {benchRoleSingularLabelMap[benchRole]} as your bench player.
              </p>
              <p className="mt-2 text-xs leading-5 text-amber-900/80">
                Only one role can exceed its max by one. All other role minimums and maximums still apply.
              </p>
            </div>
          ) : null}
          <div className="mt-3 grid gap-2">
            {requirementRows.map(([label, current, min, max]) => {
              const belowMinimum = current < min;
              const aboveMaximum = current > max;
              const toneClass = aboveMaximum
                ? "border-rose/30 bg-rose/10"
                : belowMinimum
                  ? "border-amber/30 bg-amber/10"
                  : "border-turf/25 bg-turf/10";

              return (
                <div
                  key={label}
                  className={`rounded-2xl border px-4 py-3 text-sm text-slate-700 ${toneClass}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="font-semibold text-ink">{label}</span>
                      <div className="mt-1 text-xs text-slate-500">
                        Current {current} • Target {min}-{max}
                      </div>
                    </div>
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-slate-700">
                      {current}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {roster.length > 0 ? (
            roster.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200/70"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-ink">{entry.playerName}</span>
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-turf">
                    {entry.role}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {entry.amount > 0 ? `Won for ${entry.amount}` : "Snake draft pick"}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200/70">
              No players assigned yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
