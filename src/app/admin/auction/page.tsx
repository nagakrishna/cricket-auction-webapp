import {
  correctLastPickAction,
  pauseAuctionAction,
  reopenBiddingRoundAction,
  resumeAuctionAction,
  resolveTimedOutNominationAction,
  resolveTimedOutPickAction,
  startAuctionAction,
  undoLastAdminInterventionAction,
} from "@/app/admin/_actions/actions";
import { AdminLiveStatePanel } from "@/components/admin/admin-live-state-panel";
import { OrderBoard } from "@/components/auction/order-board";
import { TeamPicksBoard } from "@/components/auction/team-picks-board";
import { Panel } from "@/components/ui/panel";
import {
  getAuctionSnapshot,
  getCorrectableLastPick,
  getUndoableAdminIntervention,
} from "@/server/auction/auction-service";
import { getAuctionAdminData, getAuctionSetupStatus } from "@/server/admin/settings-service";
import { StartAuctionButton } from "@/components/admin/start-auction-button";

export default async function AdminAuctionPage() {
  const auction = await getAuctionAdminData();
  const setup = await getAuctionSetupStatus();
  const snapshot = await getAuctionSnapshot();
  const undoableIntervention = await getUndoableAdminIntervention();
  const correctableLastPick = await getCorrectableLastPick();
  const manualResolution = snapshot.turnType === "MANUAL_RESOLUTION";
  const validManualPickPlayers = snapshot.availablePlayers.filter(
    (player) => player.isValidForCurrentTurn,
  );
  const canResolveNomination =
    manualResolution &&
    snapshot.phase === "BIDDING" &&
    snapshot.currentNominatedPlayer === null;
  const canReopenBidding =
    manualResolution &&
    snapshot.phase === "BIDDING" &&
    snapshot.currentNominatedPlayer !== null;
  const canResolveSnakePick =
    manualResolution &&
    snapshot.phase === "SNAKE" &&
    snapshot.currentNominatedPlayer === null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
      <Panel title="Live auction control room" eyebrow="Controls" className="lg:col-span-2">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
              What this page is for
            </div>
            <div className="mt-2 leading-6">
              Use this page during the live event to start the room, pause or resume timers, monitor turn-by-turn order, and resolve bidding or snake-draft interventions the moment they happen.
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <form action={startAuctionAction}>
              <StartAuctionButton
                disabled={!setup.canStart}
                startedState={
                  setup.auctionAlreadyStarted
                    ? auction.status === "PAUSED"
                      ? "paused"
                      : auction.status === "LIVE"
                        ? "live"
                        : "completed"
                    : null
                }
              />
            </form>
            <form action={pauseAuctionAction}>
              <button className="rounded-full bg-amber px-4 py-2 text-sm font-semibold text-white" type="submit">
                Pause auction
              </button>
            </form>
            <form action={resumeAuctionAction}>
              <button className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white" type="submit">
                Resume auction
              </button>
            </form>
          </div>
        </div>
      </Panel>
      <AdminLiveStatePanel initialSnapshot={snapshot} />
      <Panel title="Manual resolution" eyebrow="Intervention" className="min-w-0">
        {manualResolution ? (
          <div className="grid min-w-0 gap-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 break-words">
              {snapshot.manualReason ?? "This round requires admin intervention."}
            </div>

            {canResolveNomination ? (
              <>
                <form action={reopenBiddingRoundAction} className="grid min-w-0 gap-4">
                  <input name="roundId" type="hidden" value={snapshot.activeRoundId ?? ""} />
                  <button
                    className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white"
                    type="submit"
                  >
                    Reopen nomination turn
                  </button>
                </form>
                <form action={resolveTimedOutNominationAction} className="grid min-w-0 gap-4">
                  <input name="roundId" type="hidden" value={snapshot.activeRoundId ?? ""} />
                  <select className="w-full min-w-0 rounded-2xl border border-slate-200 px-4 py-3" name="playerId">
                    {snapshot.availablePlayers.map((player) => (
                      <option key={player.playerId} value={player.playerId}>
                        {player.name} • {player.role} • #{player.rankingScore}
                      </option>
                    ))}
                  </select>
                  <button className="w-full rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-white" type="submit">
                    Resolve nomination manually
                  </button>
                </form>
              </>
            ) : canReopenBidding ? (
              <div className="grid min-w-0 gap-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 break-words">
                  Reopen bidding for {snapshot.currentNominatedPlayer?.name} and put the nominated player back on the clock.
                </div>
                <form action={reopenBiddingRoundAction} className="grid min-w-0 gap-4">
                  <input name="roundId" type="hidden" value={snapshot.activeRoundId ?? ""} />
                  <button
                    className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white"
                    type="submit"
                  >
                    Reopen bidding round
                  </button>
                </form>
              </div>
            ) : canResolveSnakePick ? (
              <form action={resolveTimedOutPickAction} className="grid min-w-0 gap-4">
                <input name="roundId" type="hidden" value={snapshot.activeRoundId ?? ""} />
                <select
                  className="w-full min-w-0 rounded-2xl border border-slate-200 px-4 py-3"
                  disabled={validManualPickPlayers.length === 0}
                  name="playerId"
                >
                  {validManualPickPlayers.length > 0 ? (
                    validManualPickPlayers.map((player) => (
                      <option key={player.playerId} value={player.playerId}>
                        {player.name} • {player.role} • #{player.rankingScore}
                      </option>
                    ))
                  ) : (
                    <option value="">No valid players available</option>
                  )}
                </select>
                {validManualPickPlayers.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600 break-words">
                    No roster-valid player is currently available for manual resolution.
                  </div>
                ) : null}
                <button
                  className="w-full rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={validManualPickPlayers.length === 0}
                  type="submit"
                >
                  Resolve snake pick manually
                </button>
              </form>
            ) : (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600 break-words">
                This bidding round is waiting for admin intervention.
              </div>
            )}
          </div>
        ) : (
          <div className="grid min-w-0 gap-3">
            <p className="text-sm text-slate-600">No intervention required right now.</p>
            {correctableLastPick ? (
              <form action={correctLastPickAction} className="min-w-0">
                <button
                  className="w-full break-words rounded-2xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose/15"
                  type="submit"
                >
                  {correctableLastPick.label}
                </button>
              </form>
            ) : null}
            {undoableIntervention ? (
              <form action={undoLastAdminInterventionAction} className="min-w-0">
                <button
                  className="w-full break-words rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  type="submit"
                >
                  {undoableIntervention.label}
                </button>
              </form>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm leading-6 text-slate-500 break-words">
                Undo is only available immediately after a safe admin intervention, before any follow-up bids or actions occur.
              </div>
            )}
          </div>
        )}
      </Panel>
      <div className="lg:col-span-2">
        <TeamPicksBoard
          highlightedTeamId={snapshot.currentTurnTeamId ?? undefined}
          snapshot={snapshot}
          title="Every team picks"
        />
      </div>
    </div>
  );
}
