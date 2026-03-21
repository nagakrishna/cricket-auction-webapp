import { addHours, isBefore } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env/server";
import { createToken, hashToken } from "@/lib/auth/crypto";
import { hashPassword } from "@/lib/auth/password";
import { redeemInviteSchema } from "@/lib/validation/auth";
import { createInviteSchema } from "@/lib/validation/auction";
import { writeAuditLog } from "@/server/logs/audit-log";

async function loadInviteByPublicToken(token: string) {
  return prisma.invite.findUnique({
    where: { publicToken: token },
    include: {
      team: {
        include: {
          owner: true,
        },
      },
    },
  });
}

type InviteLookupRecord = Awaited<ReturnType<typeof loadInviteByPublicToken>>;
type InviteLifecycleRecord = {
  expiresAt: Date;
  status: "PENDING" | "REDEEMED" | "EXPIRED" | "REVOKED";
  team: {
    ownerId: string | null;
  };
} | null;

export type PublicInviteDetails = {
  id: string;
  publicToken: string;
  status: "PENDING" | "REDEEMED" | "EXPIRED" | "REVOKED";
  expiresAt: Date;
  createdAt: Date;
  team: {
    id: string;
    name: string;
    shortCode: string;
    ownerId: string | null;
  };
};

export type AdminInviteListItem = {
  id: string;
  publicToken: string;
  teamId: string;
  createdById: string;
  redeemedById: string | null;
  expiresAt: Date;
  redeemedAt: Date | null;
  status: "PENDING" | "REDEEMED" | "EXPIRED" | "REVOKED";
  createdAt: Date;
  updatedAt: Date;
  team: {
    id: string;
    name: string;
    shortCode: string;
    ownerId: string | null;
  };
  createdBy: {
    id: string;
    displayName: string;
    email: string;
  };
  redeemedBy: {
    id: string;
    displayName: string;
    email: string;
  } | null;
};

function getInviteLifecycleStatus(invite: InviteLifecycleRecord) {
  if (!invite) {
    return null;
  }

  if (invite.team.ownerId) {
    return "REVOKED" as const;
  }

  if (isBefore(invite.expiresAt, new Date())) {
    return "EXPIRED" as const;
  }

  return invite.status;
}

function toPublicInviteDetails(invite: NonNullable<InviteLookupRecord>): PublicInviteDetails {
  return {
    id: invite.id,
    publicToken: invite.publicToken,
    status: getInviteLifecycleStatus(invite) ?? invite.status,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    team: {
      id: invite.team.id,
      name: invite.team.name,
      shortCode: invite.team.shortCode,
      ownerId: invite.team.ownerId,
    },
  };
}

export async function createInvite(input: unknown, actorId: string) {
  const values = createInviteSchema.parse(input);
  const team = await prisma.team.findUnique({
    where: {
      id: values.teamId,
    },
    include: {
      owner: true,
    },
  });

  if (!team) {
    throw new Error("Team not found.");
  }

  if (team.ownerId) {
    throw new Error("This team already has an owner account.");
  }

  const rawToken = createToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = addHours(new Date(), values.expiresInHours);

  await prisma.invite.updateMany({
    where: {
      teamId: values.teamId,
      status: "PENDING",
    },
    data: {
      status: "REVOKED",
    },
  });

  const invite = await prisma.invite.create({
    data: {
      publicToken: rawToken,
      tokenHash,
      teamId: team.id,
      createdById: actorId,
      expiresAt,
    },
    include: {
      team: true,
    },
  });

  await writeAuditLog({
    action: "INVITE_CREATED",
    actorId,
    entityType: "invite",
    entityId: invite.id,
    message: `Created invite for ${invite.team.name}.`,
    metadata: {
      teamId: invite.teamId,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return {
    inviteId: invite.id,
    teamName: invite.team.name,
    url: `${getEnv().APP_URL}/invite/${rawToken}`,
    expiresAt,
  };
}

export async function getInviteByToken(token: string) {
  const invite = await loadInviteByPublicToken(token);

  if (!invite) {
    return null;
  }

  return toPublicInviteDetails(invite);
}

export async function listInvites() {
  const invites = await prisma.invite.findMany({
    include: {
      team: true,
      createdBy: true,
      redeemedBy: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return invites.map<AdminInviteListItem>((invite) => ({
    id: invite.id,
    publicToken: invite.publicToken,
    teamId: invite.teamId,
    createdById: invite.createdById,
    redeemedById: invite.redeemedById,
    expiresAt: invite.expiresAt,
    redeemedAt: invite.redeemedAt,
    status: getInviteLifecycleStatus(invite) ?? invite.status,
    createdAt: invite.createdAt,
    updatedAt: invite.updatedAt,
    team: {
      id: invite.team.id,
      name: invite.team.name,
      shortCode: invite.team.shortCode,
      ownerId: invite.team.ownerId,
    },
    createdBy: {
      id: invite.createdBy.id,
      displayName: invite.createdBy.displayName,
      email: invite.createdBy.email,
    },
    redeemedBy: invite.redeemedBy
      ? {
          id: invite.redeemedBy.id,
          displayName: invite.redeemedBy.displayName,
          email: invite.redeemedBy.email,
        }
      : null,
  }));
}

export async function redeemInvite(input: unknown) {
  const values = redeemInviteSchema.parse(input);
  const hashedToken = hashToken(values.token);

  const invite = await loadInviteByPublicToken(values.token);

  if (!invite || invite.tokenHash !== hashedToken) {
    return { ok: false as const, error: "Invite not found." };
  }

  const lifecycleStatus = getInviteLifecycleStatus(invite);

  if (lifecycleStatus !== "PENDING") {
    if (invite.team.ownerId) {
      return { ok: false as const, error: "This team already has an owner account." };
    }

    // An invite can become unusable either because it expired naturally or because
    // the team was claimed through another path. We surface the same external
    // behavior here and keep the persistence update only for true expiration.
    if (lifecycleStatus === "EXPIRED") {
      await prisma.invite.update({
        where: { id: invite.id },
        data: { status: "EXPIRED" },
      });
      return { ok: false as const, error: "Invite has expired." };
    }

    return { ok: false as const, error: "Invite is no longer active." };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: values.email.toLowerCase() },
  });

  if (existingUser) {
    return { ok: false as const, error: "Email already in use." };
  }

  const passwordHash = await hashPassword(values.password);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: values.email.toLowerCase(),
        displayName: values.displayName,
        passwordHash,
        role: "TEAM_OWNER",
      },
    });

    await tx.team.update({
      where: { id: invite.teamId },
      data: {
        ownerId: createdUser.id,
      },
    });

    await tx.invite.update({
      where: { id: invite.id },
      data: {
        status: "REDEEMED",
        redeemedAt: new Date(),
        redeemedById: createdUser.id,
      },
    });

    return createdUser;
  });

  await writeAuditLog({
    actorId: user.id,
    action: "INVITE_REDEEMED",
    entityType: "invite",
    entityId: invite.id,
    message: `${invite.team.name} owner completed invite onboarding.`,
    metadata: {
      teamId: invite.teamId,
      ownerId: user.id,
    },
  });

  return {
    ok: true as const,
    userId: user.id,
    teamId: invite.teamId,
  };
}
