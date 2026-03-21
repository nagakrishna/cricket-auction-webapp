import { PrismaClient, UserRole } from "@prisma/client";

import { hashPassword } from "@/lib/auth/password";
import {
  correctLastPick,
  getCorrectableLastPick,
  nominatePlayer,
  passOnBid,
  pickPlayer,
  placeBid,
  processExpiredTimers,
  startAuction,
} from "@/server/auction/auction-service";

const prisma = new PrismaClient();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function getLatestAuction() {
  const auction = await prisma.auction.findFirst({
    orderBy: { createdAt: "desc" },
    include: { settings: true },
  });
  assert(auction?.settings, "Latest auction with settings not found.");
  return auction;
}

async function getActiveRound(auctionId: string, roundNumber: number) {
  const round = await prisma.auctionRound.findUnique({
    where: {
      auctionId_roundNumber: {
        auctionId,
        roundNumber,
      },
    },
  });
  assert(round, `Round ${roundNumber} not found.`);
  return round;
}

async function getAvailablePlayerId(auctionId: string) {
  const available = await prisma.auctionPlayer.findFirst({
    where: {
      auctionId,
      status: "AVAILABLE",
    },
    orderBy: {
      player: { rankingScore: "desc" },
    },
  });
  assert(available, "No available players found.");
  return available.playerId;
}

async function onboardOwner(teamShortCode: string, email: string, displayName: string) {
  const team = await prisma.team.findUnique({
    where: { shortCode: teamShortCode },
  });
  assert(team, `Team ${teamShortCode} not found.`);

  const passwordHash = await hashPassword("ScriptOwner123!");

  const owner = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: UserRole.TEAM_OWNER,
      displayName,
    },
  });

  await prisma.team.update({
    where: { id: team.id },
    data: { ownerId: owner.id },
  });

  return {
    teamId: team.id,
    teamName: team.name,
    ownerId: owner.id,
  };
}

async function expireNomination(auctionId: string, roundId: string) {
  const expiredAt = new Date(Date.now() - 5_000);
  await prisma.auctionRound.update({
    where: { id: roundId },
    data: {
      selectionDeadlineAt: expiredAt,
    },
  });
  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      biddingPlayerDeadlineAt: expiredAt,
    },
  });
}

async function expireBid(auctionId: string, roundId: string) {
  const expiredAt = new Date(Date.now() - 5_000);
  await prisma.auctionRound.update({
    where: { id: roundId },
    data: {
      bidDeadlineAt: expiredAt,
    },
  });
}

async function main() {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@auction.local" },
  });
  assert(admin, "Seed admin not found.");

  const cc = await onboardOwner("CC", "cc-owner@test.local", "CC Owner");
  const mm = await onboardOwner("MM", "mm-owner@test.local", "MM Owner");

  let auction = await getLatestAuction();
  auction = await prisma.auction.update({
    where: { id: auction.id },
    data: {
      biddingRoundSize: 3,
      biddingTimerSeconds: 60,
      selectionTimerSeconds: 60,
      snakeTimerSeconds: 60,
      settings: {
        update: {
          totalTeams: 2,
          rosterSize: 12,
        },
      },
    },
    include: { settings: true },
  });

  await startAuction(admin.id);

  auction = await getLatestAuction();
  assert(auction.turnType === "BIDDING_NOMINATION", "Auction did not start in nomination mode.");

  let round = await getActiveRound(auction.id, auction.activeRoundNumber);

  await expireNomination(auction.id, round.id);
  await processExpiredTimers();

  auction = await getLatestAuction();
  round = await getActiveRound(auction.id, auction.activeRoundNumber);
  assert(auction.turnType === "MANUAL_RESOLUTION", "Nomination timeout did not move auction to manual resolution.");
  assert(round.status === "MANUAL_REVIEW", "Nomination timeout did not mark round for manual review.");

  const manualNominationPlayerId = await getAvailablePlayerId(auction.id);
  const manualNominationResult = await nominatePlayer(admin.id, round.id, manualNominationPlayerId, "ADMIN");
  assert(manualNominationResult.ok, `Manual nomination failed: ${manualNominationResult.error}`);

  auction = await getLatestAuction();
  round = await getActiveRound(auction.id, auction.activeRoundNumber);
  assert(auction.turnType === "BIDDING", "Manual nomination did not reopen bidding.");
  assert(round.turnType === "BIDDING", "Round did not enter bidding after manual nomination.");

  const bidResult = await placeBid(mm.ownerId, round.id, 6);
  assert(bidResult.ok, `Bid placement failed: ${bidResult.error}`);

  await expireBid(auction.id, round.id);
  await processExpiredTimers();

  auction = await getLatestAuction();
  assert(auction.activeRoundNumber === 2, "Bidding expiry did not advance to round 2.");

  round = await getActiveRound(auction.id, auction.activeRoundNumber);
  assert(auction.turnType === "BIDDING_NOMINATION", "Expected round 2 to open in nomination mode.");
  {
    const actorId =
      auction.currentTurnTeamId === cc.teamId ? cc.ownerId : mm.ownerId;
    const otherActorId =
      auction.currentTurnTeamId === cc.teamId ? mm.ownerId : cc.ownerId;
    const nominatedPlayerId = await getAvailablePlayerId(auction.id);
    const nominationResult = await nominatePlayer(actorId, round.id, nominatedPlayerId);
    assert(nominationResult.ok, `Round 2 nomination failed: ${nominationResult.error}`);

    const refreshedRound = await getActiveRound(auction.id, auction.activeRoundNumber);
    const passResult = await passOnBid(otherActorId, refreshedRound.id);
    assert(passResult.ok, `Pass flow failed in round 2: ${passResult.error}`);

    await expireBid(auction.id, refreshedRound.id);
    await processExpiredTimers();
  }

  for (;;) {
    auction = await getLatestAuction();
    if (auction.phase === "SNAKE") {
      break;
    }

    round = await getActiveRound(auction.id, auction.activeRoundNumber);

    if (auction.turnType === "BIDDING_NOMINATION") {
      const actorId =
        auction.currentTurnTeamId === cc.teamId ? cc.ownerId : mm.ownerId;
      const nominatedPlayerId = await getAvailablePlayerId(auction.id);
      const nominationResult = await nominatePlayer(actorId, round.id, nominatedPlayerId);
      assert(nominationResult.ok, `Nomination failed in round ${round.roundNumber}: ${nominationResult.error}`);
      continue;
    }

    if (auction.turnType === "BIDDING") {
      await expireBid(auction.id, round.id);
      await processExpiredTimers();
      continue;
    }

    throw new Error(`Unexpected auction turn before snake: ${auction.turnType}`);
  }

  auction = await getLatestAuction();
  assert(auction.phase === "SNAKE", "Auction did not transition to snake phase.");
  assert(auction.turnType === "SNAKE_PICK", "Auction did not enter snake pick mode.");

  round = await getActiveRound(auction.id, auction.activeRoundNumber);
  const snakeActorId =
    auction.currentTurnTeamId === cc.teamId ? cc.ownerId : mm.ownerId;
  const snakePlayerId = await getAvailablePlayerId(auction.id);
  const snakePickResult = await pickPlayer(snakeActorId, round.id, snakePlayerId);
  assert(snakePickResult.ok, `Snake pick failed: ${snakePickResult.error}`);

  const correctable = await getCorrectableLastPick();
  assert(correctable, "Expected the last snake pick to be correctable.");
  await correctLastPick(admin.id);

  auction = await getLatestAuction();
  round = await getActiveRound(auction.id, auction.activeRoundNumber);
  assert(auction.phase === "SNAKE", "Auction left snake phase after correcting last pick.");
  assert(round.turnType === "SNAKE_PICK", "Snake round was not reopened after correction.");

  console.log("Auction stability verification passed.");
  console.log(`Latest auction: ${auction.name}`);
  console.log(`Current phase: ${auction.phase}`);
  console.log(`Active round: ${auction.activeRoundNumber}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  });
