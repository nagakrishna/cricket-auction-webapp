import { z } from "zod";

export const teamSchema = z.object({
  name: z.string().trim().min(2).max(80),
  shortCode: z.string().trim().min(2).max(10),
});

export const updateTeamSchema = teamSchema.extend({
  teamId: z.string().cuid(),
});

export const deleteTeamSchema = z.object({
  teamId: z.string().cuid(),
});

export const playerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  role: z.enum(["BATSMAN", "BOWLER", "ALL_ROUNDER", "WICKETKEEPER"]),
  iplTeam: z.string().trim().min(2).max(80),
  rankingScore: z.number().int().min(0).max(9999),
});

export const auctionSettingsSchema = z.object({
  biddingTimerSeconds: z.number().int().min(10).max(300),
  selectionTimerSeconds: z.number().int().min(10).max(300),
  snakeTimerSeconds: z.number().int().min(10).max(300),
  allowPassOnPlayer: z.boolean(),
  startingBidAmount: z.number().int().min(1).max(5000),
  auctionPlayers: z.number().int().min(3).max(50),
  totalTeams: z.number().int().min(2).max(20),
  rosterSize: z.number().int().min(8).max(20),
  minBatsmen: z.number().int().min(0).max(12),
  maxBatsmen: z.number().int().min(0).max(12),
  minBowlers: z.number().int().min(0).max(12),
  maxBowlers: z.number().int().min(0).max(12),
  minAllRounders: z.number().int().min(0).max(12),
  maxAllRounders: z.number().int().min(0).max(12),
  minWicketkeepers: z.number().int().min(0).max(12),
  maxWicketkeepers: z.number().int().min(0).max(12),
}).superRefine((value, ctx) => {
  const pairs = [
    ["Batsmen", value.minBatsmen, value.maxBatsmen],
    ["Bowlers", value.minBowlers, value.maxBowlers],
    ["All-rounders", value.minAllRounders, value.maxAllRounders],
    ["Wicketkeepers", value.minWicketkeepers, value.maxWicketkeepers],
  ] as const;

  for (const [label, min, max] of pairs) {
    if (min > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} minimum cannot exceed maximum.`,
      });
    }
  }

  const totalMinimum =
    value.minBatsmen +
    value.minBowlers +
    value.minAllRounders +
    value.minWicketkeepers;

  if (totalMinimum > value.rosterSize) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Minimum role totals cannot exceed roster size.",
    });
  }
});

export const createInviteSchema = z.object({
  teamId: z.string().cuid(),
  expiresInHours: z.number().int().min(1).max(168),
});

export const auctionSnapshotQuerySchema = z.object({
  auctionId: z.string().cuid().optional(),
});

export const bidSchema = z.object({
  roundId: z.string().cuid(),
  amount: z.number().int().min(1).max(5000),
});

export const passBidSchema = z.object({
  roundId: z.string().cuid(),
});

export const nominatePlayerSchema = z.object({
  roundId: z.string().cuid(),
  playerId: z.string().cuid(),
});

export const pickPlayerSchema = z.object({
  roundId: z.string().cuid(),
  playerId: z.string().cuid(),
});

export const resolveTimedOutPickSchema = z.object({
  roundId: z.string().cuid(),
  playerId: z.string().cuid(),
});

export const reopenBiddingRoundSchema = z.object({
  roundId: z.string().cuid(),
});

export const resolveNominationSchema = z.object({
  roundId: z.string().cuid(),
  playerId: z.string().cuid(),
});

export const rankingCsvRowSchema = z.object({
  name: z.string().trim().min(1),
  role: z.enum(["BATSMAN", "BOWLER", "ALL_ROUNDER", "WICKETKEEPER"]),
  iplTeam: z.string().trim().min(1),
  rankingScore: z.coerce.number().int().min(0).max(9999),
});

export type AuctionSettingsInput = z.infer<typeof auctionSettingsSchema>;
export type TeamInput = z.infer<typeof teamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type DeleteTeamInput = z.infer<typeof deleteTeamSchema>;
export type PlayerInput = z.infer<typeof playerSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type AuctionSnapshotQuery = z.infer<typeof auctionSnapshotQuerySchema>;
export type BidInput = z.infer<typeof bidSchema>;
export type PassBidInput = z.infer<typeof passBidSchema>;
export type NominatePlayerInput = z.infer<typeof nominatePlayerSchema>;
export type PickPlayerInput = z.infer<typeof pickPlayerSchema>;
export type ResolveTimedOutPickInput = z.infer<typeof resolveTimedOutPickSchema>;
export type ReopenBiddingRoundInput = z.infer<typeof reopenBiddingRoundSchema>;
export type ResolveNominationInput = z.infer<typeof resolveNominationSchema>;
export type RankingCsvRowInput = z.infer<typeof rankingCsvRowSchema>;
