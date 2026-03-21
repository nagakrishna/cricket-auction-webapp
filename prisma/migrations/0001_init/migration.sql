-- Hand-authored baseline migration for the current MVP schema.
-- This is included because Prisma CLI generation could not be executed in this environment.

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TEAM_OWNER');
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'REDEEMED', 'EXPIRED', 'REVOKED');
CREATE TYPE "AuctionStatus" AS ENUM ('DRAFT', 'READY', 'LIVE', 'PAUSED', 'COMPLETED');
CREATE TYPE "AuctionPhase" AS ENUM ('SETUP', 'BIDDING', 'SNAKE', 'COMPLETE');
CREATE TYPE "TurnType" AS ENUM ('IDLE', 'BIDDING', 'BIDDING_SELECTION', 'SNAKE_PICK', 'MANUAL_RESOLUTION');
CREATE TYPE "RoundStatus" AS ENUM ('PENDING', 'ACTIVE', 'CLOSED', 'TIMED_OUT', 'MANUAL_REVIEW');
CREATE TYPE "PlayerRole" AS ENUM ('BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKETKEEPER');
CREATE TYPE "AssignmentPhase" AS ENUM ('BIDDING', 'SNAKE');
CREATE TYPE "AuctionPlayerStatus" AS ENUM ('AVAILABLE', 'ASSIGNED');
CREATE TYPE "AuditAction" AS ENUM (
  'BID_ACCEPTED',
  'BID_REJECTED',
  'BID_TIMER_RESET',
  'BIDDING_ROUND_STARTED',
  'BIDDING_ROUND_WON',
  'PLAYER_PICKED',
  'INVALID_PICK_ATTEMPT',
  'ADMIN_INTERVENTION',
  'AUTO_PICK',
  'AUCTION_STARTED',
  'AUCTION_PAUSED',
  'AUCTION_RESUMED',
  'AUCTION_COMPLETED',
  'OWNER_CONNECTED',
  'OWNER_DISCONNECTED',
  'INVITE_CREATED',
  'INVITE_REDEEMED'
);
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "displayName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Session" (
  "id" TEXT PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Team" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "shortCode" TEXT NOT NULL UNIQUE,
  "ownerId" TEXT UNIQUE,
  "spendRankAnchor" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Invite" (
  "id" TEXT PRIMARY KEY,
  "publicToken" TEXT NOT NULL UNIQUE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "teamId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "redeemedAt" TIMESTAMP(3),
  "redeemedById" TEXT,
  "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Player" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "role" "PlayerRole" NOT NULL,
  "iplTeam" TEXT NOT NULL,
  "rankingScore" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Player_name_iplTeam_key" UNIQUE ("name", "iplTeam")
);

CREATE TABLE "Auction" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "status" "AuctionStatus" NOT NULL DEFAULT 'DRAFT',
  "phase" "AuctionPhase" NOT NULL DEFAULT 'SETUP',
  "turnType" "TurnType" NOT NULL DEFAULT 'IDLE',
  "activeRoundNumber" INTEGER NOT NULL DEFAULT 0,
  "currentTurnTeamId" TEXT,
  "biddingPlayerDeadlineAt" TIMESTAMP(3),
  "snakePickDeadlineAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "resumeAt" TIMESTAMP(3),
  "biddingRoundSize" INTEGER NOT NULL DEFAULT 3,
  "biddingTimerSeconds" INTEGER NOT NULL DEFAULT 60,
  "selectionTimerSeconds" INTEGER NOT NULL DEFAULT 60,
  "snakeTimerSeconds" INTEGER NOT NULL DEFAULT 60,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "AuctionSettings" (
  "id" TEXT PRIMARY KEY,
  "auctionId" TEXT NOT NULL UNIQUE,
  "totalTeams" INTEGER NOT NULL DEFAULT 10,
  "rosterSize" INTEGER NOT NULL DEFAULT 12,
  "minBatsmen" INTEGER NOT NULL DEFAULT 4,
  "maxBatsmen" INTEGER NOT NULL DEFAULT 6,
  "minBowlers" INTEGER NOT NULL DEFAULT 3,
  "maxBowlers" INTEGER NOT NULL DEFAULT 5,
  "minAllRounders" INTEGER NOT NULL DEFAULT 2,
  "maxAllRounders" INTEGER NOT NULL DEFAULT 4,
  "minWicketkeepers" INTEGER NOT NULL DEFAULT 1,
  "maxWicketkeepers" INTEGER NOT NULL DEFAULT 2,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "AuctionPlayer" (
  "id" TEXT PRIMARY KEY,
  "auctionId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "status" "AuctionPlayerStatus" NOT NULL DEFAULT 'AVAILABLE',
  "assignedTeamId" TEXT,
  "assignedPhase" "AssignmentPhase",
  "assignedAmount" INTEGER,
  "assignedAt" TIMESTAMP(3),
  "assignedRoundId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuctionPlayer_auctionId_playerId_key" UNIQUE ("auctionId", "playerId")
);

CREATE TABLE "AuctionRound" (
  "id" TEXT PRIMARY KEY,
  "auctionId" TEXT NOT NULL,
  "roundNumber" INTEGER NOT NULL,
  "phase" "AuctionPhase" NOT NULL,
  "turnType" "TurnType" NOT NULL,
  "status" "RoundStatus" NOT NULL DEFAULT 'PENDING',
  "snakeOrderPosition" INTEGER,
  "winningTeamId" TEXT,
  "winningBidAmount" INTEGER,
  "spendReachedAt" TIMESTAMP(3),
  "bidDeadlineAt" TIMESTAMP(3),
  "selectionDeadlineAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "autoPicked" BOOLEAN NOT NULL DEFAULT FALSE,
  "notes" TEXT,
  "manualReason" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuctionRound_auctionId_roundNumber_key" UNIQUE ("auctionId", "roundNumber")
);

CREATE TABLE "Bid" (
  "id" TEXT PRIMARY KEY,
  "auctionId" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "wasAccepted" BOOLEAN NOT NULL DEFAULT TRUE,
  "rejectionCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "TeamRosterEntry" (
  "id" TEXT PRIMARY KEY,
  "auctionId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "phase" "AssignmentPhase" NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "pickNumber" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamRosterEntry_auctionId_playerId_key" UNIQUE ("auctionId", "playerId"),
  CONSTRAINT "TeamRosterEntry_auctionId_pickNumber_key" UNIQUE ("auctionId", "pickNumber")
);

CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "auctionId" TEXT,
  "actorId" TEXT,
  "action" "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "RealtimeConnection" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "auctionId" TEXT,
  "teamId" TEXT,
  "socketId" TEXT NOT NULL UNIQUE,
  "status" "ConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disconnectedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reconnectCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "Session_userId_idx" ON "Session" ("userId");
CREATE INDEX "Invite_teamId_status_idx" ON "Invite" ("teamId", "status");
CREATE INDEX "Player_role_rankingScore_idx" ON "Player" ("role", "rankingScore" DESC);
CREATE INDEX "Auction_status_phase_idx" ON "Auction" ("status", "phase");
CREATE INDEX "AuctionPlayer_auctionId_status_idx" ON "AuctionPlayer" ("auctionId", "status");
CREATE INDEX "AuctionPlayer_assignedTeamId_idx" ON "AuctionPlayer" ("assignedTeamId");
CREATE INDEX "AuctionRound_auctionId_phase_status_idx" ON "AuctionRound" ("auctionId", "phase", "status");
CREATE INDEX "Bid_roundId_teamId_createdAt_idx" ON "Bid" ("roundId", "teamId", "createdAt");
CREATE INDEX "Bid_roundId_amount_wasAccepted_idx" ON "Bid" ("roundId", "amount", "wasAccepted");
CREATE INDEX "Bid_auctionId_createdAt_idx" ON "Bid" ("auctionId", "createdAt");
CREATE INDEX "TeamRosterEntry_auctionId_teamId_idx" ON "TeamRosterEntry" ("auctionId", "teamId");
CREATE INDEX "AuditLog_auctionId_createdAt_idx" ON "AuditLog" ("auctionId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog" ("action", "createdAt");
CREATE INDEX "RealtimeConnection_auctionId_status_idx" ON "RealtimeConnection" ("auctionId", "status");
CREATE INDEX "RealtimeConnection_userId_status_idx" ON "RealtimeConnection" ("userId", "status");
CREATE INDEX "RealtimeConnection_teamId_status_idx" ON "RealtimeConnection" ("teamId", "status");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invite" ADD CONSTRAINT "Invite_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_redeemedById_fkey"
  FOREIGN KEY ("redeemedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuctionSettings" ADD CONSTRAINT "AuctionSettings_auctionId_fkey"
  FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuctionPlayer" ADD CONSTRAINT "AuctionPlayer_auctionId_fkey"
  FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuctionPlayer" ADD CONSTRAINT "AuctionPlayer_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuctionRound" ADD CONSTRAINT "AuctionRound_auctionId_fkey"
  FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuctionRound" ADD CONSTRAINT "AuctionRound_winningTeamId_fkey"
  FOREIGN KEY ("winningTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionId_fkey"
  FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_roundId_fkey"
  FOREIGN KEY ("roundId") REFERENCES "AuctionRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamRosterEntry" ADD CONSTRAINT "TeamRosterEntry_auctionId_fkey"
  FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamRosterEntry" ADD CONSTRAINT "TeamRosterEntry_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamRosterEntry" ADD CONSTRAINT "TeamRosterEntry_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamRosterEntry" ADD CONSTRAINT "TeamRosterEntry_roundId_fkey"
  FOREIGN KEY ("roundId") REFERENCES "AuctionRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_auctionId_fkey"
  FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RealtimeConnection" ADD CONSTRAINT "RealtimeConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RealtimeConnection" ADD CONSTRAINT "RealtimeConnection_auctionId_fkey"
  FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RealtimeConnection" ADD CONSTRAINT "RealtimeConnection_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
