import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const redeemInviteSchema = z.object({
  // Production invite tokens are long random hex strings, but seeded demo links
  // intentionally use shorter stable tokens so they are easy to share and test.
  token: z.string().trim().min(8).max(128),
  displayName: z.string().trim().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const resetTeamOwnerPasswordSchema = z.object({
  teamId: z.string().cuid(),
  password: z.string().min(8).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RedeemInviteInput = z.infer<typeof redeemInviteSchema>;
export type ResetTeamOwnerPasswordInput = z.infer<typeof resetTeamOwnerPasswordSchema>;
