import { PrismaClient } from "@prisma/client";

import { seedBaselineData, resetApplicationData } from "../src/server/admin/reset-service";

const prisma = new PrismaClient();

async function main() {
  await resetApplicationData(prisma);
  const result = await seedBaselineData(prisma);

  console.log(`Seed complete for auction: ${result.auctionName}`);
  console.log(`Admin login: ${result.adminEmail} / ${result.adminPassword}`);
  console.log("Seeded invite links:");
  console.log("- SR: /invite/seed-invite-sr");
  console.log("- MF: /invite/seed-invite-mf");
  console.log("- KK: /invite/seed-invite-kk");
  console.log("- TR: /invite/seed-invite-tr");
  console.log("- RC: /invite/seed-invite-rc");
  console.log("- AA: /invite/seed-invite-aa");
  console.log("- TF: /invite/seed-invite-tf");
  console.log("- DM: /invite/seed-invite-dm");
  console.log("- PT: /invite/seed-invite-pt");
  console.log("- NB: /invite/seed-invite-nb");
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
