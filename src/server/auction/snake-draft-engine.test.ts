import assert from "node:assert/strict";
import test from "node:test";
import type {
  AuctionPlayer,
  AuctionSettings,
  Player,
  Team,
  TeamRosterEntry,
} from "@prisma/client";

import {
  buildSnakeDraftInitialOrder,
  findHighestRankedValidAutoPick,
  getBiddingNominationTurn,
  getNextEligibleBiddingNominationTurn,
  getSnakeDraftCycleNumber,
  getSnakeDraftTurn,
} from "@/server/auction/snake-draft-engine";

function createTeam(id: string, name: string) {
  return { id, name } satisfies Pick<Team, "id" | "name">;
}

function createBiddingEntry(teamId: string, amount: number, createdAt: string) {
  return {
    teamId,
    amount,
    createdAt: new Date(createdAt),
  } satisfies Pick<TeamRosterEntry, "teamId" | "amount" | "createdAt">;
}

function createSettings(overrides: Partial<AuctionSettings> = {}): AuctionSettings {
  return {
    id: "settings-1",
    auctionId: "auction-1",
    totalTeams: 3,
    rosterSize: 4,
    minBatsmen: 0,
    maxBatsmen: 1,
    minBowlers: 1,
    maxBowlers: 3,
    minAllRounders: 0,
    maxAllRounders: 3,
    minWicketkeepers: 0,
    maxWicketkeepers: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createRosterEntry(role: Player["role"], index: number) {
  return {
    id: `entry-${index}`,
    auctionId: "auction-1",
    teamId: "team-1",
    playerId: `player-${index}`,
    roundId: `round-${index}`,
    phase: "SNAKE",
    amount: 0,
    pickNumber: index,
    createdAt: new Date(),
    updatedAt: new Date(),
    player: {
      role,
    },
  } satisfies TeamRosterEntry & { player: Pick<Player, "role"> };
}

function createAvailablePlayer(
  playerId: string,
  role: Player["role"],
  rankingScore: number,
) {
  return {
    id: `auction-player-${playerId}`,
    auctionId: "auction-1",
    playerId,
    status: "AVAILABLE",
    assignedTeamId: null,
    assignedRoundId: null,
    assignedPhase: null,
    assignedAmount: null,
    assignedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    player: {
      id: playerId,
      name: playerId,
      role,
      iplTeam: "Demo",
      rankingScore,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  } satisfies AuctionPlayer & { player: Player };
}

test("builds the initial snake order by spend descending with earlier spend timestamp as tie-breaker", () => {
  const order = buildSnakeDraftInitialOrder(
    [
      createTeam("team-a", "A"),
      createTeam("team-b", "B"),
      createTeam("team-c", "C"),
    ],
    [
      createBiddingEntry("team-a", 1000, "2026-03-17T12:00:01.000Z"),
      createBiddingEntry("team-b", 900, "2026-03-17T12:00:02.000Z"),
      createBiddingEntry("team-c", 1000, "2026-03-17T12:00:03.000Z"),
    ],
  );

  assert.deepEqual(order, ["team-a", "team-c", "team-b"]);
});

test("reverses the snake order every round", () => {
  const order = ["team-a", "team-b", "team-c"];

  assert.deepEqual(getSnakeDraftTurn(order, 0, 3), {
    teamId: "team-a",
    cycleNumber: 1,
    slotIndex: 0,
    reversed: false,
  });

  assert.deepEqual(getSnakeDraftTurn(order, 3, 3), {
    teamId: "team-c",
    cycleNumber: 2,
    slotIndex: 0,
    reversed: true,
  });
});

test("uses the randomized nomination order in snake style across bidding cycles", () => {
  const order = ["team-a", "team-b", "team-c"];

  assert.deepEqual(getBiddingNominationTurn(order, 0, 3), {
    teamId: "team-a",
    cycleNumber: 1,
    slotIndex: 0,
    reversed: false,
  });

  assert.deepEqual(getBiddingNominationTurn(order, 3, 3), {
    teamId: "team-c",
    cycleNumber: 2,
    slotIndex: 0,
    reversed: true,
  });

  assert.deepEqual(getBiddingNominationTurn(order, 6, 3), {
    teamId: "team-a",
    cycleNumber: 3,
    slotIndex: 0,
    reversed: false,
  });
});

test("skips teams that already reached the bidding pick quota when choosing the next nomination turn", () => {
  const order = ["team-a", "team-b", "team-c"];
  const biddingWinsByTeam = new Map([
    ["team-a", 1],
    ["team-b", 2],
    ["team-c", 0],
  ]);

  assert.deepEqual(
    getNextEligibleBiddingNominationTurn(order, 1, 3, biddingWinsByTeam, 2),
    {
      teamId: "team-c",
      cycleNumber: 1,
      slotIndex: 2,
      reversed: false,
    },
  );
});

test("skips across a snake cycle boundary when a maxed-out team appears twice in a row", () => {
  const order = ["team-a", "team-b"];
  const biddingWinsByTeam = new Map([
    ["team-a", 2],
    ["team-b", 1],
  ]);

  assert.deepEqual(
    getNextEligibleBiddingNominationTurn(order, 5, 2, biddingWinsByTeam, 2),
    {
      teamId: "team-b",
      cycleNumber: 3,
      slotIndex: 1,
      reversed: false,
    },
  );
});

test("treats a snake round as one full pass across all participating teams", () => {
  assert.equal(getSnakeDraftCycleNumber(0, 3), 1);
  assert.equal(getSnakeDraftCycleNumber(1, 3), 1);
  assert.equal(getSnakeDraftCycleNumber(2, 3), 1);
  assert.equal(getSnakeDraftCycleNumber(3, 3), 2);
});

test("auto-pick chooses the highest-ranked valid available player", () => {
  const result = findHighestRankedValidAutoPick(
    createSettings(),
    [createRosterEntry("BATSMAN", 1)],
    [
      createAvailablePlayer("player-1", "BATSMAN", 99),
      createAvailablePlayer("player-2", "BOWLER", 95),
      createAvailablePlayer("player-3", "ALL_ROUNDER", 90),
    ],
  );

  assert.equal(result.playerId, "player-2");
  assert.equal(result.reason, null);
});

test("returns admin-intervention guidance when no valid auto-pick exists", () => {
  const result = findHighestRankedValidAutoPick(
    createSettings({
      rosterSize: 2,
      minBowlers: 1,
      maxBatsmen: 1,
    }),
    [createRosterEntry("BATSMAN", 1)],
    [createAvailablePlayer("player-1", "BATSMAN", 99)],
  );

  assert.equal(result.playerId, null);
  assert.equal(
    result.reason,
    "Snake auto-pick could not find a roster-valid available player.",
  );
});
