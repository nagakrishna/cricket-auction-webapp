import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { resetTeamOwnerPasswordSchema } from "@/lib/validation/auth";
import {
  deleteTeamSchema,
  teamSchema,
  updateTeamSchema,
} from "@/lib/validation/auction";

function sortTeamsForSelection<T extends { ownerId: string | null; createdAt: Date; name: string }>(
  teams: T[],
) {
  return [...teams].sort((left, right) => {
    if (!!left.ownerId !== !!right.ownerId) {
      return left.ownerId ? -1 : 1;
    }

    if (left.createdAt.getTime() !== right.createdAt.getTime()) {
      return left.createdAt.getTime() - right.createdAt.getTime();
    }

    return left.name.localeCompare(right.name);
  });
}

export function selectParticipatingTeams<T extends { ownerId: string | null; createdAt: Date; name: string }>(
  teams: T[],
  totalTeams: number,
) {
  return sortTeamsForSelection(teams).slice(0, totalTeams);
}

export type ListedTeam = Awaited<ReturnType<typeof listTeams>>[number];

export async function listParticipatingTeams(): Promise<ListedTeam[]> {
  const auction = await prisma.auction.findFirst({
    include: {
      settings: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!auction?.settings) {
    throw new Error("Auction settings must exist before loading teams.");
  }

  const teams = await listTeams();
  return selectParticipatingTeams(teams, auction.settings.totalTeams);
}

export async function createTeam(input: unknown) {
  const values = teamSchema.parse(input);
  const auction = await prisma.auction.findFirst({
    include: {
      settings: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!auction?.settings) {
    throw new Error("Auction settings must exist before creating teams.");
  }

  const currentCount = await prisma.team.count();

  if (currentCount >= auction.settings.totalTeams) {
    throw new Error(`Team limit of ${auction.settings.totalTeams} reached.`);
  }

  return prisma.team.create({
    data: {
      name: values.name,
      shortCode: values.shortCode.toUpperCase(),
    },
  });
}

export async function updateTeam(input: unknown) {
  const values = updateTeamSchema.parse(input);

  const team = await prisma.team.findUnique({
    where: {
      id: values.teamId,
    },
  });

  if (!team) {
    throw new Error("Team not found.");
  }

  return prisma.team.update({
    where: {
      id: values.teamId,
    },
    data: {
      name: values.name,
      shortCode: values.shortCode.toUpperCase(),
    },
  });
}

export async function deleteTeam(input: unknown) {
  const values = deleteTeamSchema.parse(input);

  const team = await prisma.team.findUnique({
    where: {
      id: values.teamId,
    },
    include: {
      owner: true,
      invites: {
        take: 1,
      },
      rosterEntries: {
        take: 1,
      },
      bids: {
        take: 1,
      },
      nominationRounds: {
        take: 1,
      },
      biddingRounds: {
        take: 1,
      },
      realtimeConnections: {
        take: 1,
      },
    },
  });

  if (!team) {
    throw new Error("Team not found.");
  }

  const hasDependencies =
    Boolean(team.owner) ||
    team.invites.length > 0 ||
    team.rosterEntries.length > 0 ||
    team.bids.length > 0 ||
    team.nominationRounds.length > 0 ||
    team.biddingRounds.length > 0 ||
    team.realtimeConnections.length > 0;

  if (hasDependencies) {
    throw new Error(
      "This team already has linked auction activity or onboarding data and cannot be removed.",
    );
  }

  await prisma.team.delete({
    where: {
      id: values.teamId,
    },
  });
}

export async function resetTeamOwnerPassword(input: unknown) {
  const values = resetTeamOwnerPasswordSchema.parse(input);

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

  if (!team.owner) {
    throw new Error("This team does not have an onboarded owner yet.");
  }

  const passwordHash = await hashPassword(values.password);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: team.owner!.id,
      },
      data: {
        passwordHash,
      },
    });

    await tx.session.deleteMany({
      where: {
        userId: team.owner!.id,
      },
    });
  });

  return {
    teamName: team.name,
    ownerName: team.owner.displayName,
  };
}

export async function listTeams() {
  return prisma.team.findMany({
    include: {
      owner: true,
      invites: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
      rosterEntries: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}
