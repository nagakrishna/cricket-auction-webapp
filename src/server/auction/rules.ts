import type {
  AuctionSettings,
  Player,
  PlayerRole,
  TeamRosterEntry,
} from "@prisma/client";

const roleMap: Record<
  PlayerRole,
  { min: keyof AuctionSettings; max: keyof AuctionSettings }
> = {
  BATSMAN: { min: "minBatsmen", max: "maxBatsmen" },
  BOWLER: { min: "minBowlers", max: "maxBowlers" },
  ALL_ROUNDER: { min: "minAllRounders", max: "maxAllRounders" },
  WICKETKEEPER: { min: "minWicketkeepers", max: "maxWicketkeepers" },
};

export function buildRoleCounts(
  rosterEntries: Array<TeamRosterEntry & { player: Pick<Player, "role"> }>,
) {
  return {
    BATSMAN: rosterEntries.filter((entry) => entry.player.role === "BATSMAN").length,
    BOWLER: rosterEntries.filter((entry) => entry.player.role === "BOWLER").length,
    ALL_ROUNDER: rosterEntries.filter((entry) => entry.player.role === "ALL_ROUNDER").length,
    WICKETKEEPER: rosterEntries.filter((entry) => entry.player.role === "WICKETKEEPER").length,
  };
}

export function validateRosterPick(
  settings: AuctionSettings,
  rosterEntries: Array<TeamRosterEntry & { player: Pick<Player, "role"> }>,
  nextRole: PlayerRole,
) {
  if (rosterEntries.length >= settings.rosterSize) {
    return { valid: false, reason: "Roster is already full." };
  }

  const counts = buildRoleCounts(rosterEntries);
  counts[nextRole] += 1;

  const { max } = roleMap[nextRole];

  if (counts[nextRole] > Number(settings[max])) {
    return { valid: false, reason: `${nextRole} maximum reached.` };
  }

  const remainingSlots = settings.rosterSize - rosterEntries.length - 1;
  const requiredRemaining =
    Math.max(0, settings.minBatsmen - counts.BATSMAN) +
    Math.max(0, settings.minBowlers - counts.BOWLER) +
    Math.max(0, settings.minAllRounders - counts.ALL_ROUNDER) +
    Math.max(0, settings.minWicketkeepers - counts.WICKETKEEPER);

  if (requiredRemaining > remainingSlots) {
    return {
      valid: false,
      reason: "This pick would make the remaining minimum role requirements impossible.",
    };
  }

  return { valid: true, reason: null };
}
