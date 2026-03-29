import type { TurnType } from "@prisma/client";

export type ExpiredAuctionTimerAction =
  | "BIDDING_NOMINATION"
  | "BIDDING_BID"
  | "SNAKE_PICK"
  | null;

export function shiftDeadlineAfterPause(
  deadlineAt: Date | null,
  pausedAt: Date | null,
  resumedAt: Date,
) {
  if (!deadlineAt || !pausedAt) {
    return deadlineAt;
  }

  const remainingMs = deadlineAt.getTime() - pausedAt.getTime();

  if (remainingMs <= 0) {
    return new Date(resumedAt);
  }

  return new Date(resumedAt.getTime() + remainingMs);
}

type ExpiredTimerInput = {
  turnType: TurnType;
  bidDeadlineAt: Date | null;
  biddingPlayerDeadlineAt: Date | null;
  snakePickDeadlineAt: Date | null;
  currentTurnTeamId: string | null;
  now: Date;
};

export function getExpiredAuctionTimerAction(
  input: ExpiredTimerInput,
): ExpiredAuctionTimerAction {
  if (input.turnType === "BIDDING" && input.bidDeadlineAt && input.bidDeadlineAt <= input.now) {
    return "BIDDING_BID";
  }

  if (
    input.turnType === "BIDDING_NOMINATION" &&
    input.biddingPlayerDeadlineAt &&
    input.biddingPlayerDeadlineAt <= input.now
  ) {
    return "BIDDING_NOMINATION";
  }

  if (
    input.turnType === "SNAKE_PICK" &&
    input.snakePickDeadlineAt &&
    input.snakePickDeadlineAt <= input.now &&
    input.currentTurnTeamId
  ) {
    return "SNAKE_PICK";
  }

  return null;
}
