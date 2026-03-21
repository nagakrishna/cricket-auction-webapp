import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";
import { Prisma, type PrismaClient, type PlayerRole, type InviteStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { adminResetSchema, type AdminResetPreset } from "@/lib/validation/admin";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const DEFAULT_AUCTION_NAME = "Cricket Auction MVP";
const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@auction.local";
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "change-me";
const DEFAULT_TIMERS = {
  biddingTimerSeconds: 60,
  selectionTimerSeconds: 60,
  snakeTimerSeconds: 60,
} as const;

const DEFAULT_SETTINGS = {
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

const TEAM_SEEDS = [
  { name: "Sunrisers", shortCode: "SR", inviteToken: "seed-invite-sr" },
  { name: "Mafia", shortCode: "MF", inviteToken: "seed-invite-mf" },
  { name: "Karanam Killers", shortCode: "KK", inviteToken: "seed-invite-kk" },
  { name: "Transformers", shortCode: "TR", inviteToken: "seed-invite-tr" },
  { name: "Royal Challengers", shortCode: "RC", inviteToken: "seed-invite-rc" },
  { name: "Assam Archers", shortCode: "AA", inviteToken: "seed-invite-aa" },
  { name: "Team Fighters", shortCode: "TF", inviteToken: "seed-invite-tf" },
  { name: "Dine-A-Mites", shortCode: "DM", inviteToken: "seed-invite-dm" },
  { name: "Punters", shortCode: "PT", inviteToken: "seed-invite-pt" },
  { name: "Naughty Buggers", shortCode: "NB", inviteToken: "seed-invite-nb" },
] as const;

const PLAYER_SEED_CSV_PATH = resolve(process.cwd(), "prisma/seed-data/players.csv");

function normalizePlayerRole(role: string): PlayerRole {
  const normalized = role.trim().toUpperCase().replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "BATSMAN":
      return "BATSMAN";
    case "BOWLER":
      return "BOWLER";
    case "ALL_ROUNDER":
      return "ALL_ROUNDER";
    case "WICKET_KEEPER":
      return "WICKETKEEPER";
    default:
      throw new Error(`Unsupported player role in seed CSV: ${role}`);
  }
}

function loadSeedPlayers() {
  const csvText = readFileSync(PLAYER_SEED_CSV_PATH, "utf8");
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<{
    name: string;
    role: string;
    iplTeam: string;
    rankingScore: string;
  }>;

  return rows.map((row) => {
    const rankingRank = Number.parseInt(row.rankingScore, 10);

    if (!Number.isFinite(rankingRank)) {
      throw new Error(`Invalid ranking score in seed CSV for ${row.name}: ${row.rankingScore}`);
    }

    return {
      name: row.name.trim(),
      role: normalizePlayerRole(row.role),
      iplTeam: row.iplTeam.trim(),
      rankingScore: rankingRank,
    };
  });
}

async function buildUniqueAuctionName(db: DbClient, baseName: string) {
  const existing = await db.auction.findMany({
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
  while (existingNames.has(`${baseName} (${suffix})`)) {
    suffix += 1;
  }

  return `${baseName} (${suffix})`;
}

export async function resetApplicationData(db: DbClient = prisma) {
  await db.realtimeConnection.deleteMany();
  await db.auditLog.deleteMany();
  await db.bid.deleteMany();
  await db.teamRosterEntry.deleteMany();
  await db.auctionRound.deleteMany();
  await db.auctionPlayer.deleteMany();
  await db.invite.deleteMany();
  await db.session.deleteMany();
  await db.auctionSettings.deleteMany();
  await db.auction.deleteMany();
  await db.player.deleteMany();
  await db.team.deleteMany();
  await db.user.deleteMany();
}

async function createFreshAuction(db: DbClient, input?: { name?: string }) {
  const auctionName = await buildUniqueAuctionName(db, input?.name?.trim() || DEFAULT_AUCTION_NAME);
  const players = await db.player.findMany({
    orderBy: {
      rankingScore: "asc",
    },
  });

  const auction = await db.auction.create({
    data: {
      name: auctionName,
      status: "READY",
      phase: "SETUP",
      turnType: "IDLE",
      activeRoundNumber: 0,
      currentTurnTeamId: null,
      biddingNominationOrder: Prisma.JsonNull,
      biddingPlayerDeadlineAt: null,
      snakePickDeadlineAt: null,
      pausedAt: null,
      resumeAt: null,
      biddingRoundSize: 3,
      biddingTimerSeconds: DEFAULT_TIMERS.biddingTimerSeconds,
      selectionTimerSeconds: DEFAULT_TIMERS.selectionTimerSeconds,
      snakeTimerSeconds: DEFAULT_TIMERS.snakeTimerSeconds,
      settings: {
        create: DEFAULT_SETTINGS,
      },
    },
  });

  if (players.length > 0) {
    await db.auctionPlayer.createMany({
      data: players.map((player) => ({
        auctionId: auction.id,
        playerId: player.id,
      })),
    });
  }

  return auction;
}

export async function seedBaselineData(db: DbClient = prisma) {
  const players = loadSeedPlayers();
  const adminPasswordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

  const admin = await db.user.create({
    data: {
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      displayName: "Auction Admin",
      role: "ADMIN",
    },
  });

  for (const teamSeed of TEAM_SEEDS) {
    const team = await db.team.create({
      data: {
        name: teamSeed.name,
        shortCode: teamSeed.shortCode,
      },
    });

    await db.invite.create({
      data: {
        publicToken: teamSeed.inviteToken,
        tokenHash: createHash("sha256").update(teamSeed.inviteToken).digest("hex"),
        teamId: team.id,
        createdById: admin.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
        status: "PENDING" satisfies InviteStatus,
      },
    });
  }

  for (const player of players) {
    await db.player.create({
      data: player,
    });
  }

  const auction = await createFreshAuction(db, { name: DEFAULT_AUCTION_NAME });

  await db.auditLog.create({
    data: {
      auctionId: auction.id,
      actorId: admin.id,
      action: "AUCTION_STARTED",
      entityType: "auction",
      entityId: auction.id,
      message: "Seed data loaded for local development.",
      metadata: {
        adminEmail: DEFAULT_ADMIN_EMAIL,
        totalTeams: TEAM_SEEDS.length,
        totalPlayers: players.length,
      },
    },
  });

  return {
    adminEmail: DEFAULT_ADMIN_EMAIL,
    adminPassword: DEFAULT_ADMIN_PASSWORD,
    auctionName: auction.name,
  };
}

async function getLatestAuction(db: DbClient) {
  return db.auction.findFirst({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      settings: true,
    },
  });
}

export async function resetLiveAuctionProgress() {
  return prisma.$transaction(async (tx) => {
    const auction = await getLatestAuction(tx);

    if (!auction?.settings) {
      const freshAuction = await createFreshAuction(tx);
      return {
        preset: "LIVE_PROGRESS" as const,
        auctionName: freshAuction.name,
      };
    }

    await tx.realtimeConnection.deleteMany({
      where: { auctionId: auction.id },
    });
    await tx.auditLog.deleteMany({
      where: { auctionId: auction.id },
    });
    await tx.bid.deleteMany({
      where: { auctionId: auction.id },
    });
    await tx.teamRosterEntry.deleteMany({
      where: { auctionId: auction.id },
    });
    await tx.auctionRound.deleteMany({
      where: { auctionId: auction.id },
    });
    await tx.auctionPlayer.deleteMany({
      where: { auctionId: auction.id },
    });

    const players = await tx.player.findMany({
      select: { id: true },
      orderBy: { rankingScore: "asc" },
    });

    if (players.length > 0) {
      await tx.auctionPlayer.createMany({
        data: players.map((player) => ({
          auctionId: auction.id,
          playerId: player.id,
        })),
      });
    }

    await tx.auction.update({
      where: { id: auction.id },
      data: {
        status: "READY",
        phase: "SETUP",
        turnType: "IDLE",
        activeRoundNumber: 0,
        currentTurnTeamId: null,
        biddingNominationOrder: Prisma.JsonNull,
        biddingPlayerDeadlineAt: null,
        snakePickDeadlineAt: null,
        pausedAt: null,
        resumeAt: null,
      },
    });

    return {
      preset: "LIVE_PROGRESS" as const,
      auctionName: auction.name,
    };
  });
}

export async function reseedPlayersOnly(db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    await tx.realtimeConnection.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.bid.deleteMany();
    await tx.teamRosterEntry.deleteMany();
    await tx.auctionRound.deleteMany();
    await tx.auctionPlayer.deleteMany();
    await tx.auctionSettings.deleteMany();
    await tx.auction.deleteMany();
    await tx.player.deleteMany();

    const players = loadSeedPlayers();

    for (const player of players) {
      await tx.player.create({
        data: player,
      });
    }

    const auction = await createFreshAuction(tx, { name: DEFAULT_AUCTION_NAME });

    await tx.auditLog.create({
      data: {
        auctionId: auction.id,
        action: "AUCTION_STARTED",
        entityType: "auction",
        entityId: auction.id,
        message: "Player pool refreshed from seed CSV while preserving teams and owner accounts.",
        metadata: {
          totalPlayers: players.length,
          preservedTeams: true,
          preservedOwners: true,
        },
      },
    });

    return {
      preset: "PLAYERS_ONLY_RESEED" as const,
      auctionName: auction.name,
      totalPlayers: players.length,
    };
  });
}

export async function resetCurrentAuction() {
  return prisma.$transaction(async (tx) => {
    const latestAuction = await getLatestAuction(tx);
    const replacementBaseName = latestAuction?.name ?? DEFAULT_AUCTION_NAME;

    if (latestAuction) {
      await tx.auction.delete({
        where: { id: latestAuction.id },
      });
    }

    const replacement = await createFreshAuction(tx, {
      name: replacementBaseName,
    });

    return {
      preset: "CURRENT_AUCTION" as const,
      auctionName: replacement.name,
    };
  });
}

export async function fullReseed() {
  await resetApplicationData(prisma);
  const result = await seedBaselineData(prisma);
  return {
    preset: "FULL_RESEED" as const,
    auctionName: result.auctionName,
    adminEmail: result.adminEmail,
  };
}

export async function runAdminReset(input: unknown) {
  const values = adminResetSchema.parse(input);

  switch (values.preset) {
    case "CURRENT_AUCTION":
      return resetCurrentAuction();
    case "LIVE_PROGRESS":
      return resetLiveAuctionProgress();
    case "PLAYERS_ONLY_RESEED":
      return reseedPlayersOnly();
    case "FULL_RESEED":
      return fullReseed();
    default: {
      const exhaustive: never = values.preset;
      throw new Error(`Unsupported reset preset: ${exhaustive satisfies AdminResetPreset}`);
    }
  }
}
