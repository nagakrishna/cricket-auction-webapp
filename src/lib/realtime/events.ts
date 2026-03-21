import {
  AUCTION_SOCKET_EVENTS,
  SOCKET_CONNECTION_EVENTS,
} from "@/lib/realtime/contracts";
import type { AssignmentPhase, AuctionPhase, PlayerRole, TurnType } from "@prisma/client";

export type AuctionActivityItem = {
  id: string;
  createdAt: string;
  action: string;
  message: string;
};

export type AuctionTeamView = {
  teamId: string;
  teamName: string;
  shortCode: string;
  spend: number;
  biddingWins: number;
  players: number;
  roleCounts: Record<PlayerRole, number>;
};

export type AuctionRosterEntryView = {
  id: string;
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
  role: PlayerRole;
  amount: number;
  phase: AssignmentPhase;
  createdAt: string;
};

export type AuctionAvailablePlayerView = {
  playerId: string;
  name: string;
  role: PlayerRole;
  iplTeam: string;
  rankingScore: number;
  isValidForCurrentTurn: boolean;
  invalidReason: string | null;
};

export type AuctionBidFeedItem = {
  id: string;
  teamId: string;
  teamName: string;
  amount: number;
  accepted: boolean;
  createdAt: string;
  rejectionCode: string | null;
};

export type AuctionPassedTeamView = {
  teamId: string;
  teamName: string;
};

export type AuctionOrderRow = {
  teamId: string;
  teamName: string;
  shortCode: string;
  position: number;
};

export type AuctionNominatedPlayerView = {
  playerId: string;
  name: string;
  role: PlayerRole;
  iplTeam: string;
  rankingScore: number;
};

export type AuctionSnapshot = {
  auctionId: string;
  name: string;
  status: string;
  phase: AuctionPhase;
  turnType: TurnType;
  currentRoundNumber: number;
  currentTurnTeamId: string | null;
  deadlineAt: string | null;
  manualReason: string | null;
  highestBid: number | null;
  highestBidTeamId: string | null;
  activeRoundId: string | null;
  passedTeams: AuctionPassedTeamView[];
  finalCallActive: boolean;
  currentNominatorTeamId: string | null;
  nominationCycleNumber: number | null;
  nominationPhaseLabel: string | null;
  currentNominatedPlayer: AuctionNominatedPlayerView | null;
  settings: {
    rosterSize: number;
    auctionPlayers: number;
    biddingTimerSeconds: number;
    selectionTimerSeconds: number;
    snakeTimerSeconds: number;
    minBatsmen: number;
    maxBatsmen: number;
    minBowlers: number;
    maxBowlers: number;
    minAllRounders: number;
    maxAllRounders: number;
    minWicketkeepers: number;
    maxWicketkeepers: number;
  };
  biddingNominationOrder: AuctionOrderRow[];
  snakeOrderPreview: AuctionOrderRow[] | null;
  leaderboard: AuctionTeamView[];
  bidFeed: AuctionBidFeedItem[];
  rosterEntries: AuctionRosterEntryView[];
  availablePlayers: AuctionAvailablePlayerView[];
  activity: AuctionActivityItem[];
};

export type ServerToClientEvents = {
  [AUCTION_SOCKET_EVENTS.systemConnected]: (payload: {
    socketId: string;
    connectedAt: string;
  }) => void;
  [AUCTION_SOCKET_EVENTS.auctionSnapshot]: (payload: AuctionSnapshot) => void;
  [AUCTION_SOCKET_EVENTS.auctionEvent]: (payload: AuctionActivityItem) => void;
  [SOCKET_CONNECTION_EVENTS.connect]: () => void;
  [SOCKET_CONNECTION_EVENTS.disconnect]: () => void;
};

export type ClientToServerEvents = {
  [AUCTION_SOCKET_EVENTS.auctionJoin]: (payload: {
    auctionId: string;
    userId?: string;
  }) => void;
  [AUCTION_SOCKET_EVENTS.auctionLeave]: (payload: { auctionId: string }) => void;
};
