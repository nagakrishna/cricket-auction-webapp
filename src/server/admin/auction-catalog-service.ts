import { prisma } from "@/lib/db/prisma";
import { getAuctionAdminData } from "@/server/admin/settings-service";

async function buildUniqueAuctionName(baseName: string) {
  const existing = await prisma.auction.findMany({
    where: {
      name: {
        startsWith: baseName,
      },
    },
    select: {
      name: true,
    },
  });

  const existingNames = new Set(existing.map((auction) => auction.name));

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let suffix = 2;

  // Admins often create follow-up seasons from the default name. We normalize
  // that into a predictable unique name instead of surfacing a raw database 500.
  while (existingNames.has(`${baseName} (${suffix})`)) {
    suffix += 1;
  }

  return `${baseName} (${suffix})`;
}

export async function listAuctions() {
  return prisma.auction.findMany({
    include: {
      settings: true,
      _count: {
        select: {
          rosterEntries: true,
          rounds: true,
          bids: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getAuctionHistoryDetail(auctionId: string) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      settings: true,
      rosterEntries: {
        include: {
          team: true,
          player: true,
        },
        orderBy: {
          pickNumber: "asc",
        },
      },
      rounds: {
        orderBy: {
          roundNumber: "asc",
        },
      },
      auditLogs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      },
    },
  });

  if (!auction || !auction.settings) {
    throw new Error("Auction not found.");
  }

  const teams = await prisma.team.findMany({
    orderBy: {
      name: "asc",
    },
  });

  const leaderboard = teams.map((team) => {
    const rosterEntries = auction.rosterEntries.filter(
      (entry) => entry.teamId === team.id,
    );

    return {
      teamId: team.id,
      teamName: team.name,
      shortCode: team.shortCode,
      players: rosterEntries.length,
      spend: rosterEntries.reduce((sum, entry) => sum + entry.amount, 0),
      rosterEntries,
    };
  });

  return {
    auction,
    leaderboard: leaderboard.sort((left, right) => {
      if (right.players !== left.players) {
        return right.players - left.players;
      }

      return right.spend - left.spend;
    }),
  };
}

export async function createAuctionSeason(input: {
  name: string;
}) {
  const values = {
    name: input.name.trim(),
  };

  if (!values.name) {
    throw new Error("Auction name is required.");
  }

  const auctionName = await buildUniqueAuctionName(values.name);
  const latestAuction = await getAuctionAdminData();
  const players = await prisma.player.findMany({
    orderBy: {
      rankingScore: "asc",
    },
  });

  return prisma.$transaction(async (tx) => {
    const auction = await tx.auction.create({
      data: {
        name: auctionName,
        status: "DRAFT",
        phase: "SETUP",
        turnType: "IDLE",
        biddingRoundSize: latestAuction.biddingRoundSize,
        biddingTimerSeconds: latestAuction.biddingTimerSeconds,
        selectionTimerSeconds: latestAuction.selectionTimerSeconds,
        snakeTimerSeconds: latestAuction.snakeTimerSeconds,
        settings: {
          create: {
            totalTeams: latestAuction.settings.totalTeams,
            rosterSize: latestAuction.settings.rosterSize,
            minBatsmen: latestAuction.settings.minBatsmen,
            maxBatsmen: latestAuction.settings.maxBatsmen,
            minBowlers: latestAuction.settings.minBowlers,
            maxBowlers: latestAuction.settings.maxBowlers,
            minAllRounders: latestAuction.settings.minAllRounders,
            maxAllRounders: latestAuction.settings.maxAllRounders,
            minWicketkeepers: latestAuction.settings.minWicketkeepers,
            maxWicketkeepers: latestAuction.settings.maxWicketkeepers,
          },
        },
      },
      include: {
        settings: true,
      },
    });

    if (players.length > 0) {
      await tx.auctionPlayer.createMany({
        data: players.map((player) => ({
          auctionId: auction.id,
          playerId: player.id,
        })),
      });
    }

    return auction;
  });
}
