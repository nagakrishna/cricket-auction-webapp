ALTER TYPE "TurnType" ADD VALUE IF NOT EXISTS 'BIDDING_NOMINATION';

ALTER TABLE "Auction"
ADD COLUMN "biddingNominationOrder" JSONB;

ALTER TABLE "AuctionRound"
ADD COLUMN "nominationCycleNumber" INTEGER,
ADD COLUMN "nominationOrderPosition" INTEGER,
ADD COLUMN "nominatingTeamId" TEXT,
ADD COLUMN "nominatedPlayerId" TEXT;

ALTER TABLE "AuctionRound"
ADD CONSTRAINT "AuctionRound_nominatingTeamId_fkey"
FOREIGN KEY ("nominatingTeamId") REFERENCES "Team"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuctionRound"
ADD CONSTRAINT "AuctionRound_nominatedPlayerId_fkey"
FOREIGN KEY ("nominatedPlayerId") REFERENCES "Player"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
