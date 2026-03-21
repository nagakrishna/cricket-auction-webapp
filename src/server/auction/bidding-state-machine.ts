import type { AuctionPhase, AuctionRound, AuctionStatus, Bid, TurnType } from "@prisma/client";

export type BiddingEngineState =
  | "IDLE"
  | "NOMINATION"
  | "OPEN"
  | "WINNER_SELECTION"
  | "ADMIN_INTERVENTION"
  | "COMPLETE";

type StateInput = {
  auctionStatus: AuctionStatus;
  auctionPhase: AuctionPhase;
  turnType: TurnType;
};

export function getBiddingEngineState(input: StateInput): BiddingEngineState {
  if (input.auctionStatus === "PAUSED") {
    return "IDLE";
  }

  if (input.auctionPhase !== "BIDDING") {
    return input.auctionPhase === "COMPLETE" ? "COMPLETE" : "IDLE";
  }

  if (input.turnType === "BIDDING") {
    return "OPEN";
  }

  if (input.turnType === "BIDDING_NOMINATION") {
    return "NOMINATION";
  }

  if (input.turnType === "BIDDING_SELECTION") {
    return "WINNER_SELECTION";
  }

  if (input.turnType === "MANUAL_RESOLUTION") {
    return "ADMIN_INTERVENTION";
  }

  return "IDLE";
}

export function getHighestAcceptedBid(
  bids: Array<Pick<Bid, "amount" | "teamId" | "createdAt" | "wasAccepted">>,
) {
  return bids
    .filter((bid) => bid.wasAccepted)
    .sort((left, right) => {
      if (right.amount !== left.amount) {
        return right.amount - left.amount;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    })[0] ?? null;
}

export function assertBidWindowOpen(input: {
  round: Pick<AuctionRound, "status" | "roundNumber" | "bidDeadlineAt">;
  activeRoundNumber: number;
  state: BiddingEngineState;
  now: Date;
}) {
  if (input.state !== "OPEN") {
    return "Bidding is not currently open.";
  }

  if (
    input.round.status !== "ACTIVE" ||
    input.round.roundNumber !== input.activeRoundNumber
  ) {
    return "This round is no longer active.";
  }

  if (input.round.bidDeadlineAt && input.round.bidDeadlineAt <= input.now) {
    return "The bid timer has already expired.";
  }

  return null;
}

export function assertWinnerSelectionOpen(input: {
  state: BiddingEngineState;
  currentTurnTeamId: string | null;
  actingTeamId: string | null;
}) {
  if (input.state !== "WINNER_SELECTION") {
    return "Player selection is not currently open.";
  }

  if (!input.currentTurnTeamId || !input.actingTeamId) {
    return "No team is currently assigned to this pick.";
  }

  if (input.currentTurnTeamId !== input.actingTeamId) {
    return "It is not your turn.";
  }

  return null;
}
