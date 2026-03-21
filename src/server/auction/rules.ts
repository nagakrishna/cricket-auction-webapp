import type {
  AuctionSettings,
  Player,
  PlayerRole,
  TeamRosterEntry,
} from "@prisma/client";

type RosterRuleSettings = Pick<
  AuctionSettings,
  | "rosterSize"
  | "minBatsmen"
  | "maxBatsmen"
  | "minBowlers"
  | "maxBowlers"
  | "minAllRounders"
  | "maxAllRounders"
  | "minWicketkeepers"
  | "maxWicketkeepers"
>;

const playerRoles = [
  "BATSMAN",
  "BOWLER",
  "ALL_ROUNDER",
  "WICKETKEEPER",
] as const satisfies readonly PlayerRole[];

const roleMap: Record<
  PlayerRole,
  {
    min: keyof Pick<
      RosterRuleSettings,
      "minBatsmen" | "minBowlers" | "minAllRounders" | "minWicketkeepers"
    >;
    max: keyof Pick<
      RosterRuleSettings,
      "maxBatsmen" | "maxBowlers" | "maxAllRounders" | "maxWicketkeepers"
    >;
  }
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

export function getBenchRole(
  settings: RosterRuleSettings,
  roleCounts: Record<PlayerRole, number>,
): PlayerRole | null {
  const exceededRoles = playerRoles.filter((role) => {
    const { max } = roleMap[role];
    return roleCounts[role] === Number(settings[max]) + 1;
  });

  return exceededRoles.length === 1 ? exceededRoles[0] : null;
}

export function validateRosterPick(
  settings: RosterRuleSettings,
  rosterEntries: Array<TeamRosterEntry & { player: Pick<Player, "role"> }>,
  nextRole: PlayerRole,
) {
  if (rosterEntries.length >= settings.rosterSize) {
    return { valid: false, reason: "Roster is already full." };
  }

  const counts = buildRoleCounts(rosterEntries);
  counts[nextRole] += 1;

  const exceededRoles = playerRoles.filter((role) => {
    const { max } = roleMap[role];
    return counts[role] > Number(settings[max]);
  });

  if (exceededRoles.length > 1) {
    return {
      valid: false,
      reason: "Only one role may exceed its max as the bench player.",
    };
  }

  if (exceededRoles.length === 1) {
    const benchRole = exceededRoles[0];
    const { max } = roleMap[benchRole];
    if (counts[benchRole] > Number(settings[max]) + 1) {
      return {
        valid: false,
        reason: `${benchRole} bench limit reached.`,
      };
    }
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
