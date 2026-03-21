export const MAX_BIDDING_WINS = 3;
export const MAX_BID_AMOUNT = 5000;

export function hasReachedBiddingWinLimit(
  biddingWins: number,
  maxBiddingWins = MAX_BIDDING_WINS,
) {
  return biddingWins >= maxBiddingWins;
}

export function isBidAmountUniqueInRound(
  acceptedBidAmounts: Iterable<number>,
  nextAmount: number,
) {
  for (const acceptedAmount of acceptedBidAmounts) {
    if (acceptedAmount === nextAmount) {
      return false;
    }
  }

  return true;
}

export function isBidHigherThanCurrentHighest(
  currentHighestBid: number | null,
  nextAmount: number,
) {
  if (currentHighestBid === null) {
    return true;
  }

  return nextAmount > currentHighestBid;
}

export function isInstantWinningBid(
  amount: number,
  maxBidAmount = MAX_BID_AMOUNT,
) {
  return amount === maxBidAmount;
}

export function getBidDeadlineAfterValidBid(now: Date, timerSeconds: number) {
  return new Date(now.getTime() + timerSeconds * 1000);
}
