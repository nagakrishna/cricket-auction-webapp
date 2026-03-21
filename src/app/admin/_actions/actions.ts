"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/session";
import {
  correctLastPick,
  nominatePlayer,
  startAuction,
  pauseAuction,
  resumeAuction,
  pickPlayer,
  reopenBiddingRound,
  undoLastAdminIntervention,
} from "@/server/auction/auction-service";
import { createAuctionSeason } from "@/server/admin/auction-catalog-service";
import { createInvite } from "@/server/invites/invite-service";
import { createPlayer, importRankingCsv } from "@/server/players/player-service";
import { updateAuctionSettings } from "@/server/admin/settings-service";
import { runAdminReset } from "@/server/admin/reset-service";
import {
  createTeam,
  deleteTeam,
  resetTeamOwnerPassword,
  updateTeam,
} from "@/server/teams/team-service";

async function requireAdminUser() {
  return requireRole("ADMIN");
}

function getNumberField(formData: FormData, key: string) {
  return Number(formData.get(key));
}

function revalidateAdminPaths(...paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

function revalidateResetPaths() {
  revalidateAdminPaths(
    "/",
    "/login",
    "/leaderboard",
    "/admin",
    "/admin/setup",
    "/admin/auction",
    "/admin/auctions",
    "/admin/teams",
    "/admin/players",
    "/admin/invites",
    "/admin/settings",
    "/admin/logs",
    "/owner/auction",
    "/owner/snake-draft",
  );
}

export async function createTeamAction(formData: FormData) {
  await requireAdminUser();
  await createTeam({
    name: formData.get("name"),
    shortCode: formData.get("shortCode"),
  });
  revalidateAdminPaths("/admin/teams");
}

export async function updateTeamAction(formData: FormData) {
  await requireAdminUser();
  await updateTeam({
    teamId: formData.get("teamId"),
    name: formData.get("name"),
    shortCode: formData.get("shortCode"),
  });
  revalidateAdminPaths("/admin/teams", "/admin/setup", "/admin/invites");
}

export async function deleteTeamAction(formData: FormData) {
  await requireAdminUser();
  await deleteTeam({
    teamId: formData.get("teamId"),
  });
  revalidateAdminPaths("/admin/teams", "/admin/setup", "/admin/invites");
}

export async function resetTeamOwnerPasswordAction(formData: FormData) {
  await requireAdminUser();
  await resetTeamOwnerPassword({
    teamId: formData.get("teamId"),
    password: formData.get("password"),
  });
  revalidateAdminPaths("/admin/teams");
}

export type ResetTeamOwnerPasswordFormState = {
  ok: boolean;
  error?: string;
  teamName?: string;
  ownerName?: string;
};

export async function resetTeamOwnerPasswordFormAction(
  _previousState: ResetTeamOwnerPasswordFormState | undefined,
  formData: FormData,
): Promise<ResetTeamOwnerPasswordFormState> {
  try {
    await requireAdminUser();
    const result = await resetTeamOwnerPassword({
      teamId: formData.get("teamId"),
      password: formData.get("password"),
    });
    revalidateAdminPaths("/admin/teams");
    return {
      ok: true,
      teamName: result.teamName,
      ownerName: result.ownerName,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Password reset failed.",
    };
  };
}

export type ResetAdminDataFormState = {
  ok: boolean;
  error?: string;
  message?: string;
  redirectTo?: string;
};

export async function resetAdminDataAction(
  _previousState: ResetAdminDataFormState | undefined,
  formData: FormData,
): Promise<ResetAdminDataFormState> {
  try {
    await requireAdminUser();
    const result = await runAdminReset({
      preset: formData.get("preset"),
      confirmation: formData.get("confirmation"),
    });
    revalidateResetPaths();

    if (result.preset === "FULL_RESEED") {
      return {
        ok: true,
        message: `Full reseed completed. Sign back in with ${result.adminEmail}.`,
        redirectTo: "/login",
      };
    }

    return {
      ok: true,
      message: (() => {
        switch (result.preset) {
          case "CURRENT_AUCTION":
            return `Current auction reset. Fresh auction ready: ${result.auctionName}.`;
          case "LIVE_PROGRESS":
            return `Live auction progress reset for ${result.auctionName}.`;
          case "PLAYERS_ONLY_RESEED":
            return `Player pool refreshed for ${result.auctionName}. Teams and owner accounts were preserved.`;
          default:
            return "Reset completed.";
        }
      })(),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Reset failed.",
    };
  }
}

export async function createAuctionSeasonAction(formData: FormData) {
  await requireAdminUser();
  await createAuctionSeason({
    name: String(formData.get("name") ?? ""),
  });
  revalidateAdminPaths("/admin", "/admin/auctions");
}

export async function createInviteAction(formData: FormData) {
  const admin = await requireAdminUser();
  await createInvite(
    {
      teamId: formData.get("teamId"),
      expiresInHours: getNumberField(formData, "expiresInHours"),
    },
    admin.id,
  );
  revalidateAdminPaths("/admin", "/admin/setup", "/admin/invites");
}

export type CreateInviteFormState = {
  ok: boolean;
  error?: string;
  teamName?: string;
  url?: string;
  expiresAt?: string;
};

export async function createInviteFormAction(
  _previousState: CreateInviteFormState | undefined,
  formData: FormData,
): Promise<CreateInviteFormState> {
  try {
    const admin = await requireAdminUser();
    const result = await createInvite(
      {
        teamId: formData.get("teamId"),
        expiresInHours: getNumberField(formData, "expiresInHours"),
      },
      admin.id,
    );
    revalidateAdminPaths("/admin", "/admin/setup", "/admin/invites");
    return {
      ok: true,
      teamName: result.teamName,
      url: result.url,
      expiresAt: result.expiresAt.toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invite generation failed.",
    };
  }
}

export async function createPlayerAction(formData: FormData) {
  await requireAdminUser();
  await createPlayer({
    name: formData.get("name"),
    role: formData.get("role"),
    iplTeam: formData.get("iplTeam"),
    rankingScore: getNumberField(formData, "rankingScore"),
  });
  revalidateAdminPaths("/admin/players");
}

export async function importCsvAction(formData: FormData) {
  await requireAdminUser();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return;
  }
  await importRankingCsv(await file.text());
  revalidateAdminPaths("/admin/players");
}

export async function updateSettingsAction(formData: FormData) {
  await requireAdminUser();
  await updateAuctionSettings({
    biddingTimerSeconds: getNumberField(formData, "biddingTimerSeconds"),
    selectionTimerSeconds: getNumberField(formData, "selectionTimerSeconds"),
    snakeTimerSeconds: getNumberField(formData, "snakeTimerSeconds"),
    auctionPlayers: getNumberField(formData, "auctionPlayers"),
    totalTeams: getNumberField(formData, "totalTeams"),
    rosterSize: getNumberField(formData, "rosterSize"),
    minBatsmen: getNumberField(formData, "minBatsmen"),
    maxBatsmen: getNumberField(formData, "maxBatsmen"),
    minBowlers: getNumberField(formData, "minBowlers"),
    maxBowlers: getNumberField(formData, "maxBowlers"),
    minAllRounders: getNumberField(formData, "minAllRounders"),
    maxAllRounders: getNumberField(formData, "maxAllRounders"),
    minWicketkeepers: getNumberField(formData, "minWicketkeepers"),
    maxWicketkeepers: getNumberField(formData, "maxWicketkeepers"),
  });
  revalidateAdminPaths("/admin/settings");
}

export async function startAuctionAction() {
  const admin = await requireAdminUser();
  await startAuction(admin.id);
  revalidateAdminPaths("/admin", "/admin/auction");
}

export async function pauseAuctionAction() {
  const admin = await requireAdminUser();
  await pauseAuction(admin.id);
  revalidateAdminPaths("/admin", "/admin/auction");
}

export async function resumeAuctionAction() {
  const admin = await requireAdminUser();
  await resumeAuction(admin.id);
  revalidateAdminPaths("/admin", "/admin/auction");
}

export async function resolveTimedOutPickAction(formData: FormData) {
  const admin = await requireAdminUser();
  await pickPlayer(
    admin.id,
    String(formData.get("roundId")),
    String(formData.get("playerId")),
    "ADMIN",
  );
  revalidateAdminPaths("/admin/auction");
}

export async function resolveTimedOutNominationAction(formData: FormData) {
  const admin = await requireAdminUser();
  const result = await nominatePlayer(
    admin.id,
    String(formData.get("roundId")),
    String(formData.get("playerId")),
    "ADMIN",
  );
  if (!result.ok) {
    throw new Error(result.error);
  }
  revalidateAdminPaths("/admin", "/admin/auction");
}

export async function reopenBiddingRoundAction(formData: FormData) {
  const admin = await requireAdminUser();
  await reopenBiddingRound(admin.id, String(formData.get("roundId")));
  revalidateAdminPaths("/admin", "/admin/auction");
}

export async function undoLastAdminInterventionAction() {
  const admin = await requireAdminUser();
  await undoLastAdminIntervention(admin.id);
  revalidateAdminPaths("/admin", "/admin/auction");
}

export async function correctLastPickAction() {
  const admin = await requireAdminUser();
  await correctLastPick(admin.id);
  revalidateAdminPaths("/admin", "/admin/auction");
}
