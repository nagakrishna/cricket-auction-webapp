import assert from "node:assert/strict";
import test from "node:test";

import {
  assertBidWindowOpen,
  assertWinnerSelectionOpen,
  getBiddingEngineState,
  getHighestAcceptedBid,
} from "@/server/auction/bidding-state-machine";
import { getExpiredAuctionTimerAction, shiftDeadlineAfterPause } from "@/server/auction/timer-rules";

test("maps paused auctions to an idle bidding state", () => {
  assert.equal(
    getBiddingEngineState({
      auctionStatus: "PAUSED",
      auctionPhase: "BIDDING",
      turnType: "BIDDING",
    }),
    "IDLE",
  );
});

test("maps a live bidding turn back to an open state after resume", () => {
  assert.equal(
    getBiddingEngineState({
      auctionStatus: "LIVE",
      auctionPhase: "BIDDING",
      turnType: "BIDDING",
    }),
    "OPEN",
  );
});

test("maps nomination turns to the nomination bidding state", () => {
  assert.equal(
    getBiddingEngineState({
      auctionStatus: "LIVE",
      auctionPhase: "BIDDING",
      turnType: "BIDDING_NOMINATION",
    }),
    "NOMINATION",
  );
});

test("chooses the highest accepted bid and breaks ties by earlier timestamp", () => {
  const winner = getHighestAcceptedBid([
    {
      amount: 1200,
      teamId: "team-b",
      createdAt: new Date("2026-03-17T12:00:02.000Z"),
      wasAccepted: true,
    },
    {
      amount: 1500,
      teamId: "team-c",
      createdAt: new Date("2026-03-17T12:00:03.000Z"),
      wasAccepted: false,
    },
    {
      amount: 1200,
      teamId: "team-a",
      createdAt: new Date("2026-03-17T12:00:01.000Z"),
      wasAccepted: true,
    },
  ]);

  assert.equal(winner?.teamId, "team-a");
  assert.equal(winner?.amount, 1200);
});

test("rejects bids after the active round timer has expired", () => {
  const error = assertBidWindowOpen({
    round: {
      status: "ACTIVE",
      roundNumber: 4,
      bidDeadlineAt: new Date("2026-03-17T12:00:00.000Z"),
    },
    activeRoundNumber: 4,
    state: "OPEN",
    now: new Date("2026-03-17T12:00:01.000Z"),
  });

  assert.equal(error, "The bid timer has already expired.");
});

test("enforces winner selection ownership checks", () => {
  const error = assertWinnerSelectionOpen({
    state: "WINNER_SELECTION",
    currentTurnTeamId: "team-a",
    actingTeamId: "team-b",
  });

  assert.equal(error, "It is not your turn.");
});

test("routes bidding nomination timeout into admin intervention handling", () => {
  const action = getExpiredAuctionTimerAction({
    turnType: "BIDDING_NOMINATION",
    bidDeadlineAt: null,
    biddingPlayerDeadlineAt: new Date("2026-03-17T12:00:00.000Z"),
    snakePickDeadlineAt: null,
    currentTurnTeamId: "team-a",
    now: new Date("2026-03-17T12:00:01.000Z"),
  });

  assert.equal(action, "BIDDING_NOMINATION");
});

test("shifts an active deadline forward by the paused duration on resume", () => {
  const shifted = shiftDeadlineAfterPause(
    new Date("2026-03-29T12:01:00.000Z"),
    new Date("2026-03-29T12:00:15.000Z"),
    new Date("2026-03-29T12:05:15.000Z"),
  );

  assert.equal(shifted?.toISOString(), "2026-03-29T12:06:00.000Z");
});

test("resumes an already-expired deadline at the current time", () => {
  const resumedAt = new Date("2026-03-29T12:05:15.000Z");
  const shifted = shiftDeadlineAfterPause(
    new Date("2026-03-29T12:00:10.000Z"),
    new Date("2026-03-29T12:00:15.000Z"),
    resumedAt,
  );

  assert.equal(shifted?.toISOString(), resumedAt.toISOString());
});
