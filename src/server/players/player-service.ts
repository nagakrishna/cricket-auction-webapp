import { parse } from "csv-parse/sync";

import { prisma } from "@/lib/db/prisma";
import { playerSchema, rankingCsvRowSchema } from "@/lib/validation/auction";

export async function createPlayer(input: unknown) {
  const values = playerSchema.parse(input);

  const auction = await prisma.auction.findFirst({
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!auction) {
    throw new Error("Create an auction before adding players.");
  }

  const player = await prisma.player.create({
    data: values,
  });

  await prisma.auctionPlayer.create({
    data: {
      auctionId: auction.id,
      playerId: player.id,
    },
  });

  return player;
}

export async function listPlayers() {
  const auction = await prisma.auction.findFirst({
    orderBy: {
      createdAt: "desc",
    },
  });

  const players = await prisma.player.findMany({
    include: {
      auctionPlayers: auction
        ? {
            where: {
              auctionId: auction.id,
            },
          }
        : false,
    },
    orderBy: [{ rankingScore: "asc" }, { name: "asc" }],
  });

  return players.map((player) => ({
    ...player,
    assignmentStatus: player.auctionPlayers[0]?.status ?? "AVAILABLE",
  }));
}

export async function importRankingCsv(csvText: string) {
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;

  let updated = 0;

  for (const row of rows) {
    const parsed = rankingCsvRowSchema.safeParse(row);

    if (!parsed.success) {
      // Malformed rows are skipped so admins can still import mostly-valid CSVs.
      continue;
    }

    const { name, role, iplTeam, rankingScore } = parsed.data;

    await prisma.player.updateMany({
      where: {
        name,
        iplTeam,
      },
      data: {
        role,
        rankingScore,
      },
    });
    updated += 1;
  }

  return { updated };
}
