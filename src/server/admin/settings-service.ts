import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { auctionSettingsSchema } from "@/lib/validation/auction";
import { listTeams, selectParticipatingTeams } from "@/server/teams/team-service";

const DEFAULT_AUCTION_NAME = "Cricket Auction MVP";
const DEFAULT_AUCTION_RULES = {
  biddingRoundSize: 3,
  biddingTimerSeconds: 30,
  selectionTimerSeconds: 60,
  snakeTimerSeconds: 60,
  allowPassOnPlayer: false,
  startingBidAmount: 30,
} as const;

const DEFAULT_AUCTION_SETTINGS = {
  totalTeams: 10,
  rosterSize: 12,
  minBatsmen: 2,
  maxBatsmen: 4,
  minBowlers: 3,
  maxBowlers: 6,
  minAllRounders: 1,
  maxAllRounders: 4,
  minWicketkeepers: 1,
  maxWicketkeepers: 1,
} as const;

function isUnknownAuctionRuleColumnError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Unknown argument `allowPassOnPlayer`") ||
    error.message.includes("Unknown argument `startingBidAmount`")
  );
}

export type AuctionWithSettings = Prisma.AuctionGetPayload<{
  include: {
    settings: true;
    rounds: true;
  };
}> & {
  settings: NonNullable<
    Prisma.AuctionGetPayload<{
      include: {
        settings: true;
        rounds: true;
      };
    }>["settings"]
  >;
};

async function ensureAuctionAdminData(): Promise<AuctionWithSettings> {
  const latestAuction = await prisma.auction.findFirst({
    include: {
      settings: true,
      rounds: {
        orderBy: {
          roundNumber: "desc",
        },
        take: 10,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!latestAuction) {
    const players = await prisma.player.findMany({
      select: {
        id: true,
      },
    });

    const auction = await prisma.$transaction(async (tx) => {
      let createdAuction: Awaited<ReturnType<typeof tx.auction.create>>;

      try {
        createdAuction = await tx.auction.create({
          data: {
            name: DEFAULT_AUCTION_NAME,
            status: "READY",
            phase: "SETUP",
            turnType: "IDLE",
            biddingRoundSize: DEFAULT_AUCTION_RULES.biddingRoundSize,
            biddingTimerSeconds: DEFAULT_AUCTION_RULES.biddingTimerSeconds,
            selectionTimerSeconds: DEFAULT_AUCTION_RULES.selectionTimerSeconds,
            snakeTimerSeconds: DEFAULT_AUCTION_RULES.snakeTimerSeconds,
            allowPassOnPlayer: DEFAULT_AUCTION_RULES.allowPassOnPlayer,
            startingBidAmount: DEFAULT_AUCTION_RULES.startingBidAmount,
            settings: {
              create: DEFAULT_AUCTION_SETTINGS,
            },
          },
          include: {
            settings: true,
            rounds: true,
          },
        });
      } catch (error) {
        if (!isUnknownAuctionRuleColumnError(error)) {
          throw error;
        }

        createdAuction = await tx.auction.create({
          data: {
            name: DEFAULT_AUCTION_NAME,
            status: "READY",
            phase: "SETUP",
            turnType: "IDLE",
            biddingRoundSize: DEFAULT_AUCTION_RULES.biddingRoundSize,
            biddingTimerSeconds: DEFAULT_AUCTION_RULES.biddingTimerSeconds,
            selectionTimerSeconds: DEFAULT_AUCTION_RULES.selectionTimerSeconds,
            snakeTimerSeconds: DEFAULT_AUCTION_RULES.snakeTimerSeconds,
            settings: {
              create: DEFAULT_AUCTION_SETTINGS,
            },
          },
          include: {
            settings: true,
            rounds: true,
          },
        });
      }

      if (players.length > 0) {
        await tx.auctionPlayer.createMany({
          data: players.map((player) => ({
            auctionId: createdAuction.id,
            playerId: player.id,
          })),
          skipDuplicates: true,
        });
      }

      return createdAuction;
    });

    return auction as AuctionWithSettings;
  }

  if (latestAuction.settings) {
    return latestAuction as AuctionWithSettings;
  }

  const repairedAuction = await prisma.auction.update({
    where: {
      id: latestAuction.id,
    },
    data: {
      settings: {
        create: DEFAULT_AUCTION_SETTINGS,
      },
    },
    include: {
      settings: true,
      rounds: {
        orderBy: {
          roundNumber: "desc",
        },
        take: 10,
      },
    },
  });

  return repairedAuction as AuctionWithSettings;
}

export async function getAuctionAdminData(): Promise<AuctionWithSettings> {
  return ensureAuctionAdminData();
}

export async function getAuctionReadModel() {
  const auction = await ensureAuctionAdminData();

  return auction as typeof auction & { settings: NonNullable<typeof auction.settings> };
}

export async function getAuctionSetupStatus() {
  const auction = await getAuctionAdminData();
  const teams = await listTeams();
  const ownedTeams = teams.filter((team) => team.ownerId);
  const participatingTeams = selectParticipatingTeams(teams, auction.settings.totalTeams);
  const configuredTeams = participatingTeams.length;
  const teamsWithOwners = participatingTeams.filter((team) => team.ownerId).length;
  const missingTeamSlots = Math.max(0, auction.settings.totalTeams - teams.length);
  const teamsMissingOwners = configuredTeams - teamsWithOwners;
  const excessOwnedTeams = Math.max(0, ownedTeams.length - auction.settings.totalTeams);
  const extraTeamsIgnored = Math.max(0, teams.length - auction.settings.totalTeams);
  const setupReady =
    missingTeamSlots === 0 &&
    excessOwnedTeams === 0 &&
    configuredTeams === auction.settings.totalTeams &&
    teamsWithOwners === auction.settings.totalTeams;
  const auctionAlreadyStarted = ["LIVE", "PAUSED", "COMPLETED"].includes(auction.status);
  const canStart = setupReady && !auctionAlreadyStarted;

  return {
    configuredTeams,
    teamsWithOwners,
    teamsMissingOwners,
    missingTeamSlots,
    excessOwnedTeams,
    extraTeamsIgnored,
    auctionAlreadyStarted,
    setupReady,
    canStart,
  };
}

export async function updateAuctionSettings(input: unknown) {
  const values = auctionSettingsSchema.parse(input);
  const auction = await getAuctionAdminData();

  try {
    return await prisma.auction.update({
      where: {
        id: auction.id,
      },
      data: {
        biddingTimerSeconds: values.biddingTimerSeconds,
        selectionTimerSeconds: values.selectionTimerSeconds,
        snakeTimerSeconds: values.snakeTimerSeconds,
        allowPassOnPlayer: values.allowPassOnPlayer,
        startingBidAmount: values.startingBidAmount,
        biddingRoundSize: values.auctionPlayers,
        settings: {
          update: {
            totalTeams: values.totalTeams,
            rosterSize: values.rosterSize,
            minBatsmen: values.minBatsmen,
            maxBatsmen: values.maxBatsmen,
            minBowlers: values.minBowlers,
            maxBowlers: values.maxBowlers,
            minAllRounders: values.minAllRounders,
            maxAllRounders: values.maxAllRounders,
            minWicketkeepers: values.minWicketkeepers,
            maxWicketkeepers: values.maxWicketkeepers,
          },
        },
      },
      include: {
        settings: true,
      },
    });
  } catch (error) {
    if (!isUnknownAuctionRuleColumnError(error)) {
      throw error;
    }

    return prisma.auction.update({
      where: {
        id: auction.id,
      },
      data: {
        biddingTimerSeconds: values.biddingTimerSeconds,
        selectionTimerSeconds: values.selectionTimerSeconds,
        snakeTimerSeconds: values.snakeTimerSeconds,
        biddingRoundSize: values.auctionPlayers,
        settings: {
          update: {
            totalTeams: values.totalTeams,
            rosterSize: values.rosterSize,
            minBatsmen: values.minBatsmen,
            maxBatsmen: values.maxBatsmen,
            minBowlers: values.minBowlers,
            maxBowlers: values.maxBowlers,
            minAllRounders: values.minAllRounders,
            maxAllRounders: values.maxAllRounders,
            minWicketkeepers: values.minWicketkeepers,
            maxWicketkeepers: values.maxWicketkeepers,
          },
        },
      },
      include: {
        settings: true,
      },
    });
  }
}
