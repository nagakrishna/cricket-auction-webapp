export const USER_ROLES = ["ADMIN", "TEAM_OWNER"] as const;
export const PLAYER_ROLES = [
  "BATSMAN",
  "BOWLER",
  "ALL_ROUNDER",
  "WICKETKEEPER",
] as const;
export const AUCTION_PHASES = ["SETUP", "BIDDING", "SNAKE", "COMPLETE"] as const;
export const TURN_TYPES = [
  "IDLE",
  "BIDDING",
  "BIDDING_SELECTION",
  "SNAKE_PICK",
  "MANUAL_RESOLUTION",
] as const;
export const CONNECTION_STATUSES = ["CONNECTED", "DISCONNECTED"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type PlayerRole = (typeof PLAYER_ROLES)[number];
export type AuctionPhase = (typeof AUCTION_PHASES)[number];
export type TurnType = (typeof TURN_TYPES)[number];
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export type RoleConstraintKey =
  | "batsmen"
  | "bowlers"
  | "allRounders"
  | "wicketkeepers";

export type TeamRosterSnapshot = {
  teamId: string;
  spend: number;
  biddingWins: number;
  totalPlayers: number;
  roleCounts: Record<PlayerRole, number>;
};

export type AuctionLeaderboardRow = {
  teamId: string;
  teamName: string;
  spend: number;
  biddingWins: number;
  players: number;
};
