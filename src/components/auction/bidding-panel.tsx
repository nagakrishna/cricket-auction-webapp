import { cn } from "@/lib/utils";
import type { AuctionSnapshot } from "@/lib/realtime/events";

type BiddingPanelProps = {
  snapshot: AuctionSnapshot;
  bidAmount: number;
  setBidAmount: (amount: number) => void;
  onSubmit: (amount: number) => void;
  onPass: () => void;
  canBid: boolean;
  canPass: boolean;
  hasPassed: boolean;
  isWinningBidTeam: boolean;
  currentHighestBidTeamName: string | null;
  passedTeams: Array<{ teamId: string; teamName: string }>;
  statusMessage: string | null;
  currentTurnTeamName: string | null;
};

export function BiddingPanel({
  snapshot,
  bidAmount,
  setBidAmount,
  onSubmit,
  onPass,
  canBid,
  canPass,
  hasPassed,
  isWinningBidTeam,
  currentHighestBidTeamName,
  passedTeams,
  statusMessage,
  currentTurnTeamName,
}: BiddingPanelProps) {
  const minimumNextBid =
    snapshot.highestBid !== null ? snapshot.highestBid + 1 : snapshot.settings.startingBidAmount;
  const biddingStateMessage =
    snapshot.turnType === "MANUAL_RESOLUTION"
      ? snapshot.manualReason ?? "Bidding is waiting for admin intervention."
      : snapshot.turnType === "BIDDING_NOMINATION"
        ? currentTurnTeamName
          ? `Waiting for ${currentTurnTeamName} to nominate a player for auction.`
          : "Waiting for a team to nominate the next player."
      : snapshot.turnType === "BIDDING" && isWinningBidTeam
        ? "You placed the latest accepted bid and cannot bid again until another team bids."
        : snapshot.turnType === "BIDDING" && hasPassed
          ? "You passed on this player auction."
      : snapshot.turnType === "BIDDING" && snapshot.highestBidTeamId && !isWinningBidTeam
          ? "You have been outbid."
          : snapshot.turnType === "BIDDING"
            ? `Bids are final, unique, and must be higher than ${snapshot.highestBid ?? snapshot.settings.startingBidAmount - 1}.`
            : "Bidding is not open right now.";
  const showWinningBanner =
    snapshot.turnType === "BIDDING" &&
    snapshot.highestBid !== null &&
    currentHighestBidTeamName;
  const biddingCardTone =
    canBid
      ? "border-rose-200/80 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.99),rgba(255,250,245,0.96))] shadow-[0_24px_50px_rgba(244,63,94,0.12)]"
      : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] shadow-panel";

  return (
    <section className={cn("rounded-[1.75rem] border p-5 backdrop-blur", biddingCardTone)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p
            className={cn(
              "inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.28em]",
              canBid
                ? "bg-rose-100/90 text-rose-700 shadow-[0_10px_24px_rgba(244,63,94,0.12)]"
                : "bg-slate-100 text-slate-600",
            )}
          >
            Bidding
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            {canBid ? "Place your bid" : "Bidding unavailable"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{biddingStateMessage}</p>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white/82 px-4 py-3 text-right shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
            Highest bid
          </p>
          <div className="mt-1 text-2xl font-black tracking-tight text-ink">
            {snapshot.highestBid ?? "-"}
          </div>
        </div>
      </div>
      {showWinningBanner ? (
        <div
          className={`mt-4 rounded-[1.5rem] border px-5 py-4 ${
            isWinningBidTeam
              ? "border-turf/45 bg-[linear-gradient(135deg,rgba(12,135,94,0.28),rgba(255,255,255,0.98))] shadow-[0_0_0_1px_rgba(12,135,94,0.08),0_18px_40px_rgba(12,135,94,0.18)]"
              : "border-amber/45 bg-[linear-gradient(135deg,rgba(245,158,11,0.22),rgba(255,255,255,0.98))] shadow-[0_0_0_1px_rgba(245,158,11,0.1),0_18px_40px_rgba(245,158,11,0.22)]"
          }`}
        >
          <p
            className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.28em] ${
              isWinningBidTeam
                ? "bg-turf/12 text-turf shadow-[0_0_22px_rgba(12,135,94,0.2)]"
                : "bg-amber-100 text-amber-800 shadow-[0_0_24px_rgba(245,158,11,0.24)]"
            }`}
          >
            {isWinningBidTeam ? "You Are Winning" : "Current Highest Bid"}
          </p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <div
                className={`text-2xl font-black tracking-tight ${
                  isWinningBidTeam
                    ? "text-turf animate-pulse drop-shadow-[0_0_16px_rgba(12,135,94,0.32)]"
                    : "text-amber-800 animate-pulse drop-shadow-[0_0_18px_rgba(245,158,11,0.32)]"
                }`}
              >
                {isWinningBidTeam
                  ? `You are leading at ${snapshot.highestBid}.`
                  : `${currentHighestBidTeamName} is winning at ${snapshot.highestBid}.`}
              </div>
              <div
                className={`mt-2 inline-flex rounded-xl px-3 py-2 text-sm font-semibold ${
                  isWinningBidTeam
                    ? "bg-white/75 text-turf animate-pulse shadow-[0_8px_22px_rgba(12,135,94,0.12)]"
                    : "bg-white/78 text-amber-800 animate-pulse shadow-[0_8px_22px_rgba(245,158,11,0.14)]"
                }`}
              >
                {isWinningBidTeam
                  ? snapshot.finalCallActive
                    ? "Final call is running now. Hold the lead until the countdown closes."
                    : "Hold the lead until the countdown ends or place 5000 for an instant win."
                  : `Waiting to see if ${currentHighestBidTeamName} stays ahead before the timer expires.`}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {passedTeams.length > 0 ? (
        <div className="mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50/80 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-800">
            Passed On This Player
          </p>
          <p className="mt-2 text-sm text-slate-700">
            {passedTeams.map((team) => team.teamName).join(", ")}
          </p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {[1, 5, 10].map((increment) => (
          <button
            key={increment}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition",
              canBid
                ? "border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,241,242,0.98))] text-rose-700 hover:border-rose-300 hover:bg-[linear-gradient(135deg,rgba(255,241,242,1),rgba(254,226,226,0.94))] hover:shadow-[0_12px_24px_rgba(244,63,94,0.12)]"
                : "border-slate-200 bg-white/72 text-slate-400",
            )}
            disabled={!canBid}
            onClick={() => setBidAmount(Math.min(5000, (snapshot.highestBid ?? 0) + increment))}
            type="button"
          >
            +{increment}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-start gap-3">
        <input
          className="w-40 rounded-2xl border border-white/80 bg-white/92 px-4 py-3 text-lg font-semibold text-ink shadow-sm"
          disabled={!canBid}
          max={5000}
          min={minimumNextBid}
          onChange={(event) => setBidAmount(Number(event.target.value))}
          type="number"
          value={bidAmount}
        />
        <button
          className="rounded-2xl bg-[linear-gradient(135deg,#7f1d1d,#be123c)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(190,24,93,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          disabled={!canBid || bidAmount < minimumNextBid || bidAmount > 5000}
          onClick={() => onSubmit(bidAmount)}
          type="button"
        >
          Submit bid
        </button>
        {snapshot.settings.allowPassOnPlayer ? (
          <div className="grid gap-2">
            <button
              className="rounded-2xl border border-amber-300 bg-[linear-gradient(135deg,rgba(255,251,235,1),rgba(254,243,199,0.92))] px-5 py-3 text-sm font-semibold text-amber-900 shadow-sm transition hover:border-amber-400 hover:bg-amber-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
              disabled={!canPass}
              onClick={onPass}
              type="button"
            >
              {hasPassed ? "Passed" : "Pass on player"}
            </button>
            {canPass ? (
              <p className="max-w-xs text-xs font-semibold leading-5 text-amber-900">
                Passing means your team can no longer participate in this player auction during the current round.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Minimum valid bid right now: {minimumNextBid}
        {snapshot.finalCallActive ? " • Final call has started." : ""}
      </p>
      {statusMessage ? (
        <p className="mt-3 rounded-xl border border-white/70 bg-white/75 px-3 py-2 text-sm text-slate-700 shadow-sm">
          {statusMessage}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2">
        {snapshot.bidFeed.length > 0 ? (
          snapshot.bidFeed.map((item) => (
            <div
              key={item.id}
              className={cn(
                "rounded-2xl px-4 py-3 text-sm shadow-sm",
                item.accepted
                  ? "border border-turf/15 bg-[linear-gradient(135deg,rgba(240,253,250,1),rgba(255,255,255,0.96))] text-slate-700"
                  : "border border-slate-200/80 bg-white/80 text-slate-700",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{item.teamName}</span>
                <span>{item.amount}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {item.accepted
                  ? "Accepted bid"
                  : item.rejectionCode === "PASSED"
                    ? "Passed on this player"
                    : `Rejected bid${item.rejectionCode ? ` • ${item.rejectionCode}` : ""}`}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            No bids yet in this round.
          </div>
        )}
      </div>
    </section>
  );
}
