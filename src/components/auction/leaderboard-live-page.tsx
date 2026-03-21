"use client";

import { ActivityFeed } from "@/components/auction/activity-feed";
import { AuctionLayout } from "@/components/auction/auction-layout";
import { LeaderboardPanel } from "@/components/auction/leaderboard-panel";
import { TeamPicksBoard } from "@/components/auction/team-picks-board";
import { useAuctionLiveState } from "@/components/auction/use-auction-live-state";
import type { AuctionSnapshot } from "@/lib/realtime/events";

export function LeaderboardLivePage({
  initialSnapshot,
}: {
  initialSnapshot: AuctionSnapshot;
}) {
  const { snapshot, countdown, countdownSeconds, connectionState, currentTurnTeam } =
    useAuctionLiveState(initialSnapshot);

  return (
    <AuctionLayout
      connectionState={connectionState}
      countdown={countdown}
      countdownSeconds={countdownSeconds}
      currentTurnTeamName={currentTurnTeam?.teamName ?? null}
      snapshot={snapshot}
      subtitle="Transparent live standings for all participants"
      title="Leaderboard"
    >
      <div className="grid gap-6">
        <div className="rounded-[1.5rem] border border-white/60 bg-white/85 px-5 py-4 text-sm text-slate-700 shadow-panel backdrop-blur">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            Live room context
          </div>
          <div className="mt-2 leading-6">
            {snapshot.currentTurnTeamId && currentTurnTeam
              ? `${currentTurnTeam.teamName} is currently on the clock during ${snapshot.turnType.toLowerCase().replaceAll("_", " ")}.`
              : "The board will refresh automatically as the server state changes."}
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <LeaderboardPanel
            highlightedTeamId={snapshot.currentTurnTeamId ?? undefined}
            leaderboard={snapshot.leaderboard}
            title="Live standings"
          />
          <ActivityFeed items={snapshot.activity.slice(0, 12)} />
        </div>
        <TeamPicksBoard
          highlightedTeamId={snapshot.currentTurnTeamId ?? undefined}
          snapshot={snapshot}
          title="Every team roster"
        />
      </div>
    </AuctionLayout>
  );
}
