"use client";

import { useEffect, useRef } from "react";
import { Gavel, Radio } from "lucide-react";
import { useRouter } from "next/navigation";

import { OrderBoard } from "@/components/auction/order-board";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import type { AuctionSnapshot } from "@/lib/realtime/events";
import { useAuctionLiveState } from "@/components/auction/use-auction-live-state";

type AdminLiveStatePanelProps = {
  initialSnapshot: AuctionSnapshot;
};

function buildGuidance(snapshot: AuctionSnapshot, currentTurnTeamName: string | null) {
  if (snapshot.status === "PAUSED") {
    return "The room is paused. Timers and live actions are frozen until an admin resumes the auction.";
  }

  if (snapshot.turnType === "MANUAL_RESOLUTION") {
    return snapshot.manualReason ?? "The room is waiting for admin intervention before live play can continue.";
  }

  if (snapshot.phase === "BIDDING" && snapshot.turnType === "BIDDING_NOMINATION") {
    return currentTurnTeamName
      ? `${currentTurnTeamName} is on the clock to nominate the next player into the auction.`
      : "A nominating team is about to send the next player into the auction.";
  }

  if (snapshot.phase === "BIDDING" && snapshot.currentNominatedPlayer) {
    return currentTurnTeamName
      ? `${currentTurnTeamName} is currently driving the round while bidding stays open on ${snapshot.currentNominatedPlayer.name}.`
      : `${snapshot.currentNominatedPlayer.name} is live and the room is actively bidding.`;
  }

  if (snapshot.phase === "SNAKE" && currentTurnTeamName) {
    return `${currentTurnTeamName} is making the current snake-draft pick. Roster rules still apply for the available pool.`;
  }

  if (snapshot.phase === "COMPLETE") {
    return "The planned auction and snake-draft flow is complete. Use the boards below to review the final order, rosters, and recent activity.";
  }

  return currentTurnTeamName
    ? `${currentTurnTeamName} is next in the room flow.`
    : "The room is between active steps and waiting for the next live action.";
}

export function AdminLiveStatePanel({
  initialSnapshot,
}: AdminLiveStatePanelProps) {
  const router = useRouter();
  const { snapshot, countdown, countdownSeconds, connectionState, currentTurnTeam } =
    useAuctionLiveState(initialSnapshot);
  const previousRefreshKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const refreshKey = [
      snapshot.turnType,
      snapshot.phase,
      snapshot.activeRoundId ?? "no-round",
      snapshot.currentNominatedPlayer?.playerId ?? "no-player",
    ].join(":");

    if (previousRefreshKeyRef.current === null) {
      previousRefreshKeyRef.current = refreshKey;
      return;
    }

    if (previousRefreshKeyRef.current !== refreshKey) {
      previousRefreshKeyRef.current = refreshKey;
      router.refresh();
    }
  }, [
    router,
    snapshot.activeRoundId,
    snapshot.currentNominatedPlayer?.playerId,
    snapshot.phase,
    snapshot.turnType,
  ]);

  const currentTurnTeamName = currentTurnTeam?.teamName ?? null;
  const highestBidTeam =
    snapshot.highestBidTeamId
      ? snapshot.leaderboard.find((team) => team.teamId === snapshot.highestBidTeamId) ?? null
      : null;
  const finalCallSeconds =
    snapshot.turnType === "BIDDING" &&
    snapshot.finalCallActive &&
    countdownSeconds !== null &&
    countdownSeconds <= 3
      ? countdownSeconds
      : null;
  const statusValue =
    snapshot.status === "PAUSED"
      ? "PAUSED"
      : snapshot.turnType === "MANUAL_RESOLUTION"
        ? "WAIT"
        : finalCallSeconds !== null
          ? String(finalCallSeconds)
          : snapshot.deadlineAt
            ? countdown
            : "--:--";
  const statusHeading =
    finalCallSeconds !== null
      ? "Final Call"
      : snapshot.turnType === "MANUAL_RESOLUTION"
        ? "Admin Attention"
        : snapshot.status === "PAUSED"
          ? "Auction Status"
          : "Countdown";
  const statusCaption =
    snapshot.status === "PAUSED"
      ? "Room paused"
      : snapshot.turnType === "MANUAL_RESOLUTION"
        ? "Resolve to continue"
        : finalCallSeconds !== null
          ? "Auction closing"
          : snapshot.deadlineAt
            ? "Clock is live"
            : "Awaiting next action";
  const focusCardTone =
    snapshot.turnType === "MANUAL_RESOLUTION"
      ? "border-amber/45 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(255,255,255,0.98))] shadow-[0_18px_45px_rgba(245,158,11,0.16)]"
      : snapshot.phase === "SNAKE"
        ? "border-turf/35 bg-[linear-gradient(135deg,rgba(12,135,94,0.14),rgba(255,255,255,0.98))] shadow-[0_18px_42px_rgba(12,135,94,0.12)]"
        : snapshot.currentNominatedPlayer
          ? "border-rose-200/80 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_28%),linear-gradient(135deg,rgba(255,247,237,0.96),rgba(255,255,255,0.98))] shadow-[0_22px_50px_rgba(244,63,94,0.14)]"
          : "border-slate-200/80 bg-[linear-gradient(135deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] shadow-sm";

  const focus = snapshot.turnType === "MANUAL_RESOLUTION"
    ? {
        eyebrow: "Manual resolution",
        title: "Admin action needed now",
        details: snapshot.manualReason ?? "This round is waiting for an admin decision.",
        chips: [] as string[],
      }
    : snapshot.phase === "SNAKE"
      ? {
          eyebrow: "Current pick",
          title: currentTurnTeamName ? `${currentTurnTeamName} is selecting` : "Snake draft live",
          details: `${snapshot.availablePlayers.length} players remain available for roster-valid picks.`,
          chips: [
            `Turn ${snapshot.turnType}`,
            `Round ${snapshot.currentRoundNumber}`,
          ],
        }
      : snapshot.currentNominatedPlayer
        ? {
            eyebrow: "Current player in auction",
            title: snapshot.currentNominatedPlayer.name,
            details: `${snapshot.currentNominatedPlayer.role} • ${snapshot.currentNominatedPlayer.iplTeam} • Rank ${snapshot.currentNominatedPlayer.rankingScore}`,
            chips: [
              snapshot.currentNominatedPlayer.role,
              snapshot.currentNominatedPlayer.iplTeam,
              snapshot.highestBid !== null ? `Highest bid ${snapshot.highestBid}` : "Opening bids live",
            ],
          }
        : snapshot.phase === "COMPLETE"
          ? {
              eyebrow: "Auction complete",
              title: "Live room wrapped",
              details: `${snapshot.rosterEntries.length} assignments were recorded across the auction and snake draft.`,
              chips: [`Round ${snapshot.currentRoundNumber}`],
            }
          : {
              eyebrow: "Room focus",
              title: currentTurnTeamName ? `${currentTurnTeamName} is on deck` : "Waiting for next action",
              details: "The next visible move will appear here the moment the room advances.",
              chips: [`Turn ${snapshot.turnType}`],
            };

  const teamNameById = new Map(snapshot.leaderboard.map((team) => [team.teamId, team.teamName]));
  const formatActivityMessage = (message: string) => {
    let result = message;
    for (const [teamId, teamName] of teamNameById) {
      result = result.replaceAll(teamId, teamName);
    }
    return result;
  };

  return (
    <Panel title="Live state" eyebrow="Auction">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.5rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(244,63,94,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.95))] px-5 py-4 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-sky-700">
                Auction Live State
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                Control room summary
              </h3>
            </div>
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] shadow-sm",
                connectionState === "connected"
                  ? "border-turf/30 bg-white/90 text-turf"
                  : "border-amber/30 bg-amber/10 text-amber-800",
              )}
            >
              <Radio className="h-3.5 w-3.5" />
              {connectionState === "connected" ? "Live sync" : "Reconnecting"}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Phase</div>
              <div className="mt-2 text-lg font-semibold text-ink">{snapshot.phase}</div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Turn</div>
              <div className="mt-2 text-lg font-semibold text-ink">{snapshot.turnType}</div>
            </div>
            <div className="rounded-2xl border border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,247,237,0.96),rgba(254,240,138,0.18))] px-4 py-3 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">On the clock</div>
              <div className="mt-2 text-lg font-semibold text-amber-950">{currentTurnTeamName ?? "Waiting"}</div>
            </div>
            <div className="rounded-2xl border border-turf/20 bg-[linear-gradient(135deg,rgba(12,135,94,0.12),rgba(255,255,255,0.96))] px-4 py-3 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-turf">Leading</div>
              <div className="mt-2 text-lg font-semibold text-ink">
                {snapshot.phase === "BIDDING"
                  ? highestBidTeam?.teamName ?? "No leader yet"
                  : "Snake draft"}
              </div>
            </div>
          </div>

          <div className={cn("mt-4 rounded-[1.5rem] border px-5 py-4", focusCardTone)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {focus.eyebrow}
                </p>
                <h4 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                  {focus.title}
                </h4>
              </div>
              {snapshot.currentNominatedPlayer ? (
                <div className="rounded-full border border-rose-200/80 bg-white/75 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-rose-700 shadow-[0_10px_24px_rgba(244,63,94,0.14)]">
                  Live Auction
                </div>
              ) : null}
            </div>

            {focus.chips.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {focus.chips.map((chip) => (
                  <div
                    key={chip}
                    className="rounded-full border border-white/80 bg-white/85 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm"
                  >
                    {chip}
                  </div>
                ))}
              </div>
            ) : null}

            <p className="mt-4 text-sm leading-6 text-slate-700">{focus.details}</p>
            <div className="mt-4 rounded-2xl border border-white/80 bg-white/88 px-4 py-3 text-sm text-slate-800 shadow-sm">
              {buildGuidance(snapshot, currentTurnTeamName)}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex h-[220px] flex-col justify-between rounded-[1.5rem] border border-rose-200/60 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_28%),linear-gradient(160deg,rgba(24,39,58,0.98),rgba(12,23,36,0.98))] px-5 py-4 text-white shadow-[0_22px_48px_rgba(15,23,42,0.24)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/72">
                {statusHeading}
              </p>
              {finalCallSeconds !== null ? (
                <div
                  className={cn(
                    "rounded-full border border-white/10 bg-white/10 p-2 text-amber-200 shadow-[0_0_26px_rgba(251,191,36,0.18)] transition-transform",
                    finalCallSeconds === 0
                      ? "scale-110 rotate-12"
                      : finalCallSeconds === 1
                        ? "rotate-12"
                        : finalCallSeconds === 2
                          ? "-rotate-6"
                          : "rotate-0",
                  )}
                >
                  <Gavel className="h-5 w-5" />
                </div>
              ) : null}
            </div>
            <div className="flex flex-1 flex-col justify-center">
              <div className="text-5xl font-semibold tracking-tight text-white tabular-nums">
                {statusValue}
              </div>
              <div className="mt-3 min-h-[40px] text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">
                {statusCaption}
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Current round</div>
              <div className="mt-2 text-lg font-semibold text-ink">{snapshot.currentRoundNumber}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Highest bid</div>
              <div className="mt-2 text-lg font-semibold text-ink">
                {snapshot.phase === "BIDDING" ? snapshot.highestBid ?? "-" : "Not applicable"}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Available players</div>
              <div className="mt-2 text-lg font-semibold text-ink">{snapshot.availablePlayers.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <OrderBoard
          highlightedTeamId={snapshot.currentNominatorTeamId}
          order={snapshot.biddingNominationOrder}
          subtitle="Transparent randomized nomination order"
          title="Bidding order"
        />
        {snapshot.snakeOrderPreview ? (
          <OrderBoard
            highlightedTeamId={snapshot.currentTurnTeamId}
            order={snapshot.snakeOrderPreview}
            subtitle="Spend-based snake order"
            title="Snake order"
          />
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-600">
        {snapshot.activity.slice(0, 8).map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-3">
            {formatActivityMessage(item.message)}
          </div>
        ))}
      </div>
    </Panel>
  );
}
