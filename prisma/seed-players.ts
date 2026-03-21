import { PrismaClient } from "@prisma/client";

import { reseedPlayersOnly } from "../src/server/admin/reset-service";

const prisma = new PrismaClient();

async function main() {
  const result = await reseedPlayersOnly(prisma);

  console.log(`Player-only reseed complete for auction: ${result.auctionName}`);
  console.log(`Loaded ${result.totalPlayers} players from prisma/seed-data/players.csv`);
  console.log("Teams, invites, and owner accounts were preserved.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
    await prisma.$disconnect();
    process.exit(1);
  });
