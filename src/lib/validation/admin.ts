import { z } from "zod";

export const adminResetPresetSchema = z.enum([
  "CURRENT_AUCTION",
  "LIVE_PROGRESS",
  "PLAYERS_ONLY_RESEED",
  "FULL_RESEED",
]);

export const adminResetSchema = z.object({
  preset: adminResetPresetSchema,
  confirmation: z
    .string()
    .trim()
    .refine((value) => value === "RESET", {
      message: "Type RESET to confirm this action.",
    }),
});

export type AdminResetInput = z.infer<typeof adminResetSchema>;
export type AdminResetPreset = z.infer<typeof adminResetPresetSchema>;
