import { Prisma, type PlayerRole, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getAuctionRoomName, AUCTION_SOCKET_EVENTS } from "@/lib/realtime/contracts";
import {
  bidSchema,
  nominatePlayerSchema,
  passBidSchema,
  pickPlayerSchema,
  resolveNominationSchema,
  reopenBiddingRoundSchema,
} from "@/lib/validation/auction";
import type { AuctionSnapshot } from "@/lib/realtime/events";
import { getSocketServer } from "@/lib/realtime/socket-registry";
import {
  assertBidWindowOpen,
  getBiddingEngineState,
  getHighestAcceptedBid,
} from "@/server/auction/bidding-state-machine";
import {
  getBidDeadlineAfterValidBid,
  hasReachedBiddingWinLimit,
  isBidHigherThanCurrentHighest,
  isBidAmountUniqueInRound,
  isInstantWinningBid,
} from "@/server/auction/bidding-rules";
import { validateRosterPick, buildRoleCounts } from "@/server/auction/rules";
import {
  buildSnakeDraftInitialOrder,
  findHighestRankedValidAutoPick,
  getNextEligibleBiddingNominationTurn,
  getSnakeDraftCycleNumber,
  getSnakeDraftTurn,
  shuffleTeamOrder,
} from "@/server/auction/snake-draft-engine";
import { selectParticipatingTeams } from "@/server/teams/team-service";
import { getExpiredAuctionTimerAction } from "@/server/auction/timer-rules";
import { writeAuditLog } from "@/server/logs/audit-log";

type DbClient = PrismaClient | Prisma.TransactionClient;
type AuctionWithSettings = Prisma.AuctionGetPayload<{
  include: {
    settings: true;
  };
}> & {
  settings: NonNullable<
    Prisma.AuctionGetPayload<{
      include: {
        settings: true;
      };
    }>["settings"]
  >;
};

type PersistedOrderRow = {
  teamId: string;
  teamName: string;
  shortCode: string;
  position: number;
};

type UndoAdminInterventionType =
  | "REOPEN_NOMINATION"
  | "REOPEN_BIDDING"
  | "MANUAL_NOMINATION";

type UndoableAdminIntervention = {
  logId: string;
  roundId: string;
  label: string;
  undoType: UndoAdminInterventionType;
};

type CorrectableLastPick = {
  rosterEntryId: string;
  roundId: string;
  label: string;
  playerName: string;
  teamName: string;
  phase: "BIDDING" | "SNAKE";
};

function addSeconds(base: Date, seconds: number) {
  return new Date(base.getTime() + seconds * 1000);
}

function asRecord(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, Prisma.JsonValue>;
}

function parseUndoType(value: Prisma.JsonValue | undefined): UndoAdminInterventionType | null {
  if (
    value === "REOPEN_NOMINATION" ||
    value === "REOPEN_BIDDING" ||
    value === "MANUAL_NOMINATION"
  ) {
    return value;
  }

  return null;
}

function toPersistedOrderRow(
  team: { id: string; name: string; shortCode: string },
  position: number,
): PersistedOrderRow {
  return {
    teamId: team.id,
    teamName: team.name,
    shortCode: team.shortCode,
    position,
  };
}

function parsePersistedOrder(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return [] as PersistedOrderRow[];
  }

  return value
    .map((row) => {
      if (
        row &&
        typeof row === "object" &&
        "teamId" in row &&
        "teamName" in row &&
        "shortCode" in row &&
        "position" in row
      ) {
        const candidate = row as {
          teamId: unknown;
          teamName: unknown;
          shortCode: unknown;
          position: unknown;
        };

        if (
          typeof candidate.teamId === "string" &&
          typeof candidate.teamName === "string" &&
          typeof candidate.shortCode === "string" &&
          typeof candidate.position === "number"
        ) {
          return {
            teamId: candidate.teamId,
            teamName: candidate.teamName,
            shortCode: candidate.shortCode,
            position: candidate.position,
          } satisfies PersistedOrderRow;
        }
      }

      return null;
    })
    .filter((row): row is PersistedOrderRow => row !== null);
}

function normalizeManualReason(
  phase: AuctionWithSettings["phase"],
  manualReason: string | null | undefined,
) {
  if (!manualReason) {
    return null;
  }

  if (
    phase === "BIDDING" &&
    manualReason === "Winning team did not select a player before timeout."
  ) {
    return "This bidding round is waiting for admin intervention.";
  }

  return manualReason;
}

function formatTeamOrder(teamNames: string[]) {
  return teamNames.join(" -> ");
}

async function getTeamNameMap(db: DbClient, teamIds: string[]) {
  const uniqueTeamIds = [...new Set(teamIds)];

  if (uniqueTeamIds.length === 0) {
    return new Map<string, string>();
  }

  const teams = await db.team.findMany({
    where: {
      id: {
        in: uniqueTeamIds,
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  return new Map(teams.map((team) => [team.id, team.name]));
}

async function getParticipatingTeams(
  db: DbClient,
  auction: AuctionWithSettings,
) {
  const teams = await db.team.findMany({
    orderBy: {
      createdAt: "asc",
    },
  });

  return selectParticipatingTeams(teams, auction.settings.totalTeams);
}

async function assertParticipatingTeam(
  db: DbClient,
  auction: AuctionWithSettings,
  teamId: string,
) {
  const participatingTeams = await getParticipatingTeams(db, auction);
  return participatingTeams.some((team) => team.id === teamId);
}

async function getAuctionOrThrow(db: DbClient): Promise<AuctionWithSettings> {
  const auction = await db.auction.findFirst({
    where: {
      status: {
        in: ["DRAFT", "READY", "LIVE", "PAUSED", "COMPLETED"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      settings: true,
    },
  });

  if (!auction || !auction.settings) {
    throw new Error("No configured auction found.");
  }

  return auction as AuctionWithSettings;
}

async function getAuctionByIdOrThrow(
  db: DbClient,
  auctionId: string,
): Promise<AuctionWithSettings> {
  const auction = await db.auction.findUnique({
    where: { id: auctionId },
    include: {
      settings: true,
    },
  });

  if (!auction || !auction.settings) {
    throw new Error("No configured auction found.");
  }

  return auction as AuctionWithSettings;
}

async function getOwnerTeam(db: DbClient, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      teamOwnerships: true,
    },
  });

  return {
    user,
    team: user?.teamOwnerships[0] ?? null,
  };
}

async function getSnakeOrder(db: DbClient, auctionId: string) {
  const auction = await getAuctionOrThrow(db);
  const teams = await getParticipatingTeams(db, auction);

  const biddingEntries = await db.teamRosterEntry.findMany({
    where: {
      auctionId,
      phase: "BIDDING",
    },
    include: {
      team: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return buildSnakeDraftInitialOrder(teams, biddingEntries);
}

async function getParticipatingTeamCount(db: DbClient, auction: AuctionWithSettings) {
  const teams = await getParticipatingTeams(db, auction);
  return teams.length;
}

async function getPassedTeamIdsForRound(db: DbClient, roundId: string) {
  const passes = await db.bid.findMany({
    where: {
      roundId,
      wasAccepted: false,
      rejectionCode: "PASSED",
    },
    select: {
      teamId: true,
    },
  });

  return new Set(passes.map((pass) => pass.teamId));
}

async function getEligibleBiddingTeamIds(
  db: DbClient,
  auction: AuctionWithSettings,
  nominatedPlayerRole: PlayerRole,
) {
  const participatingTeams = await getParticipatingTeams(db, auction);
  const eligibleTeamIds: string[] = [];

  for (const team of participatingTeams) {
    const biddingWins = await db.teamRosterEntry.count({
      where: {
        auctionId: auction.id,
        teamId: team.id,
        phase: "BIDDING",
      },
    });

    if (hasReachedBiddingWinLimit(biddingWins, auction.biddingRoundSize)) {
      continue;
    }

    const roster = await db.teamRosterEntry.findMany({
      where: {
        auctionId: auction.id,
        teamId: team.id,
      },
      include: {
        player: {
          select: {
            role: true,
          },
        },
      },
    });

    const validity = validateRosterPick(auction.settings, roster, nominatedPlayerRole);
    if (validity.valid) {
      eligibleTeamIds.push(team.id);
    }
  }

  return eligibleTeamIds;
}

async function getBiddingWinCountByTeam(
  db: DbClient,
  auctionId: string,
  teamIds: string[],
) {
  const counts = await db.teamRosterEntry.groupBy({
    by: ["teamId"],
    where: {
      auctionId,
      phase: "BIDDING",
      teamId: {
        in: teamIds,
      },
    },
    _count: {
      _all: true,
    },
  });

  return new Map(counts.map((entry) => [entry.teamId, entry._count._all]));
}

async function maybeStartFinalCallCountdown(
  db: DbClient,
  auction: AuctionWithSettings,
  roundId: string,
  nominatedPlayerRole: PlayerRole,
) {
  const activeRound = await db.auctionRound.findUnique({
    where: { id: roundId },
    include: {
      bids: {
        where: {
          wasAccepted: true,
        },
      },
    },
  });

  if (!activeRound) {
    return false;
  }

  const highestAcceptedBid = getHighestAcceptedBid(activeRound.bids);
  if (!highestAcceptedBid) {
    return false;
  }

  const eligibleTeamIds = await getEligibleBiddingTeamIds(db, auction, nominatedPlayerRole);
  const passedTeamIds = await getPassedTeamIdsForRound(db, roundId);
  const remainingChallengers = eligibleTeamIds.filter(
    (teamId) => teamId !== highestAcceptedBid.teamId && !passedTeamIds.has(teamId),
  );

  if (remainingChallengers.length > 0) {
    return false;
  }

  const currentDeadline = activeRound.bidDeadlineAt;
  const finalCallDeadlineAt = addSeconds(new Date(), 3);

  // Only shorten the timer when we have genuinely reached the "everyone else passed"
  // state. We avoid extending an already shorter final call if concurrent updates race.
  if (!currentDeadline || currentDeadline.getTime() - Date.now() > 3000) {
    await db.auctionRound.update({
      where: { id: roundId },
      data: {
        bidDeadlineAt: finalCallDeadlineAt,
      },
    });

    await writeAuditLog({
      auctionId: auction.id,
      action: "BID_TIMER_RESET",
      entityType: "auction_round",
      entityId: roundId,
      message: "All remaining eligible teams passed. Final call countdown started.",
      metadata: {
        leadingTeamId: highestAcceptedBid.teamId,
        leadingBidAmount: highestAcceptedBid.amount,
        finalCallDeadlineAt: finalCallDeadlineAt.toISOString(),
      },
    }, db);
  }

  return true;
}

async function getBiddingNominationBaseOrder(
  db: DbClient,
  auction: AuctionWithSettings,
) {
  const persisted = parsePersistedOrder(auction.biddingNominationOrder);

  if (persisted.length > 0) {
    return persisted;
  }

  const teams = await getParticipatingTeams(db, auction);
  return teams.map((team, index) => toPersistedOrderRow(team, index + 1));
}

async function getNextSnakeTurnTeamId(db: DbClient, auctionId: string) {
  const auction = await getAuctionOrThrow(db);
  const teams = await getParticipatingTeams(db, auction);
  const snakeEntries = await db.teamRosterEntry.count({
    where: {
      auctionId,
      phase: "SNAKE",
    },
  });
  const order = await getSnakeOrder(db, auctionId);
  const rosterCounts = await db.teamRosterEntry.groupBy({
    by: ["teamId"],
    where: {
      auctionId,
      teamId: {
        in: teams.map((team) => team.id),
      },
    },
    _count: {
      _all: true,
    },
  });
  const rosterCountByTeam = new Map(
    rosterCounts.map((entry) => [entry.teamId, entry._count._all]),
  );
  const teamsInAuction = teams.length;

  for (let offset = 0; offset < teamsInAuction; offset += 1) {
    const turn = getSnakeDraftTurn(order, snakeEntries + offset, teamsInAuction);
    const rosterSize = rosterCountByTeam.get(turn.teamId) ?? 0;

    if (rosterSize < auction.settings.rosterSize) {
      return turn.teamId;
    }
  }

  return null;
}

async function ensureNextBiddingRound(db: DbClient, auctionId: string) {
  const auction = await getAuctionOrThrow(db);
  const nominationOrder = await getBiddingNominationBaseOrder(db, auction);
  const teamsInAuction = nominationOrder.length;
  const biddingPicks = await db.teamRosterEntry.count({
    where: {
      auctionId,
      phase: "BIDDING",
    },
  });

  const totalBiddingAssignments = auction.biddingRoundSize * teamsInAuction;

  if (biddingPicks >= totalBiddingAssignments) {
    return transitionToSnakePhase(db, auctionId);
  }

  const nominationTeamIds = nominationOrder.map((entry) => entry.teamId);
  const biddingWinCountByTeam = await getBiddingWinCountByTeam(
    db,
    auctionId,
    nominationTeamIds,
  );

  const nextTurn = getNextEligibleBiddingNominationTurn(
    nominationTeamIds,
    biddingPicks,
    teamsInAuction,
    biddingWinCountByTeam,
    auction.biddingRoundSize,
  );

  if (!nextTurn) {
    return transitionToSnakePhase(db, auctionId);
  }

  const nextNominationTeamName =
    nominationOrder.find((entry) => entry.teamId === nextTurn.teamId)?.teamName ??
    "the next team";

  const roundNumber = biddingPicks + 1;
  const nominationDeadlineAt = addSeconds(new Date(), auction.selectionTimerSeconds);

  const round = await db.auctionRound.create({
    data: {
      auctionId,
      roundNumber,
      phase: "BIDDING",
      turnType: "BIDDING_NOMINATION",
      status: "ACTIVE",
      startedAt: new Date(),
      selectionDeadlineAt: nominationDeadlineAt,
      nominatingTeamId: nextTurn.teamId,
      nominationCycleNumber: nextTurn.cycleNumber,
      nominationOrderPosition: nextTurn.slotIndex,
    },
  });

  await db.auction.update({
    where: { id: auctionId },
    data: {
      status: "LIVE",
      phase: "BIDDING",
      turnType: "BIDDING_NOMINATION",
      activeRoundNumber: roundNumber,
      currentTurnTeamId: nextTurn.teamId,
      biddingPlayerDeadlineAt: nominationDeadlineAt,
      snakePickDeadlineAt: null,
    },
  });

  await writeAuditLog({
    auctionId,
    action: "BIDDING_ROUND_STARTED",
    entityType: "auction_round",
    entityId: round.id,
    message: `Bidding nomination ${roundNumber} started for ${nextNominationTeamName}.`,
    metadata: {
      roundNumber,
      nominationCycleNumber: nextTurn.cycleNumber,
      nominationOrderPosition: nextTurn.slotIndex,
      nominatingTeamId: nextTurn.teamId,
      nominationDeadlineAt: nominationDeadlineAt.toISOString(),
    },
  }, db);

  return round;
}

async function transitionToSnakePhase(db: DbClient, auctionId: string) {
  const auction = await getAuctionOrThrow(db);
  const teams = await getParticipatingTeams(db, auction);
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const teamsInAuction = teams.length;
  const totalBiddingAssignments = auction.biddingRoundSize * teamsInAuction;
  const biddingPicks = await db.teamRosterEntry.count({
    where: {
      auctionId,
      phase: "BIDDING",
    },
  });

  if (biddingPicks < totalBiddingAssignments) {
    throw new Error("Snake draft cannot begin before all bidding picks complete.");
  }

  const teamId = await getNextSnakeTurnTeamId(db, auctionId);
  if (!teamId) {
    await finalizeAuctionIfComplete(db, auctionId);
    return null;
  }
  const snakeOrder = await getSnakeOrder(db, auctionId);
  const snakeOrderNames = snakeOrder.map((currentTeamId) =>
    teamNameById.get(currentTeamId) ?? currentTeamId,
  );
  const currentTeamName = teamNameById.get(teamId) ?? "the next team";
  const snakeEntries = await db.teamRosterEntry.count({
    where: {
      auctionId,
      phase: "SNAKE",
    },
  });

  const roundNumber = totalBiddingAssignments + snakeEntries + 1;
  const deadlineAt = addSeconds(new Date(), auction.snakeTimerSeconds);

  const round = await db.auctionRound.create({
    data: {
      auctionId,
      roundNumber,
      phase: "SNAKE",
      turnType: "SNAKE_PICK",
      status: "ACTIVE",
      startedAt: new Date(),
      snakeOrderPosition: getSnakeDraftTurn(snakeOrder, snakeEntries, teamsInAuction).slotIndex,
      selectionDeadlineAt: deadlineAt,
    },
  });

  await db.auction.update({
    where: { id: auctionId },
    data: {
      phase: "SNAKE",
      turnType: "SNAKE_PICK",
      activeRoundNumber: roundNumber,
      currentTurnTeamId: teamId,
      biddingPlayerDeadlineAt: null,
      snakePickDeadlineAt: deadlineAt,
    },
  });

  await writeAuditLog({
    auctionId,
    action: "BIDDING_ROUND_STARTED",
    entityType: "auction_round",
    entityId: round.id,
    message: `Snake order set from auction spend: ${formatTeamOrder(snakeOrderNames)}.`,
    metadata: {
      snakeOrder: snakeOrderNames,
    },
  }, db);

  await writeAuditLog({
    auctionId,
    action: "BIDDING_ROUND_STARTED",
    entityType: "auction_round",
    entityId: round.id,
    message: `Snake draft started with ${currentTeamName} on the clock.`,
    metadata: {
      teamId,
      deadlineAt: deadlineAt.toISOString(),
    },
  }, db);

  return round;
}

async function finalizeBiddingRoundWinner(
  db: DbClient,
  auctionId: string,
  roundId: string,
  teamId: string,
  amount: number,
) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { name: true },
  });

  await db.auctionRound.update({
    where: { id: roundId },
    data: {
      status: "CLOSED",
      winningTeamId: teamId,
      winningBidAmount: amount,
      spendReachedAt: new Date(),
      endedAt: new Date(),
      bidDeadlineAt: null,
      selectionDeadlineAt: null,
    },
  });

  await db.auction.update({
    where: { id: auctionId },
    data: {
      turnType: "IDLE",
      currentTurnTeamId: null,
      biddingPlayerDeadlineAt: null,
    },
  });

  await writeAuditLog({
    auctionId,
    action: "BIDDING_ROUND_WON",
    entityType: "auction_round",
    entityId: roundId,
    message: `${team?.name ?? "A team"} won the bidding round for ${amount}.`,
    metadata: {
      teamId,
      amount,
    },
  }, db);
}

async function assignPlayerToTeam(
  db: DbClient,
  input: {
    auction: AuctionWithSettings;
    round: Prisma.AuctionRoundGetPayload<{
      include: {
        nominatedPlayer: true;
      };
    }>;
    teamId: string;
    playerId: string;
    amount: number;
    actorId?: string | null;
    source: "BIDDING_WIN" | "OWNER" | "ADMIN" | "AUTO";
  },
) {
  const availablePlayer = await db.auctionPlayer.findFirst({
    where: {
      auctionId: input.auction.id,
      playerId: input.playerId,
      status: "AVAILABLE",
    },
    include: {
      player: true,
    },
  });

  if (!availablePlayer) {
    return { ok: false as const, error: "Player is not available." };
  }

  const rosterEntries = await db.teamRosterEntry.findMany({
    where: {
      auctionId: input.auction.id,
      teamId: input.teamId,
    },
    include: {
      player: {
        select: {
          role: true,
        },
      },
    },
  });

  const validity = validateRosterPick(
    input.auction.settings,
    rosterEntries,
    availablePlayer.player.role,
  );

  if (!validity.valid) {
    await writeAuditLog({
      auctionId: input.auction.id,
      actorId: input.actorId ?? undefined,
      action: "INVALID_PICK_ATTEMPT",
      entityType: "player",
      entityId: input.playerId,
      message: validity.reason ?? "Invalid pick.",
      metadata: {
        teamId: input.teamId,
        roundId: input.round.id,
        source: input.source,
      },
    }, db);

    return { ok: false as const, error: validity.reason ?? "Invalid pick." };
  }

  const pickNumber =
    (await db.teamRosterEntry.count({
      where: { auctionId: input.auction.id },
    })) + 1;

  await db.teamRosterEntry.create({
    data: {
      auctionId: input.auction.id,
      teamId: input.teamId,
      playerId: input.playerId,
      roundId: input.round.id,
      phase: input.round.phase === "BIDDING" ? "BIDDING" : "SNAKE",
      amount: input.round.phase === "BIDDING" ? input.amount : 0,
      pickNumber,
    },
  });

  await db.auctionPlayer.update({
    where: {
      auctionId_playerId: {
        auctionId: input.auction.id,
        playerId: input.playerId,
      },
    },
    data: {
      status: "ASSIGNED",
      assignedTeamId: input.teamId,
      assignedPhase: input.round.phase === "BIDDING" ? "BIDDING" : "SNAKE",
      assignedAmount: input.round.phase === "BIDDING" ? input.amount : 0,
      assignedAt: new Date(),
      assignedRoundId: input.round.id,
    },
  });

  const team = await db.team.findUnique({
    where: { id: input.teamId },
    select: { name: true },
  });
  const teamName = team?.name ?? "Unknown team";
  const totalTeamRosterEntries = rosterEntries.length + 1;

  if (input.round.phase === "BIDDING") {
    const biddingSummary = await db.teamRosterEntry.aggregate({
      where: {
        auctionId: input.auction.id,
        teamId: input.teamId,
        phase: "BIDDING",
      },
      _count: {
        _all: true,
      },
      _sum: {
        amount: true,
      },
    });

    if (biddingSummary._count._all === input.auction.biddingRoundSize) {
      await writeAuditLog({
        auctionId: input.auction.id,
        actorId: input.actorId ?? undefined,
        action: "BIDDING_ROUND_WON",
        entityType: "team",
        entityId: input.teamId,
        message: `${teamName} completed the auction phase with total spend ${biddingSummary._sum.amount ?? 0}.`,
        metadata: {
          teamId: input.teamId,
          auctionPlayers: input.auction.biddingRoundSize,
          totalSpend: biddingSummary._sum.amount ?? 0,
        },
      }, db);
    }
  }

  if (totalTeamRosterEntries === input.auction.settings.rosterSize) {
    await writeAuditLog({
      auctionId: input.auction.id,
      actorId: input.actorId ?? undefined,
      action: "PLAYER_PICKED",
      entityType: "team",
      entityId: input.teamId,
      message: `${teamName} completed the roster.`,
      metadata: {
        teamId: input.teamId,
        rosterSize: input.auction.settings.rosterSize,
      },
    }, db);
  }

  return {
    ok: true as const,
    player: availablePlayer.player,
    teamName,
  };
}

async function finalizeAuctionIfComplete(db: DbClient, auctionId: string) {
  const auction = await getAuctionOrThrow(db);
  const settings = auction.settings;
  const totalExpectedPicks =
    (await getParticipatingTeamCount(db, auction)) * settings.rosterSize;

  const rosterCount = await db.teamRosterEntry.count({
    where: { auctionId },
  });

  if (rosterCount < totalExpectedPicks) {
    return false;
  }

  await db.auction.update({
    where: { id: auctionId },
    data: {
      status: "COMPLETED",
      phase: "COMPLETE",
      turnType: "IDLE",
      currentTurnTeamId: null,
      biddingPlayerDeadlineAt: null,
      snakePickDeadlineAt: null,
    },
  });

  await writeAuditLog({
    auctionId,
    action: "AUCTION_COMPLETED",
    entityType: "auction",
    entityId: auctionId,
    message: "Auction completed successfully.",
  }, db);

  return true;
}

export async function getAuctionSnapshot(): Promise<AuctionSnapshot> {
  let auction = await getAuctionOrThrow(prisma);
  await processExpiredTimersForAuction(auction, { broadcast: false });
  auction = await getAuctionByIdOrThrow(prisma, auction.id);
  const activeRound = await prisma.auctionRound.findUnique({
    where: {
      auctionId_roundNumber: {
        auctionId: auction.id,
        roundNumber: auction.activeRoundNumber,
      },
    },
    include: {
      nominatedPlayer: true,
      bids: {
        include: {
          team: true,
        },
        orderBy: [{ createdAt: "desc" }],
      },
    },
  });

  const rosterEntries = await prisma.teamRosterEntry.findMany({
    where: { auctionId: auction.id },
    include: {
      team: true,
      player: true,
    },
    orderBy: {
      pickNumber: "asc",
    },
  });

  const snakePicksCompleted = rosterEntries.filter(
    (entry) => entry.phase === "SNAKE",
  ).length;

  const currentTurnRoster = auction.currentTurnTeamId
    ? await prisma.teamRosterEntry.findMany({
        where: {
          auctionId: auction.id,
          teamId: auction.currentTurnTeamId,
        },
        include: {
          player: {
            select: {
              role: true,
            },
          },
        },
      })
    : [];

  const availablePlayers = await prisma.auctionPlayer.findMany({
    where: {
      auctionId: auction.id,
      status: "AVAILABLE",
    },
    include: {
      player: true,
    },
    orderBy: [
      {
        player: {
          rankingScore: "asc",
        },
      },
      {
        player: {
          name: "asc",
        },
      },
    ],
  });

  const activity = await prisma.auditLog.findMany({
    where: { auctionId: auction.id },
    orderBy: {
      createdAt: "desc",
    },
    take: 25,
  });

  const participatingTeams = await getParticipatingTeams(prisma, auction);
  const biddingNominationOrder = parsePersistedOrder(auction.biddingNominationOrder);
  const currentRoundNumber =
    auction.phase === "SNAKE"
      ? getSnakeDraftCycleNumber(
          snakePicksCompleted,
          Math.max(participatingTeams.length, 1),
        )
      : auction.activeRoundNumber;
  const snakeOrderPreview =
    auction.phase === "SNAKE"
      ? (await getSnakeOrder(prisma, auction.id)).map((teamId, index) => {
          const team = participatingTeams.find((entry) => entry.id === teamId);

          return {
            teamId,
            teamName: team?.name ?? teamId,
            shortCode: team?.shortCode ?? "",
            position: index + 1,
          };
        })
      : null;
  const teams = await prisma.team.findMany({
    where: {
      id: {
        in: participatingTeams.map((team) => team.id),
      },
    },
    include: {
      rosterEntries: {
        where: { auctionId: auction.id },
        include: {
          player: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const leaderboard = teams.map((team) => {
    const spend = team.rosterEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const biddingWins = team.rosterEntries.filter(
      (entry) => entry.phase === "BIDDING",
    ).length;
    return {
      teamId: team.id,
      teamName: team.name,
      shortCode: team.shortCode,
      spend,
      biddingWins,
      players: team.rosterEntries.length,
      roleCounts: buildRoleCounts(team.rosterEntries),
    };
  });

  const highestAcceptedBid = activeRound
    ? getHighestAcceptedBid(activeRound.bids)
    : null;
  const passedTeams =
    activeRound?.bids
      .filter((bid) => !bid.wasAccepted && bid.rejectionCode === "PASSED")
      .reduce<Array<{ teamId: string; teamName: string }>>((teams, bid) => {
        if (!teams.some((entry) => entry.teamId === bid.teamId)) {
          teams.push({
            teamId: bid.teamId,
            teamName: bid.team.name,
          });
        }

        return teams;
      }, []) ?? [];
  const finalCallActive =
    auction.turnType === "BIDDING" &&
    !!activeRound?.bidDeadlineAt &&
    (() => {
      const diff = activeRound.bidDeadlineAt.getTime() - Date.now();
      return diff <= 3000;
    })();

  return {
    auctionId: auction.id,
    name: auction.name,
    status: auction.status,
    phase: auction.phase,
    turnType: auction.turnType,
    currentRoundNumber,
    currentTurnTeamId: auction.currentTurnTeamId,
    currentNominatorTeamId:
      auction.turnType === "BIDDING_NOMINATION"
        ? auction.currentTurnTeamId
        : activeRound?.nominatingTeamId ?? null,
    deadlineAt:
      auction.turnType === "BIDDING_NOMINATION"
        ? auction.biddingPlayerDeadlineAt?.toISOString() ?? null
        : auction.turnType === "BIDDING"
        ? activeRound?.bidDeadlineAt?.toISOString() ?? null
          : auction.snakePickDeadlineAt?.toISOString() ?? null,
    manualReason: normalizeManualReason(auction.phase, activeRound?.manualReason ?? null),
    highestBid: highestAcceptedBid?.amount ?? null,
    highestBidTeamId: highestAcceptedBid?.teamId ?? null,
    activeRoundId: activeRound?.id ?? null,
    passedTeams,
    finalCallActive,
    nominationCycleNumber: activeRound?.nominationCycleNumber ?? null,
    nominationPhaseLabel:
      auction.turnType === "BIDDING_NOMINATION"
        ? activeRound?.nominationCycleNumber
          ? `Nomination cycle ${activeRound.nominationCycleNumber}`
          : "Nomination turn"
        : auction.turnType === "BIDDING" && activeRound?.nominationCycleNumber
          ? `Bidding for nomination cycle ${activeRound.nominationCycleNumber}`
          : null,
    currentNominatedPlayer: activeRound?.nominatedPlayer
      ? {
          playerId: activeRound.nominatedPlayer.id,
          name: activeRound.nominatedPlayer.name,
          role: activeRound.nominatedPlayer.role,
          iplTeam: activeRound.nominatedPlayer.iplTeam,
          rankingScore: activeRound.nominatedPlayer.rankingScore,
        }
      : null,
    settings: {
      rosterSize: auction.settings.rosterSize,
      auctionPlayers: auction.biddingRoundSize,
      biddingTimerSeconds: auction.biddingTimerSeconds,
      selectionTimerSeconds: auction.selectionTimerSeconds,
      snakeTimerSeconds: auction.snakeTimerSeconds,
      minBatsmen: auction.settings.minBatsmen,
      maxBatsmen: auction.settings.maxBatsmen,
      minBowlers: auction.settings.minBowlers,
      maxBowlers: auction.settings.maxBowlers,
      minAllRounders: auction.settings.minAllRounders,
      maxAllRounders: auction.settings.maxAllRounders,
      minWicketkeepers: auction.settings.minWicketkeepers,
      maxWicketkeepers: auction.settings.maxWicketkeepers,
    },
    biddingNominationOrder,
    snakeOrderPreview,
    leaderboard,
    bidFeed:
      activeRound?.bids
        .slice(0, 10)
        .map((bid) => ({
          id: bid.id,
          teamId: bid.teamId,
          teamName: bid.team.name,
          amount: bid.amount,
          accepted: bid.wasAccepted,
          createdAt: bid.createdAt.toISOString(),
          rejectionCode: bid.rejectionCode ?? null,
        })) ?? [],
    rosterEntries: rosterEntries.map((entry) => ({
      id: entry.id,
      teamId: entry.teamId,
      teamName: entry.team.name,
      playerId: entry.playerId,
      playerName: entry.player.name,
      role: entry.player.role,
      amount: entry.amount,
      phase: entry.phase,
      createdAt: entry.createdAt.toISOString(),
    })),
    availablePlayers: availablePlayers.map((entry) => {
      const validity =
        auction.turnType === "BIDDING_NOMINATION"
          ? { valid: true, reason: null }
          : auction.turnType === "SNAKE_PICK" && auction.currentTurnTeamId
            ? validateRosterPick(auction.settings, currentTurnRoster, entry.player.role)
            : { valid: false, reason: "Waiting for the current team." };

      return {
        playerId: entry.playerId,
        name: entry.player.name,
        role: entry.player.role,
        iplTeam: entry.player.iplTeam,
        rankingScore: entry.player.rankingScore,
        isValidForCurrentTurn: validity.valid,
        invalidReason: validity.valid ? null : validity.reason,
      };
    }),
    activity: activity.map((item) => ({
      id: item.id,
      createdAt: item.createdAt.toISOString(),
      action: item.action,
      message: item.message,
    })),
  };
}

export async function broadcastAuctionSnapshot(auctionId?: string) {
  const io = getSocketServer();
  if (!io) {
    return;
  }

  const snapshot = await getAuctionSnapshot();
  const channel = auctionId ? io.to(getAuctionRoomName(auctionId)) : io;
  channel.emit(AUCTION_SOCKET_EVENTS.auctionSnapshot, snapshot);
  if (snapshot.activity[0]) {
    channel.emit(AUCTION_SOCKET_EVENTS.auctionEvent, snapshot.activity[0]);
  }
}

export async function startAuction(actorId: string) {
  await prisma.$transaction(
    async (tx) => {
      const auction = await getAuctionOrThrow(tx);
      const allTeams = await tx.team.findMany({
        orderBy: {
          createdAt: "asc",
        },
      });
      const ownedTeams = allTeams.filter((team) => team.ownerId);
      const teams = selectParticipatingTeams(allTeams, auction.settings.totalTeams);

      if (auction.status === "LIVE") {
        throw new Error("Auction is already live.");
      }

      if (auction.status === "PAUSED") {
        throw new Error("Auction is already started and currently paused. Use Resume auction instead.");
      }

      if (auction.status === "COMPLETED") {
        throw new Error("This auction is already completed. Create a new auction season to start again.");
      }

      if (allTeams.length < auction.settings.totalTeams) {
        throw new Error(
          `Configure all ${auction.settings.totalTeams} teams before starting the auction.`,
        );
      }

      if (ownedTeams.length > auction.settings.totalTeams) {
        throw new Error(
          `There are ${ownedTeams.length} teams with owners, but this auction is configured for ${auction.settings.totalTeams}. Increase total teams or use a clean setup.`,
        );
      }

      const teamsMissingOwners = teams.filter((team) => !team.ownerId).length;

      if (teamsMissingOwners > 0) {
        throw new Error(
          `Assign owners to all teams before starting the auction. ${teamsMissingOwners} team(s) are still unregistered.`,
        );
      }

      await tx.auctionRound.deleteMany({
        where: {
          auctionId: auction.id,
          status: {
            in: ["PENDING", "ACTIVE"],
          },
        },
      });

      const randomizedNominationOrder = shuffleTeamOrder(teams).map((team, index) =>
        toPersistedOrderRow(team, index + 1),
      );

      await tx.auction.update({
        where: { id: auction.id },
        data: {
          status: "LIVE",
          phase: "BIDDING",
          turnType: "IDLE",
          activeRoundNumber: 0,
          currentTurnTeamId: null,
          biddingNominationOrder: randomizedNominationOrder as unknown as Prisma.InputJsonValue,
          biddingPlayerDeadlineAt: null,
          snakePickDeadlineAt: null,
        },
      });

      await writeAuditLog({
        auctionId: auction.id,
        actorId,
        action: "AUCTION_STARTED",
        entityType: "auction",
        entityId: auction.id,
        message: `Randomized nomination order: ${formatTeamOrder(randomizedNominationOrder.map((team) => team.teamName))}.`,
        metadata: {
          biddingNominationOrder: randomizedNominationOrder,
        },
      }, tx);

      await ensureNextBiddingRound(tx, auction.id);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  const auction = await getAuctionOrThrow(prisma);
  await broadcastAuctionSnapshot(auction.id);
}

export async function pauseAuction(actorId: string) {
  let auctionId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const auction = await getAuctionOrThrow(tx);
    auctionId = auction.id;
    await tx.auction.update({
      where: { id: auction.id },
      data: {
        status: "PAUSED",
        pausedAt: new Date(),
      },
    });

    await writeAuditLog({
      auctionId: auction.id,
      actorId,
      action: "AUCTION_PAUSED",
      entityType: "auction",
      entityId: auction.id,
      message: "Auction paused by admin.",
    }, tx);
  });

  await broadcastAuctionSnapshot(auctionId ?? undefined);
}

export async function reopenBiddingRound(actorId: string, roundId: string) {
  const values = reopenBiddingRoundSchema.parse({ roundId });

  await prisma.$transaction(
    async (tx) => {
      const auction = await getAuctionOrThrow(tx);
      const round = await tx.auctionRound.findUnique({
        where: {
          id: values.roundId,
        },
      });

      if (!round || round.auctionId !== auction.id) {
        throw new Error("Round not found.");
      }

      if (round.phase !== "BIDDING") {
        throw new Error("Only bidding rounds can be reopened.");
      }

      if (round.winningTeamId || round.winningBidAmount) {
        throw new Error("This round already has a bidding winner.");
      }

      const reopeningNomination = !round.nominatedPlayerId;
      const nextDeadline = addSeconds(
        new Date(),
        reopeningNomination
          ? auction.selectionTimerSeconds
          : auction.biddingTimerSeconds,
      );

      await tx.auctionRound.update({
        where: {
          id: round.id,
        },
        data: {
          status: "ACTIVE",
          turnType: reopeningNomination ? "BIDDING_NOMINATION" : "BIDDING",
          bidDeadlineAt: reopeningNomination ? null : nextDeadline,
          selectionDeadlineAt: reopeningNomination ? nextDeadline : null,
          endedAt: null,
          notes: reopeningNomination
            ? "Nomination was reopened by admin after manual review."
            : "Bidding was reopened by admin after manual review.",
          manualReason: null,
          resolvedAt: new Date(),
        },
      });

      await tx.auction.update({
        where: {
          id: auction.id,
        },
        data: {
          status: "LIVE",
          phase: "BIDDING",
          turnType: reopeningNomination ? "BIDDING_NOMINATION" : "BIDDING",
          currentTurnTeamId: round.nominatingTeamId,
          biddingPlayerDeadlineAt: reopeningNomination ? nextDeadline : null,
          snakePickDeadlineAt: null,
        },
      });

      await writeAuditLog(
        {
          auctionId: auction.id,
          actorId,
          action: "ADMIN_INTERVENTION",
          entityType: "auction_round",
          entityId: round.id,
          message: reopeningNomination
            ? "Admin reopened the nomination turn."
            : "Admin reopened the bidding round.",
          metadata: {
            roundNumber: round.roundNumber,
            nextDeadlineAt: nextDeadline.toISOString(),
            reopenedTurnType: reopeningNomination ? "BIDDING_NOMINATION" : "BIDDING",
            undoable: true,
            undoType: reopeningNomination ? "REOPEN_NOMINATION" : "REOPEN_BIDDING",
            undoRoundId: round.id,
            undoManualReason: reopeningNomination
              ? "Nominating team did not nominate a player before timeout."
              : "No bids received before timer expiry.",
          },
        },
        tx,
      );
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  const auction = await getAuctionOrThrow(prisma);
  await broadcastAuctionSnapshot(auction.id);
}

export async function resumeAuction(actorId: string) {
  let auctionId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const auction = await getAuctionOrThrow(tx);
    auctionId = auction.id;
    await tx.auction.update({
      where: { id: auction.id },
      data: {
        status: "LIVE",
        pausedAt: null,
        resumeAt: new Date(),
      },
    });

    await writeAuditLog({
      auctionId: auction.id,
      actorId,
      action: "AUCTION_RESUMED",
      entityType: "auction",
      entityId: auction.id,
      message: "Auction resumed by admin.",
    }, tx);
  });

  await broadcastAuctionSnapshot(auctionId ?? undefined);
}

export async function placeBid(actorId: string, roundId: string, amount: number) {
  const values = bidSchema.parse({ roundId, amount });
  await reconcileAuctionTimersForRound(values.roundId);

  const result = await prisma.$transaction(
    async (tx) => {
      const auction = await getAuctionOrThrow(tx);
      const { user, team } = await getOwnerTeam(tx, actorId);
      const round = await tx.auctionRound.findUnique({
        where: { id: values.roundId },
        include: {
          nominatedPlayer: true,
        },
      });

      if (!user || !team || !round) {
        return { ok: false as const, error: "Team owner context not found." };
      }

      if (!(await assertParticipatingTeam(tx, auction, team.id))) {
        return { ok: false as const, error: "Your team is not part of this auction configuration." };
      }

      if (!round.nominatedPlayerId || !round.nominatedPlayer) {
        return { ok: false as const, error: "No player is currently nominated for bidding." };
      }

      const reject = async (reason: string, rejectionCode: string) => {
        await tx.bid.create({
          data: {
            auctionId: auction.id,
            roundId: values.roundId,
            teamId: team.id,
            userId: actorId,
            amount: values.amount,
            wasAccepted: false,
            rejectionCode,
          },
        });
        await writeAuditLog({
          auctionId: auction.id,
          actorId,
          action: "BID_REJECTED",
          entityType: "auction_round",
          entityId: values.roundId,
          message: reason,
          metadata: {
            amount: values.amount,
            teamId: team.id,
            rejectionCode,
          },
        }, tx);
        return { ok: false as const, error: reason };
      };

      const bidWindowError = assertBidWindowOpen({
        round,
        activeRoundNumber: auction.activeRoundNumber,
        state: getBiddingEngineState({
          auctionStatus: auction.status,
          auctionPhase: auction.phase,
          turnType: auction.turnType,
        }),
        now: new Date(),
      });

      if (bidWindowError) {
        return reject(
          bidWindowError,
          bidWindowError === "Bidding is not currently open."
            ? "BIDDING_CLOSED"
            : bidWindowError === "This round is no longer active."
              ? "ROUND_INACTIVE"
              : "BID_TIMEOUT",
        );
      }

      const biddingWins = await tx.teamRosterEntry.count({
        where: {
          auctionId: auction.id,
          teamId: team.id,
          phase: "BIDDING",
        },
      });

      if (hasReachedBiddingWinLimit(biddingWins, auction.biddingRoundSize)) {
        return reject(
          `This team already has ${auction.biddingRoundSize} bidding-phase wins.`,
          "BIDDING_WINS_MAXED",
        );
      }

      const passedTeamIds = await getPassedTeamIdsForRound(tx, values.roundId);
      if (passedTeamIds.has(team.id)) {
        return reject("You already passed on this player auction.", "PASSED_ALREADY");
      }

      const teamRoster = await tx.teamRosterEntry.findMany({
        where: {
          auctionId: auction.id,
          teamId: team.id,
        },
        include: {
          player: {
            select: {
              role: true,
            },
          },
        },
      });

      const biddingValidity = validateRosterPick(
        auction.settings,
        teamRoster,
        round.nominatedPlayer.role,
      );

      if (!biddingValidity.valid) {
        return reject(
          biddingValidity.reason ?? "This nominated player is not valid for your roster.",
          "NOMINATED_PLAYER_INVALID_FOR_TEAM",
        );
      }

      const acceptedBidAmounts = await tx.bid.findMany({
        where: {
          roundId: values.roundId,
          wasAccepted: true,
        },
        select: {
          amount: true,
        },
      });

      const currentHighestBid =
        acceptedBidAmounts.length > 0
          ? Math.max(...acceptedBidAmounts.map((bid) => bid.amount))
          : null;

      if (!isBidHigherThanCurrentHighest(currentHighestBid, values.amount)) {
        return reject(
          "Bid must be higher than the current highest bid.",
          "BID_NOT_HIGHER_THAN_CURRENT",
        );
      }

      if (!isBidAmountUniqueInRound(acceptedBidAmounts.map((bid) => bid.amount), values.amount)) {
        // We still persist the rejected command so admins can audit contention
        // when two owners race for the same amount near-simultaneously.
        return reject("Bid amount must be unique within the round.", "DUPLICATE_AMOUNT");
      }

      await tx.bid.create({
        data: {
          auctionId: auction.id,
          roundId: values.roundId,
          teamId: team.id,
          userId: actorId,
          amount: values.amount,
          wasAccepted: true,
        },
      });

      if (isInstantWinningBid(values.amount)) {
        // A first accepted 5000 bid deterministically ends the bidding window.
        await finalizeBiddingRoundWinner(
          tx,
          auction.id,
          values.roundId,
          team.id,
          values.amount,
        );

        const assignment = await assignPlayerToTeam(tx, {
          auction,
          round,
          teamId: team.id,
          playerId: round.nominatedPlayerId,
          amount: values.amount,
          actorId,
          source: "BIDDING_WIN",
        });

        if (!assignment.ok) {
          return { ok: false as const, error: assignment.error };
        }

        await writeAuditLog({
          auctionId: auction.id,
          actorId,
          action: "PLAYER_PICKED",
          entityType: "player",
          entityId: round.nominatedPlayerId,
          message: `${assignment.player.name} assigned to ${team.name} after an instant-winning bid.`,
          metadata: {
            teamId: team.id,
            amount: values.amount,
            source: "BIDDING_WIN",
          },
        }, tx);

        await ensureNextBiddingRound(tx, auction.id);
      } else {
        const nextDeadline = getBidDeadlineAfterValidBid(
          new Date(),
          auction.biddingTimerSeconds,
        );
        await tx.auctionRound.update({
          where: { id: values.roundId },
          data: { bidDeadlineAt: nextDeadline },
        });
        await writeAuditLog({
          auctionId: auction.id,
          actorId,
          action: "BID_TIMER_RESET",
          entityType: "auction_round",
          entityId: values.roundId,
          message: `Bid timer reset after bid ${values.amount}.`,
          metadata: {
            amount: values.amount,
            nextDeadlineAt: nextDeadline.toISOString(),
          },
        }, tx);
      }

      await writeAuditLog({
        auctionId: auction.id,
        actorId,
        action: "BID_ACCEPTED",
        entityType: "auction_round",
        entityId: values.roundId,
        message: `${team.name} placed ${values.amount}.`,
        metadata: {
          teamId: team.id,
          amount: values.amount,
        },
      }, tx);

      return { ok: true as const };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  const auction = await getAuctionOrThrow(prisma);
  await broadcastAuctionSnapshot(auction.id);
  return result;
}

export async function passOnBid(actorId: string, roundId: string) {
  const values = passBidSchema.parse({ roundId });
  await reconcileAuctionTimersForRound(values.roundId);

  const result = await prisma.$transaction(
    async (tx) => {
      const auction = await getAuctionOrThrow(tx);
      const { user, team } = await getOwnerTeam(tx, actorId);
      const round = await tx.auctionRound.findUnique({
        where: { id: values.roundId },
        include: {
          nominatedPlayer: true,
          bids: {
            where: {
              wasAccepted: true,
            },
          },
        },
      });

      if (!user || !team || !round) {
        return { ok: false as const, error: "Team owner context not found." };
      }

      if (!(await assertParticipatingTeam(tx, auction, team.id))) {
        return { ok: false as const, error: "Your team is not part of this auction configuration." };
      }

      if (!round.nominatedPlayerId || !round.nominatedPlayer) {
        return { ok: false as const, error: "No player is currently nominated for bidding." };
      }

      const bidWindowError = assertBidWindowOpen({
        round,
        activeRoundNumber: auction.activeRoundNumber,
        state: getBiddingEngineState({
          auctionStatus: auction.status,
          auctionPhase: auction.phase,
          turnType: auction.turnType,
        }),
        now: new Date(),
      });

      if (bidWindowError) {
        return { ok: false as const, error: bidWindowError };
      }

      const biddingWins = await tx.teamRosterEntry.count({
        where: {
          auctionId: auction.id,
          teamId: team.id,
          phase: "BIDDING",
        },
      });

      if (hasReachedBiddingWinLimit(biddingWins, auction.biddingRoundSize)) {
        return {
          ok: false as const,
          error: `This team already has ${auction.biddingRoundSize} bidding-phase wins.`,
        };
      }

      const teamRoster = await tx.teamRosterEntry.findMany({
        where: {
          auctionId: auction.id,
          teamId: team.id,
        },
        include: {
          player: {
            select: {
              role: true,
            },
          },
        },
      });

      const biddingValidity = validateRosterPick(
        auction.settings,
        teamRoster,
        round.nominatedPlayer.role,
      );

      if (!biddingValidity.valid) {
        return {
          ok: false as const,
          error: biddingValidity.reason ?? "This nominated player is not valid for your roster.",
        };
      }

      const highestAcceptedBid = getHighestAcceptedBid(round.bids);
      if (!highestAcceptedBid) {
        return { ok: false as const, error: "There is no active bid to pass on yet." };
      }

      if (highestAcceptedBid.teamId === team.id) {
        return { ok: false as const, error: "The current leading team cannot pass while holding the top bid." };
      }

      const passedTeamIds = await getPassedTeamIdsForRound(tx, values.roundId);
      if (passedTeamIds.has(team.id)) {
        return { ok: false as const, error: "You already passed on this player auction." };
      }

      await tx.bid.create({
        data: {
          auctionId: auction.id,
          roundId: values.roundId,
          teamId: team.id,
          userId: actorId,
          amount: highestAcceptedBid.amount,
          wasAccepted: false,
          rejectionCode: "PASSED",
        },
      });

      await writeAuditLog({
        auctionId: auction.id,
        actorId,
        action: "BID_REJECTED",
        entityType: "auction_round",
        entityId: values.roundId,
        message: `${team.name} passed on ${round.nominatedPlayer.name}.`,
        metadata: {
          teamId: team.id,
          leadingBidAmount: highestAcceptedBid.amount,
          leadingTeamId: highestAcceptedBid.teamId,
        },
      }, tx);

      await maybeStartFinalCallCountdown(tx, auction, values.roundId, round.nominatedPlayer.role);

      return { ok: true as const };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  const auction = await getAuctionOrThrow(prisma);
  await broadcastAuctionSnapshot(auction.id);
  return result;
}

export async function nominatePlayer(
  actorId: string,
  roundId: string,
  playerId: string,
  source: "OWNER" | "ADMIN" = "OWNER",
) {
  const values =
    source === "ADMIN"
      ? resolveNominationSchema.parse({ roundId, playerId })
      : nominatePlayerSchema.parse({ roundId, playerId });
  await reconcileAuctionTimersForRound(values.roundId);

  const result = await prisma.$transaction(
    async (tx) => {
      const auction = await getAuctionOrThrow(tx);
      const round = await tx.auctionRound.findUnique({
        where: { id: values.roundId },
        include: {
          nominatedPlayer: true,
        },
      });

      if (!round) {
        return { ok: false as const, error: "Round not found." };
      }

      const actor = await tx.user.findUnique({
        where: { id: actorId },
        include: { teamOwnerships: true },
      });

      if (!actor) {
        return { ok: false as const, error: "Actor not found." };
      }

      const actingTeamId =
        source === "ADMIN"
          ? round.nominatingTeamId ?? auction.currentTurnTeamId
          : actor.teamOwnerships[0]?.id ?? null;

      if (!actingTeamId) {
        return { ok: false as const, error: "No team is currently assigned to nominate." };
      }

      const actingTeam = await tx.team.findUnique({
        where: { id: actingTeamId },
        select: { name: true },
      });
      const actingTeamName = actingTeam?.name ?? "Unknown team";

      const adminResolvingManualNomination =
        source === "ADMIN" &&
        auction.phase === "BIDDING" &&
        auction.turnType === "MANUAL_RESOLUTION" &&
        round.turnType === "BIDDING_NOMINATION";

      if (
        auction.phase !== "BIDDING" ||
        (auction.turnType !== "BIDDING_NOMINATION" && !adminResolvingManualNomination)
      ) {
        return { ok: false as const, error: "Player nomination is not currently open." };
      }

      const roundIsEligibleForResolution =
        round.roundNumber === auction.activeRoundNumber &&
        (round.status === "ACTIVE" ||
          (source === "ADMIN" && round.status === "MANUAL_REVIEW"));

      if (!roundIsEligibleForResolution) {
        return { ok: false as const, error: "This round is no longer active." };
      }

      if (
        source !== "ADMIN" &&
        auction.currentTurnTeamId !== actingTeamId
      ) {
        return { ok: false as const, error: "It is not your turn to nominate." };
      }

      const nominatedPlayer = await tx.auctionPlayer.findFirst({
        where: {
          auctionId: auction.id,
          playerId: values.playerId,
          status: "AVAILABLE",
        },
        include: {
          player: true,
        },
      });

      if (!nominatedPlayer) {
        return { ok: false as const, error: "Player is not available for nomination." };
      }

      const biddingWins = await tx.teamRosterEntry.count({
        where: {
          auctionId: auction.id,
          teamId: actingTeamId,
          phase: "BIDDING",
        },
      });

      if (hasReachedBiddingWinLimit(biddingWins, auction.biddingRoundSize)) {
        return {
          ok: false as const,
          error: `This team already has ${auction.biddingRoundSize} bidding-phase wins and cannot open bidding on a nomination.`,
        };
      }

      const nominatingTeamRoster = await tx.teamRosterEntry.findMany({
        where: {
          auctionId: auction.id,
          teamId: actingTeamId,
        },
        include: {
          player: {
            select: {
              role: true,
            },
          },
        },
      });

      const nominationValidity = validateRosterPick(
        auction.settings,
        nominatingTeamRoster,
        nominatedPlayer.player.role,
      );

      if (!nominationValidity.valid) {
        return {
          ok: false as const,
          error:
            nominationValidity.reason ??
            "This nominated player is not valid for the nominating team's roster.",
        };
      }

      const bidDeadlineAt = addSeconds(new Date(), auction.biddingTimerSeconds);

      await tx.auctionRound.update({
        where: { id: round.id },
        data: {
          status: "ACTIVE",
          turnType: "BIDDING",
          nominatedPlayerId: nominatedPlayer.playerId,
          bidDeadlineAt,
          selectionDeadlineAt: null,
          notes:
            source === "ADMIN"
              ? "Admin resolved nomination and opened bidding."
              : "Team owner nominated player for bidding.",
          manualReason: null,
          endedAt: null,
          resolvedAt: source === "ADMIN" ? new Date() : round.resolvedAt,
        },
      });

      await tx.auction.update({
        where: { id: auction.id },
        data: {
          turnType: "BIDDING",
          currentTurnTeamId: round.nominatingTeamId ?? actingTeamId,
          biddingPlayerDeadlineAt: null,
        },
      });

      await tx.bid.create({
        data: {
          auctionId: auction.id,
          roundId: round.id,
          teamId: actingTeamId,
          userId: actorId,
          amount: 1,
          wasAccepted: true,
        },
      });

      await writeAuditLog({
        auctionId: auction.id,
        actorId,
        action: "BIDDING_ROUND_STARTED",
        entityType: "auction_round",
        entityId: round.id,
        message: `${nominatedPlayer.player.name} was nominated for bidding and opened at 1 by ${actingTeamName}.`,
        metadata: {
          nominatedPlayerId: nominatedPlayer.playerId,
          nominatingTeamId: actingTeamId,
          bidDeadlineAt: bidDeadlineAt.toISOString(),
          source,
        },
      }, tx);

      if (source === "ADMIN") {
        await writeAuditLog({
          auctionId: auction.id,
          actorId,
          action: "ADMIN_INTERVENTION",
          entityType: "auction_round",
          entityId: round.id,
          message: `Admin manually nominated ${nominatedPlayer.player.name} and reopened bidding.`,
          metadata: {
            undoable: true,
            undoType: "MANUAL_NOMINATION",
            undoRoundId: round.id,
            nominatedPlayerId: nominatedPlayer.playerId,
            nominatingTeamId: actingTeamId,
          },
        }, tx);
      }

      await writeAuditLog({
        auctionId: auction.id,
        actorId,
        action: "BID_ACCEPTED",
        entityType: "auction_round",
        entityId: round.id,
        message: `${actingTeamName} opened bidding at 1 on ${nominatedPlayer.player.name}.`,
        metadata: {
          teamId: actingTeamId,
          amount: 1,
          source: "OPENING_BID",
        },
      }, tx);

      await maybeStartFinalCallCountdown(
        tx,
        auction,
        round.id,
        nominatedPlayer.player.role,
      );

      return { ok: true as const };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  const auction = await getAuctionOrThrow(prisma);
  await broadcastAuctionSnapshot(auction.id);
  return result;
}

export async function pickPlayer(
  actorId: string | null,
  roundId: string,
  playerId: string,
  source: "OWNER" | "ADMIN" | "AUTO" = "OWNER",
) {
  if ((source === "ADMIN" || source === "AUTO") && (!roundId || !playerId)) {
    return {
      ok: false as const,
      error: "Select a valid player before resolving this timed-out pick.",
    };
  }

  const values =
    source === "OWNER"
      ? pickPlayerSchema.parse({ roundId, playerId })
      : { roundId, playerId };

  const result = await prisma.$transaction(
    async (tx) => {
      const auction = await getAuctionOrThrow(tx);
      const round = await tx.auctionRound.findUnique({
        where: { id: values.roundId },
        include: {
          nominatedPlayer: true,
        },
      });

      if (!round) {
        return { ok: false as const, error: "Round not found." };
      }

      const actor = actorId
        ? await tx.user.findUnique({
            where: { id: actorId },
            include: { teamOwnerships: true },
          })
        : null;

      if (actorId && !actor) {
        return { ok: false as const, error: "Actor not found." };
      }

      const actingTeamId =
        source === "ADMIN" || source === "AUTO"
          ? auction.currentTurnTeamId
          : actor?.teamOwnerships[0]?.id ?? null;

      if (!actingTeamId) {
        return { ok: false as const, error: "No team is currently assigned to this pick." };
      }

      if (!(await assertParticipatingTeam(tx, auction, actingTeamId))) {
        return { ok: false as const, error: "This team is not part of the current auction." };
      }

      if (source === "OWNER") {
        if (round.phase === "BIDDING") {
          return {
            ok: false as const,
            error: "Bidding-phase players are assigned automatically to the winning bidder.",
          };
        }

        if (auction.currentTurnTeamId !== actingTeamId) {
          return { ok: false as const, error: "It is not your turn." };
        }
      }

      const assignment = await assignPlayerToTeam(tx, {
        auction,
        round,
        teamId: actingTeamId,
        playerId: values.playerId,
        amount: round.winningBidAmount ?? 0,
        actorId,
        source,
      });

      if (!assignment.ok) {
        return { ok: false as const, error: assignment.error };
      }

      await writeAuditLog({
        auctionId: auction.id,
        actorId: actorId ?? undefined,
        action:
          source === "ADMIN"
            ? "ADMIN_INTERVENTION"
            : source === "AUTO"
              ? "AUTO_PICK"
              : "PLAYER_PICKED",
        entityType: "player",
        entityId: values.playerId,
        message:
          source === "AUTO"
            ? `${assignment.player.name} was auto-picked for ${assignment.teamName} after the snake timer expired.`
            : `${assignment.player.name} assigned to ${assignment.teamName}.`,
        metadata: {
          teamId: actingTeamId,
          source,
          phase: round.phase,
        },
      }, tx);

      await tx.auctionRound.update({
        where: { id: round.id },
        data: {
          endedAt: new Date(),
          status: "CLOSED",
          autoPicked: source === "AUTO" ? true : round.autoPicked,
        },
      });

      if (round.phase === "BIDDING") {
        await ensureNextBiddingRound(tx, auction.id);
      } else {
        const completed = await finalizeAuctionIfComplete(tx, auction.id);
        if (!completed) {
          const initialOrder = await getSnakeOrder(tx, auction.id);
          const nextTeamId = await getNextSnakeTurnTeamId(tx, auction.id);
          if (!nextTeamId) {
            await finalizeAuctionIfComplete(tx, auction.id);
            return { ok: true as const };
          }
          const snakeEntries = await tx.teamRosterEntry.count({
            where: {
              auctionId: auction.id,
              phase: "SNAKE",
            },
          });
          const teamsInAuction = await getParticipatingTeamCount(tx, auction);
          const totalBiddingAssignments =
            auction.biddingRoundSize *
            (await getParticipatingTeamCount(tx, auction));
          const nextRoundNumber = totalBiddingAssignments + snakeEntries + 1;
          const deadlineAt = addSeconds(new Date(), auction.snakeTimerSeconds);
          const nextTurn = getSnakeDraftTurn(
            initialOrder,
            snakeEntries,
            teamsInAuction,
          );
          const nextTeamName =
            (await getTeamNameMap(tx, [nextTeamId])).get(nextTeamId) ?? "the next team";

          await tx.auctionRound.create({
            data: {
              auctionId: auction.id,
              roundNumber: nextRoundNumber,
              phase: "SNAKE",
              turnType: "SNAKE_PICK",
              status: "ACTIVE",
              startedAt: new Date(),
              snakeOrderPosition: nextTurn.slotIndex,
              selectionDeadlineAt: deadlineAt,
            },
          });

          await tx.auction.update({
            where: { id: auction.id },
            data: {
              phase: "SNAKE",
              turnType: "SNAKE_PICK",
              activeRoundNumber: nextRoundNumber,
              currentTurnTeamId: nextTeamId,
              biddingPlayerDeadlineAt: null,
              snakePickDeadlineAt: deadlineAt,
            },
          });

          await writeAuditLog({
            auctionId: auction.id,
            action: "BIDDING_ROUND_STARTED",
            entityType: "auction_round",
            entityId: round.id,
            message: `Snake cycle ${nextTurn.cycleNumber} advanced to ${nextTeamName}.`,
            metadata: {
              cycleNumber: nextTurn.cycleNumber,
              reversed: nextTurn.reversed,
              teamId: nextTeamId,
              deadlineAt: deadlineAt.toISOString(),
            },
          }, tx);
        }
      }

      return { ok: true as const };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  const auction = await getAuctionOrThrow(prisma);
  await broadcastAuctionSnapshot(auction.id);
  return result;
}

export async function getUndoableAdminIntervention(): Promise<UndoableAdminIntervention | null> {
  const auction = await getAuctionOrThrow(prisma);
  const activeRound = await prisma.auctionRound.findFirst({
    where: {
      auctionId: auction.id,
      roundNumber: auction.activeRoundNumber,
    },
    include: {
      bids: true,
    },
  });

  if (!activeRound) {
    return null;
  }

  const log = await prisma.auditLog.findFirst({
    where: {
      auctionId: auction.id,
      action: "ADMIN_INTERVENTION",
      entityType: "auction_round",
      entityId: activeRound.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!log) {
    return null;
  }

  const metadata = asRecord(log.metadata);
  if (!metadata || metadata.undoable !== true) {
    return null;
  }

  const undoType = parseUndoType(metadata.undoType);
  if (!undoType) {
    return null;
  }

  const newerLogs = await prisma.auditLog.count({
    where: {
      auctionId: auction.id,
      createdAt: {
        gt: log.createdAt,
      },
      action: {
        notIn: ["OWNER_CONNECTED", "OWNER_DISCONNECTED"],
      },
    },
  });

  if (newerLogs > 0) {
    return null;
  }

  if (undoType === "MANUAL_NOMINATION") {
    const safeOpeningState =
      activeRound.status === "ACTIVE" &&
      activeRound.turnType === "BIDDING" &&
      activeRound.nominatedPlayerId !== null &&
      activeRound.bids.length === 1 &&
      activeRound.bids[0]?.wasAccepted === true &&
      activeRound.bids[0]?.amount === 1;

    if (!safeOpeningState) {
      return null;
    }

    return {
      logId: log.id,
      roundId: activeRound.id,
      label: "Undo manual nomination",
      undoType,
    };
  }

  const safeReopenState =
    auction.turnType !== "MANUAL_RESOLUTION" &&
    activeRound.status === "ACTIVE" &&
    activeRound.bids.length === 0;

  if (!safeReopenState) {
    return null;
  }

  if (undoType === "REOPEN_NOMINATION" && activeRound.turnType === "BIDDING_NOMINATION") {
    return {
      logId: log.id,
      roundId: activeRound.id,
      label: "Undo reopened nomination",
      undoType,
    };
  }

  if (
    undoType === "REOPEN_BIDDING" &&
    activeRound.turnType === "BIDDING" &&
    activeRound.nominatedPlayerId !== null
  ) {
    return {
      logId: log.id,
      roundId: activeRound.id,
      label: "Undo reopened bidding",
      undoType,
    };
  }

  return null;
}

export async function undoLastAdminIntervention(actorId: string) {
  const undoable = await getUndoableAdminIntervention();

  if (!undoable) {
    throw new Error("Nothing safe to undo right now.");
  }

  await prisma.$transaction(
    async (tx) => {
      const auction = await getAuctionOrThrow(tx);
      const round = await tx.auctionRound.findUnique({
        where: {
          id: undoable.roundId,
        },
        include: {
          bids: true,
        },
      });

      if (!round || round.auctionId !== auction.id) {
        throw new Error("Round not found.");
      }

      if (round.roundNumber !== auction.activeRoundNumber) {
        throw new Error("Only the current round can be undone.");
      }

      if (undoable.undoType === "MANUAL_NOMINATION") {
        await tx.bid.deleteMany({
          where: {
            roundId: round.id,
          },
        });

        await tx.auctionRound.update({
          where: {
            id: round.id,
          },
          data: {
            status: "MANUAL_REVIEW",
            turnType: "BIDDING_NOMINATION",
            nominatedPlayerId: null,
            bidDeadlineAt: null,
            selectionDeadlineAt: null,
            manualReason: "Nominating team did not nominate a player before timeout.",
            notes: "Admin manual nomination was undone.",
            endedAt: null,
            resolvedAt: null,
          },
        });

        await tx.auction.update({
          where: {
            id: auction.id,
          },
          data: {
            status: "LIVE",
            phase: "BIDDING",
            turnType: "MANUAL_RESOLUTION",
            currentTurnTeamId: round.nominatingTeamId,
            biddingPlayerDeadlineAt: null,
          },
        });
      } else {
        await tx.auctionRound.update({
          where: {
            id: round.id,
          },
          data: {
            status: "MANUAL_REVIEW",
            turnType: undoable.undoType === "REOPEN_NOMINATION" ? "BIDDING_NOMINATION" : "BIDDING",
            bidDeadlineAt: null,
            selectionDeadlineAt: null,
            manualReason:
              undoable.undoType === "REOPEN_NOMINATION"
                ? "Nominating team did not nominate a player before timeout."
                : "No bids received before timer expiry.",
            notes: "Admin reopen action was undone.",
            endedAt: null,
          },
        });

        await tx.auction.update({
          where: {
            id: auction.id,
          },
          data: {
            status: "LIVE",
            phase: "BIDDING",
            turnType: "MANUAL_RESOLUTION",
            currentTurnTeamId: round.nominatingTeamId,
            biddingPlayerDeadlineAt: null,
          },
        });
      }

      await writeAuditLog({
        auctionId: auction.id,
        actorId,
        action: "ADMIN_INTERVENTION",
        entityType: "auction_round",
        entityId: round.id,
        message: `${undoable.label} completed.`,
        metadata: {
          undoOfLogId: undoable.logId,
          undoType: undoable.undoType,
          undoable: false,
        },
      }, tx);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  const auction = await getAuctionOrThrow(prisma);
  await broadcastAuctionSnapshot(auction.id);
}

export async function getCorrectableLastPick(): Promise<CorrectableLastPick | null> {
  const auction = await getAuctionOrThrow(prisma);
  const latestEntry = await prisma.teamRosterEntry.findFirst({
    where: {
      auctionId: auction.id,
    },
    orderBy: [
      { pickNumber: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      team: true,
      player: true,
      round: true,
    },
  });

  if (!latestEntry) {
    return null;
  }

  const latestRoundNumber = latestEntry.round.roundNumber;
  const laterEntries = await prisma.teamRosterEntry.count({
    where: {
      auctionId: auction.id,
      pickNumber: {
        gt: latestEntry.pickNumber,
      },
    },
  });

  if (laterEntries > 0) {
    return null;
  }

  const futureRounds = await prisma.auctionRound.findMany({
    where: {
      auctionId: auction.id,
      roundNumber: {
        gt: latestRoundNumber,
      },
    },
    include: {
      bids: true,
      rosterEntries: true,
    },
    orderBy: {
      roundNumber: "asc",
    },
  });

  const hasDependentFutureRoundActivity = futureRounds.some(
    (round) => round.bids.length > 0 || round.rosterEntries.length > 0,
  );

  if (hasDependentFutureRoundActivity) {
    return null;
  }

  const futureRoundCount = futureRounds.length;
  if (futureRoundCount > 1) {
    return null;
  }

  return {
    rosterEntryId: latestEntry.id,
    roundId: latestEntry.roundId,
    label: `Correct last pick: ${latestEntry.player.name}`,
    playerName: latestEntry.player.name,
    teamName: latestEntry.team.name,
    phase: latestEntry.phase,
  };
}

export async function correctLastPick(actorId: string) {
  const correctable = await getCorrectableLastPick();

  if (!correctable) {
    throw new Error("No safe last-pick correction is available right now.");
  }

  await prisma.$transaction(
    async (tx) => {
      const auction = await getAuctionOrThrow(tx);
      const rosterEntry = await tx.teamRosterEntry.findUnique({
        where: {
          id: correctable.rosterEntryId,
        },
        include: {
          team: true,
          player: true,
          round: true,
        },
      });

      if (!rosterEntry || rosterEntry.auctionId !== auction.id) {
        throw new Error("Last pick not found.");
      }

      const futureRounds = await tx.auctionRound.findMany({
        where: {
          auctionId: auction.id,
          roundNumber: {
            gt: rosterEntry.round.roundNumber,
          },
        },
        include: {
          bids: true,
          rosterEntries: true,
        },
        orderBy: {
          roundNumber: "asc",
        },
      });

      const hasDependentFutureRoundActivity = futureRounds.some(
        (round) => round.bids.length > 0 || round.rosterEntries.length > 0,
      );

      if (hasDependentFutureRoundActivity || futureRounds.length > 1) {
        throw new Error("The auction has already moved on, so this pick can no longer be corrected.");
      }

      const futureRound = futureRounds[0] ?? null;
      if (futureRound) {
        await tx.auctionRound.delete({
          where: {
            id: futureRound.id,
          },
        });
      }

      await tx.teamRosterEntry.delete({
        where: {
          id: rosterEntry.id,
        },
      });

      await tx.auctionPlayer.update({
        where: {
          auctionId_playerId: {
            auctionId: auction.id,
            playerId: rosterEntry.playerId,
          },
        },
        data: {
          status: "AVAILABLE",
          assignedTeamId: null,
          assignedPhase: null,
          assignedAmount: null,
          assignedAt: null,
          assignedRoundId: null,
        },
      });

      if (rosterEntry.phase === "SNAKE") {
        const nextDeadline = addSeconds(new Date(), auction.snakeTimerSeconds);

        await tx.auctionRound.update({
          where: {
            id: rosterEntry.roundId,
          },
          data: {
            status: "ACTIVE",
            turnType: "SNAKE_PICK",
            endedAt: null,
            autoPicked: false,
            notes: "Last snake pick was corrected by admin.",
            manualReason: null,
            resolvedAt: new Date(),
            selectionDeadlineAt: nextDeadline,
          },
        });

        await tx.auction.update({
          where: {
            id: auction.id,
          },
          data: {
            status: "LIVE",
            phase: "SNAKE",
            turnType: "SNAKE_PICK",
            activeRoundNumber: rosterEntry.round.roundNumber,
            currentTurnTeamId: rosterEntry.teamId,
            snakePickDeadlineAt: nextDeadline,
            biddingPlayerDeadlineAt: null,
            pausedAt: null,
            resumeAt: new Date(),
          },
        });
      } else {
        const nextDeadline = addSeconds(new Date(), auction.biddingTimerSeconds);

        await tx.auctionRound.update({
          where: {
            id: rosterEntry.roundId,
          },
          data: {
            status: "ACTIVE",
            turnType: "BIDDING",
            winningTeamId: null,
            winningBidAmount: null,
            spendReachedAt: null,
            endedAt: null,
            autoPicked: false,
            notes: "Last bidding assignment was corrected by admin.",
            manualReason: null,
            resolvedAt: new Date(),
            bidDeadlineAt: nextDeadline,
            selectionDeadlineAt: null,
          },
        });

        await tx.auction.update({
          where: {
            id: auction.id,
          },
          data: {
            status: "LIVE",
            phase: "BIDDING",
            turnType: "BIDDING",
            activeRoundNumber: rosterEntry.round.roundNumber,
            currentTurnTeamId: rosterEntry.round.nominatingTeamId,
            biddingPlayerDeadlineAt: null,
            snakePickDeadlineAt: null,
            pausedAt: null,
            resumeAt: new Date(),
          },
        });
      }

      await writeAuditLog({
        auctionId: auction.id,
        actorId,
        action: "ADMIN_INTERVENTION",
        entityType: "player",
        entityId: rosterEntry.playerId,
        message: `Admin corrected the last ${rosterEntry.phase === "SNAKE" ? "snake pick" : "bidding assignment"} and returned ${rosterEntry.player.name} to the player pool.`,
        metadata: {
          correctedRosterEntryId: rosterEntry.id,
          correctedRoundId: rosterEntry.roundId,
          teamId: rosterEntry.teamId,
          playerId: rosterEntry.playerId,
          phase: rosterEntry.phase,
          futureRoundDeletedId: futureRound?.id ?? null,
        },
      }, tx);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  const auction = await getAuctionOrThrow(prisma);
  await broadcastAuctionSnapshot(auction.id);
}

async function processExpiredTimersForAuction(
  auction: AuctionWithSettings,
  options: { broadcast?: boolean } = {},
) {
  const shouldBroadcast = options.broadcast ?? true;
  const activeRound = await prisma.auctionRound.findUnique({
    where: {
      auctionId_roundNumber: {
        auctionId: auction.id,
        roundNumber: auction.activeRoundNumber,
      },
    },
    include: {
      bids: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!activeRound) {
    return false;
  }

  const now = new Date();

  const expiredTimerAction = getExpiredAuctionTimerAction({
    turnType: auction.turnType,
    bidDeadlineAt: activeRound.bidDeadlineAt,
    biddingPlayerDeadlineAt: auction.biddingPlayerDeadlineAt,
    snakePickDeadlineAt: auction.snakePickDeadlineAt,
    currentTurnTeamId: auction.currentTurnTeamId,
    now,
  });

  if (expiredTimerAction === "BIDDING_BID") {
    const winningBid = getHighestAcceptedBid(activeRound.bids);

    if (!winningBid) {
      await prisma.$transaction(async (tx) => {
        await tx.auctionRound.update({
          where: { id: activeRound.id },
          data: {
            status: "MANUAL_REVIEW",
            endedAt: new Date(),
            notes: "No bids received before timer expiry.",
            manualReason: "No bids received before timer expiry.",
          },
        });
        await tx.auction.update({
          where: { id: auction.id },
          data: {
            turnType: "MANUAL_RESOLUTION",
          },
        });
        await writeAuditLog({
          auctionId: auction.id,
          action: "ADMIN_INTERVENTION",
          entityType: "auction_round",
          entityId: activeRound.id,
          message: "Bidding round expired with no bids and requires admin intervention.",
        }, tx);
      });
      if (shouldBroadcast) {
        await broadcastAuctionSnapshot(auction.id);
      }
      return true;
    }

    await prisma.$transaction(async (tx) => {
      const auctionState = await getAuctionOrThrow(tx);
      const round = await tx.auctionRound.findUnique({
        where: { id: activeRound.id },
        include: {
          nominatedPlayer: true,
        },
      });

      if (!round?.nominatedPlayerId) {
        throw new Error("The active bidding round does not have a nominated player.");
      }

      await finalizeBiddingRoundWinner(
        tx,
        auction.id,
        activeRound.id,
        winningBid.teamId,
        winningBid.amount,
      );

      const assignment = await assignPlayerToTeam(tx, {
        auction: auctionState,
        round,
        teamId: winningBid.teamId,
        playerId: round.nominatedPlayerId,
        amount: winningBid.amount,
        source: "BIDDING_WIN",
      });

      if (!assignment.ok) {
        throw new Error(assignment.error);
      }

      await writeAuditLog({
        auctionId: auction.id,
        action: "PLAYER_PICKED",
        entityType: "player",
        entityId: round.nominatedPlayerId,
        message: `${assignment.player.name} assigned to ${assignment.teamName} after bid timer expiry.`,
        metadata: {
          teamId: winningBid.teamId,
          amount: winningBid.amount,
          source: "BIDDING_WIN",
        },
      }, tx);

      await ensureNextBiddingRound(tx, auction.id);
    });
    if (shouldBroadcast) {
      await broadcastAuctionSnapshot(auction.id);
    }
    return true;
  }

  if (expiredTimerAction === "BIDDING_NOMINATION") {
    await prisma.$transaction(async (tx) => {
      await tx.auction.update({
        where: { id: auction.id },
        data: {
          turnType: "MANUAL_RESOLUTION",
        },
      });
      await tx.auctionRound.update({
        where: { id: activeRound.id },
        data: {
          status: "MANUAL_REVIEW",
          notes: "Nominating team did not nominate a player before timeout.",
          manualReason: "Nominating team did not nominate a player before timeout.",
        },
      });
      await writeAuditLog({
        auctionId: auction.id,
        action: "ADMIN_INTERVENTION",
        entityType: "auction_round",
        entityId: activeRound.id,
        message: "Player nomination timed out and requires admin resolution.",
      }, tx);
    });
    if (shouldBroadcast) {
      await broadcastAuctionSnapshot(auction.id);
    }
    return true;
  }

  if (expiredTimerAction === "SNAKE_PICK") {
    const currentTurnTeamId = auction.currentTurnTeamId;

    if (!currentTurnTeamId) {
      return false;
    }

    const rosterEntries = await prisma.teamRosterEntry.findMany({
      where: {
        auctionId: auction.id,
        teamId: currentTurnTeamId,
      },
      include: {
        player: {
          select: {
            role: true,
          },
        },
      },
    });

    const availablePlayers = await prisma.auctionPlayer.findMany({
      where: {
        auctionId: auction.id,
        status: "AVAILABLE",
      },
      include: {
        player: true,
      },
      orderBy: {
        player: {
          rankingScore: "asc",
        },
      },
    });

    const candidate = findHighestRankedValidAutoPick(
      auction.settings!,
      rosterEntries,
      availablePlayers,
    );

    if (!candidate.playerId) {
      // This edge case can happen if earlier valid picks leave a team boxed into
      // an impossible final roster shape; the engine stops and hands control to
      // admin instead of auto-picking an illegal player.
      await prisma.$transaction(async (tx) => {
        await tx.auction.update({
          where: { id: auction.id },
          data: {
            turnType: "MANUAL_RESOLUTION",
          },
        });
        await tx.auctionRound.update({
          where: { id: activeRound.id },
          data: {
            status: "MANUAL_REVIEW",
            manualReason: candidate.reason,
            notes: "Auto-pick fallback failed because no valid player remained for the current team.",
          },
        });
        await writeAuditLog({
          auctionId: auction.id,
          action: "ADMIN_INTERVENTION",
          entityType: "auction_round",
          entityId: activeRound.id,
          message: "Snake pick timed out and requires admin resolution because no valid auto-pick remained.",
        }, tx);
      });
      if (shouldBroadcast) {
        await broadcastAuctionSnapshot(auction.id);
      }
      return true;
    }

    await pickPlayer(null, activeRound.id, candidate.playerId, "AUTO");
    return true;
  }

  return false;
}

async function reconcileAuctionTimers(auctionId: string, options: { broadcast?: boolean } = {}) {
  const auction = await getAuctionByIdOrThrow(prisma, auctionId);
  return processExpiredTimersForAuction(auction, options);
}

async function reconcileAuctionTimersForRound(roundId: string, options: { broadcast?: boolean } = {}) {
  const round = await prisma.auctionRound.findUnique({
    where: { id: roundId },
    select: { auctionId: true },
  });

  if (!round) {
    return false;
  }

  return reconcileAuctionTimers(round.auctionId, options);
}

export async function processExpiredTimers() {
  const liveAuctions = await prisma.auction.findMany({
    where: {
      status: "LIVE",
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      settings: true,
    },
  });

  for (const auction of liveAuctions) {
    try {
      await processExpiredTimersForAuction(auction as AuctionWithSettings);
    } catch (error) {
      process.stderr.write(
        `[auction-timer] Failed to process auction ${auction.id}: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
      );
    }
  }
}
