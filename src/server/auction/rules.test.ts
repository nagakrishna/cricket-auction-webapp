import assert from "node:assert/strict";
import test from "node:test";
import type { AuctionSettings, PlayerRole, TeamRosterEntry } from "@prisma/client";

import { validateRosterPick } from "@/server/auction/rules";

function createSettings(overrides: Partial<AuctionSettings> = {}): AuctionSettings {
  return {
    id: "settings-1",
    auctionId: "auction-1",
    totalTeams: 10,
    rosterSize: 4,
    minBatsmen: 1,
    maxBatsmen: 2,
    minBowlers: 1,
    maxBowlers: 2,
    minAllRounders: 0,
    maxAllRounders: 2,
    minWicketkeepers: 0,
    maxWicketkeepers: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createRosterEntry(role: PlayerRole, index: number) {
  return {
    id: `entry-${index}`,
    auctionId: "auction-1",
    teamId: "team-1",
    playerId: `player-${index}`,
    roundId: `round-${index}`,
    phase: "BIDDING",
    amount: 100,
    pickNumber: index,
    createdAt: new Date(),
    updatedAt: new Date(),
    player: {
      role,
    },
  } satisfies TeamRosterEntry & { player: { role: PlayerRole } };
}

test("prevents picks once the roster is full", () => {
  const settings = createSettings({ rosterSize: 2 });
  const rosterEntries = [
    createRosterEntry("BATSMAN", 1),
    createRosterEntry("BOWLER", 2),
  ];

  const result = validateRosterPick(settings, rosterEntries, "ALL_ROUNDER");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "Roster is already full.");
});

test("prevents picks that exceed a role maximum", () => {
  const settings = createSettings({ maxBatsmen: 1 });
  const rosterEntries = [createRosterEntry("BATSMAN", 1)];

  const result = validateRosterPick(settings, rosterEntries, "BATSMAN");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "BATSMAN maximum reached.");
});

test("prevents picks that make the remaining minimums impossible", () => {
  const settings = createSettings({
    rosterSize: 3,
    minBatsmen: 1,
    minBowlers: 1,
    minAllRounders: 1,
  });
  const rosterEntries = [createRosterEntry("BATSMAN", 1)];

  const result = validateRosterPick(settings, rosterEntries, "BATSMAN");
  assert.equal(result.valid, false);
  assert.equal(
    result.reason,
    "This pick would make the remaining minimum role requirements impossible.",
  );
});

test("allows valid picks that keep the roster satisfiable", () => {
  const settings = createSettings({
    rosterSize: 4,
    minBatsmen: 1,
    minBowlers: 1,
    minAllRounders: 1,
  });
  const rosterEntries = [createRosterEntry("BATSMAN", 1)];

  const result = validateRosterPick(settings, rosterEntries, "BOWLER");
  assert.equal(result.valid, true);
  assert.equal(result.reason, null);
});
