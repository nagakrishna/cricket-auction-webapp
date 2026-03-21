import assert from "node:assert/strict";
import test from "node:test";

import {
  getBidDeadlineAfterValidBid,
  hasReachedBiddingWinLimit,
  isBidAmountUniqueInRound,
  isBidHigherThanCurrentHighest,
  isInstantWinningBid,
  MAX_BID_AMOUNT,
} from "@/server/auction/bidding-rules";

test("enforces unique accepted bid amounts within a round", () => {
  assert.equal(isBidAmountUniqueInRound([101, 250, 999], 250), false);
  assert.equal(isBidAmountUniqueInRound([101, 250, 999], 251), true);
});

test("requires a new bid to be strictly higher than the current highest bid", () => {
  assert.equal(isBidHigherThanCurrentHighest(null, 1), true);
  assert.equal(isBidHigherThanCurrentHighest(250, 249), false);
  assert.equal(isBidHigherThanCurrentHighest(250, 250), false);
  assert.equal(isBidHigherThanCurrentHighest(250, 251), true);
});

test("resets the bid deadline from the current server time", () => {
  const now = new Date("2026-03-17T12:00:00.000Z");
  const nextDeadline = getBidDeadlineAfterValidBid(now, 60);

  assert.equal(nextDeadline.toISOString(), "2026-03-17T12:01:00.000Z");
});

test("treats only the maximum bid as an instant win", () => {
  assert.equal(isInstantWinningBid(MAX_BID_AMOUNT), true);
  assert.equal(isInstantWinningBid(MAX_BID_AMOUNT - 1), false);
});

test("marks teams ineligible to bid after 3 bidding-phase wins", () => {
  assert.equal(hasReachedBiddingWinLimit(2), false);
  assert.equal(hasReachedBiddingWinLimit(3), true);
  assert.equal(hasReachedBiddingWinLimit(4), true);
});

test("supports configurable bidding win limits", () => {
  assert.equal(hasReachedBiddingWinLimit(1, 2), false);
  assert.equal(hasReachedBiddingWinLimit(2, 2), true);
  assert.equal(hasReachedBiddingWinLimit(3, 2), true);
});
