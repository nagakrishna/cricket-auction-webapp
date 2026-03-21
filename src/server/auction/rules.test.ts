import assert from "node:assert/strict";
import test from "node:test";
import type { AuctionSettings, PlayerRole, TeamRosterEntry } from "@prisma/client";

import { getBenchRole, validateRosterPick } from "@/server/auction/rules";

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

test("allows one role to exceed its max by one bench player", () => {
  const settings = createSettings({ maxBatsmen: 1 });
  const rosterEntries = [createRosterEntry("BATSMAN", 1)];

  const result = validateRosterPick(settings, rosterEntries, "BATSMAN");
  assert.equal(result.valid, true);
  assert.equal(result.reason, null);
});

test("prevents picks that exceed the same role max by more than one bench player", () => {
  const settings = createSettings({ maxBatsmen: 1 });
  const rosterEntries = [
    createRosterEntry("BATSMAN", 1),
    createRosterEntry("BATSMAN", 2),
  ];

  const result = validateRosterPick(settings, rosterEntries, "BATSMAN");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "BATSMAN bench limit reached.");
});

test("prevents picks that would put two roles above their max", () => {
  const settings = createSettings({
    rosterSize: 5,
    maxBatsmen: 1,
    maxBowlers: 1,
    minBatsmen: 0,
    minBowlers: 0,
  });
  const rosterEntries = [
    createRosterEntry("BATSMAN", 1),
    createRosterEntry("BATSMAN", 2),
    createRosterEntry("BOWLER", 3),
  ];

  const result = validateRosterPick(settings, rosterEntries, "BOWLER");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "Only one role may exceed its max as the bench player.");
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

test("derives the active bench role when exactly one role is at max plus one", () => {
  const settings = createSettings({ maxBowlers: 2 });

  const benchRole = getBenchRole(settings, {
    BATSMAN: 1,
    BOWLER: 3,
    ALL_ROUNDER: 0,
    WICKETKEEPER: 0,
  });

  assert.equal(benchRole, "BOWLER");
});

test("returns no bench role when no role exceeds its max", () => {
  const settings = createSettings();

  const benchRole = getBenchRole(settings, {
    BATSMAN: 1,
    BOWLER: 1,
    ALL_ROUNDER: 1,
    WICKETKEEPER: 0,
  });

  assert.equal(benchRole, null);
});
