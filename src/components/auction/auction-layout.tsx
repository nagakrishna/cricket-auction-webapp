import { Gavel } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AuctionSnapshot } from "@/lib/realtime/events";

type AuctionLayoutProps = {
  snapshot: AuctionSnapshot;
  countdown: string;
  countdownSeconds: number | null;
  connectionState: "connected" | "reconnecting";
  currentTurnTeamName: string | null;
  statusPanelOverride?: {
    heading: string;
    value: string;
    caption?: string | null;
  };
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function AuctionLayout({
  snapshot,
  countdown,
  countdownSeconds,
  connectionState,
  currentTurnTeamName,
  statusPanelOverride,
  soundEnabled,
  onToggleSound,
  title,
  subtitle,
  children,
}: AuctionLayoutProps) {
  const paused = snapshot.status === "PAUSED";
  const needsAdminAttention = snapshot.turnType === "MANUAL_RESOLUTION";
  const showCountdown = !paused && !needsAdminAttention && snapshot.deadlineAt;
  const finalCallSeconds =
    snapshot.turnType === "BIDDING" &&
    snapshot.finalCallActive &&
    countdownSeconds !== null &&
    countdownSeconds <= 3
      ? countdownSeconds
      : null;
  const countdownHeading =
    finalCallSeconds !== null ? "Final Call" : showCountdown ? "Countdown" : "Status";
  const countdownDisplay =
    finalCallSeconds !== null
      ? String(finalCallSeconds)
      : showCountdown
        ? countdown
        : paused
          ? "PAUSED"
          : needsAdminAttention
            ? "WAIT"
            : "--:--";
  const countdownCaption =
    finalCallSeconds !== null
      ? finalCallSeconds === 0
        ? "Auction done"
        : "Auction closing"
      : null;
  const statusHeading = statusPanelOverride?.heading ?? countdownHeading;
  const statusValue = statusPanelOverride?.value ?? countdownDisplay;
  const statusCaption = statusPanelOverride?.caption ?? countdownCaption;
  const showHammerAnimation =
    snapshot.turnType === "BIDDING" && finalCallSeconds !== null;
  const highestBidTeamName =
    snapshot.highestBidTeamId
      ? snapshot.leaderboard.find((team) => team.teamId === snapshot.highestBidTeamId)?.teamName ?? null
      : null;
  const focusCardTone =
    needsAdminAttention
      ? "border-amber/45 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(255,255,255,0.98))] shadow-[0_18px_45px_rgba(245,158,11,0.16)]"
      : snapshot.currentNominatedPlayer
        ? "border-rose-200/80 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_28%),linear-gradient(135deg,rgba(255,247,237,0.96),rgba(255,255,255,0.98))] shadow-[0_22px_50px_rgba(244,63,94,0.14)]"
        : snapshot.turnType === "SNAKE_PICK"
          ? "border-turf/35 bg-[linear-gradient(135deg,rgba(12,135,94,0.14),rgba(255,255,255,0.98))] shadow-[0_18px_42px_rgba(12,135,94,0.12)]"
          : "border-slate-200/80 bg-[linear-gradient(135deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] shadow-sm";
  const roomMetaItems = [
    { label: "Phase", value: snapshot.phase },
    { label: "Turn", value: snapshot.turnType },
    { label: "Round", value: String(snapshot.currentRoundNumber) },
  ];

  if (currentTurnTeamName) {
    roomMetaItems.push({ label: "On the clock", value: currentTurnTeamName });
  }

  const focusCard = needsAdminAttention
    ? {
        eyebrow: "Intervention",
        title: "Admin attention is required",
        details: snapshot.manualReason ?? "This round is waiting for manual resolution.",
        caption: "Live play is paused until this is resolved.",
      }
    : snapshot.currentNominatedPlayer
      ? {
          eyebrow: "Current player",
          title: snapshot.currentNominatedPlayer.name,
          details: `${snapshot.currentNominatedPlayer.role} • ${snapshot.currentNominatedPlayer.iplTeam}`,
          caption:
            snapshot.highestBid !== null
              ? `${highestBidTeamName ?? "A team"} leads at ${snapshot.highestBid}.`
              : "No accepted bids yet for this player.",
        }
      : snapshot.turnType === "SNAKE_PICK" && currentTurnTeamName
        ? {
            eyebrow: "Current pick",
            title: `${currentTurnTeamName} is selecting`,
            details: `${snapshot.availablePlayers.length} players remain available in the pool.`,
            caption: "Roster rules still apply for this pick.",
          }
        : snapshot.phase === "COMPLETE"
          ? {
              eyebrow: "Auction complete",
              title: "All planned picks are finished",
              details: `${snapshot.rosterEntries.length} player assignments have been recorded.`,
              caption: "Use the boards below to review final rosters and standings.",
            }
          : {
              eyebrow: "Room focus",
              title: "Waiting for the next live action",
              details: currentTurnTeamName
                ? `${currentTurnTeamName} is next in the flow.`
                : "The room is between active steps right now.",
              caption: "The next live moment will appear here as soon as the room advances.",
            };

  return (
    <div className="relative grid gap-6">
      {connectionState === "reconnecting" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[2rem] bg-ink/70 px-6 py-10 text-center text-white backdrop-blur-sm">
          <div className="max-w-lg space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/65">
              Reconnecting
            </p>
            <h2 className="text-3xl font-semibold">
              Trying to restore the live state.
            </h2>
            <p className="text-sm text-white/80">
              Your view will resync from the server as soon as the socket reconnects.
            </p>
          </div>
        </div>
      )}

      {paused ? (
        <div className="rounded-[1.5rem] border border-amber/35 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(255,255,255,0.96))] px-5 py-4 shadow-panel">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-800">
            Auction Paused
          </p>
          <div className="mt-2 text-lg font-semibold text-ink">
            The admin has paused the room.
          </div>
          <p className="mt-1 text-sm text-slate-700">
            Timers and actions are frozen until the auction resumes.
          </p>
        </div>
      ) : null}

      <div
        className={cn(
          "rounded-[1.75rem] border p-6 shadow-panel backdrop-blur",
          needsAdminAttention
            ? "border-amber/50 bg-amber/10"
            : snapshot.turnType === "SNAKE_PICK"
            ? "border-turf/50 bg-turf/10"
            : "border-white/60 bg-white/85",
        )}
      >
        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)_260px] lg:items-start">
          <div className="space-y-3">
            <div className="rounded-[1.5rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(244,63,94,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.95))] px-4 py-4 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.32em] text-sky-700">
                    Live Room
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                    {title}
                  </h2>
                </div>
                <div className="rounded-full border border-sky-200/80 bg-white/82 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700 shadow-sm">
                  {snapshot.phase}
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {roomMetaItems.map((item, index) => (
                  <div
                    key={item.label}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-sm shadow-sm transition",
                      index === roomMetaItems.length - 1 && item.label === "On the clock"
                        ? "border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,247,237,0.96),rgba(254,240,138,0.18))]"
                        : "border-slate-200/80 bg-white/90",
                    )}
                  >
                    <span
                      className={cn(
                        "font-semibold uppercase tracking-[0.18em]",
                        index === roomMetaItems.length - 1 && item.label === "On the clock"
                          ? "text-amber-700"
                          : "text-slate-500",
                      )}
                    >
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        index === roomMetaItems.length - 1 && item.label === "On the clock"
                          ? "text-amber-900"
                          : "text-ink",
                      )}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {subtitle ? <p className="text-sm leading-6 text-slate-600">{subtitle}</p> : null}
            {needsAdminAttention ? (
              <p className="text-sm font-medium text-amber-900">
                {snapshot.manualReason ?? "This round is waiting for admin intervention."}
              </p>
            ) : null}
          </div>
          <div className={cn("rounded-[1.5rem] border px-5 py-4", focusCardTone)}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className={cn(
                    "text-xs font-semibold uppercase tracking-[0.22em]",
                    snapshot.currentNominatedPlayer ? "text-rose-700" : "text-slate-500",
                  )}
                >
                  {focusCard.eyebrow}
                </p>
                <h3
                  className={cn(
                    "mt-2 text-2xl font-semibold tracking-tight",
                    snapshot.currentNominatedPlayer ? "text-slate-950" : "text-ink",
                  )}
                >
                  {focusCard.title}
                </h3>
              </div>
              {snapshot.currentNominatedPlayer ? (
                <div className="rounded-full border border-rose-200/80 bg-white/75 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-rose-700 shadow-[0_10px_24px_rgba(244,63,94,0.14)]">
                  Live Auction
                </div>
              ) : null}
            </div>
            {snapshot.currentNominatedPlayer ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <div className="rounded-full border border-white/80 bg-white/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm">
                  {snapshot.currentNominatedPlayer.role}
                </div>
                <div className="rounded-full border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800 shadow-sm">
                  {snapshot.currentNominatedPlayer.iplTeam}
                </div>
                {snapshot.highestBid !== null ? (
                  <div className="rounded-full border border-turf/20 bg-turf/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-turf shadow-sm">
                    Highest bid {snapshot.highestBid}
                  </div>
                ) : (
                  <div className="rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
                    Opening bids live
                  </div>
                )}
              </div>
            ) : null}
            <p className="mt-2 text-sm leading-6 text-slate-600">{focusCard.details}</p>
            <div
              className={cn(
                "mt-4 rounded-2xl border px-4 py-3 text-sm shadow-sm",
                snapshot.currentNominatedPlayer
                  ? "border-white/80 bg-white/88 text-slate-800"
                  : "border-slate-200/80 bg-white/90 text-slate-700",
              )}
            >
              {focusCard.caption}
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3 lg:min-w-[260px]">
            {onToggleSound ? (
              <button
                className="self-end rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:border-slate-300"
                onClick={onToggleSound}
                type="button"
              >
                {soundEnabled ? "Disable Sounds" : "Enable Sounds"}
              </button>
            ) : null}
            <div className="flex h-[224px] w-full min-w-[260px] max-w-[260px] flex-col justify-between rounded-[1.5rem] border border-rose-200/60 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_28%),linear-gradient(160deg,rgba(24,39,58,0.98),rgba(12,23,36,0.98))] px-5 py-4 text-white shadow-[0_22px_48px_rgba(15,23,42,0.24)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/72">
                  {statusHeading}
                </p>
                {showHammerAnimation ? (
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
                <div className="text-5xl font-semibold tracking-tight text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.12)] tabular-nums">
                  {statusValue}
                </div>
                <div className="mt-3 min-h-[40px] text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">
                  {statusCaption ?? "\u00A0"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={paused ? "pointer-events-none opacity-70" : undefined}>
        {children}
      </div>
    </div>
  );
}
