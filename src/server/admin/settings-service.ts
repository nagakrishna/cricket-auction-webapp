import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { auctionSettingsSchema } from "@/lib/validation/auction";
import { listTeams, selectParticipatingTeams } from "@/server/teams/team-service";

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

export async function getAuctionAdminData(): Promise<AuctionWithSettings> {
  const auction = await prisma.auction.findFirst({
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

  if (!auction || !auction.settings) {
    throw new Error("Auction is not configured.");
  }

  return auction as AuctionWithSettings;
}

export async function getAuctionReadModel() {
  const auction = await prisma.auction.findFirst({
    include: {
      settings: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!auction || !auction.settings) {
    throw new Error("Auction is not configured.");
  }

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
