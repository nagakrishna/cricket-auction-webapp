import { prisma } from "@/lib/db/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

function parseCookies(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return new Map<string, string>();
  }

  return new Map(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, ...value] = part.split("=");
        return [key, decodeURIComponent(value.join("="))];
      }),
  );
}

export function getSessionTokenFromCookieHeader(cookieHeader: string | undefined) {
  return parseCookies(cookieHeader).get(SESSION_COOKIE_NAME) ?? null;
}

export async function registerRealtimeConnection(input: {
  sessionToken: string;
  socketId: string;
  auctionId: string;
}) {
  const session = await prisma.session.findUnique({
    where: {
      token: input.sessionToken,
    },
    include: {
      user: {
        include: {
          teamOwnerships: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  const team = session.user.teamOwnerships[0] ?? null;
  const existingConnection = await prisma.realtimeConnection.findUnique({
    where: {
      socketId: input.socketId,
    },
  });

  const connection = existingConnection
    ? await prisma.realtimeConnection.update({
        where: {
          socketId: input.socketId,
        },
        data: {
          userId: session.user.id,
          auctionId: input.auctionId,
          teamId: team?.id,
          status: "CONNECTED",
          disconnectedAt: null,
          lastSeenAt: new Date(),
          metadata: {
            role: session.user.role,
          },
        },
      })
    : await prisma.realtimeConnection.create({
        data: {
          userId: session.user.id,
          auctionId: input.auctionId,
          teamId: team?.id,
          socketId: input.socketId,
          status: "CONNECTED",
          metadata: {
            role: session.user.role,
          },
        },
      });

  if (
    session.user.role === "TEAM_OWNER" &&
    (!existingConnection || existingConnection.status === "DISCONNECTED")
  ) {
    // Socket joins can be replayed during reconnects or client resubscriptions.
    // We keep the registration idempotent and only emit a fresh connect log when
    // the socket is first seen or after it had been marked disconnected.
    await prisma.auditLog.create({
      data: {
        auctionId: input.auctionId,
        actorId: session.user.id,
        action: "OWNER_CONNECTED",
        entityType: "realtime_connection",
        entityId: connection.id,
        message: `${session.user.displayName} connected to the live auction.`,
        metadata: {
          socketId: input.socketId,
          teamId: team?.id,
        },
      },
    });
  }

  return {
    userId: session.user.id,
    role: session.user.role,
    teamId: team?.id ?? null,
    connectionId: connection.id,
  };
}

export async function markRealtimeDisconnected(socketId: string) {
  const connection = await prisma.realtimeConnection.findUnique({
    where: {
      socketId,
    },
    include: {
      user: true,
    },
  });

  if (!connection) {
    return null;
  }

  await prisma.realtimeConnection.update({
    where: {
      id: connection.id,
    },
    data: {
      status: "DISCONNECTED",
      disconnectedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  if (connection.user.role === "TEAM_OWNER") {
    await prisma.auditLog.create({
      data: {
        auctionId: connection.auctionId,
        actorId: connection.userId,
        action: "OWNER_DISCONNECTED",
        entityType: "realtime_connection",
        entityId: connection.id,
        message: `${connection.user.displayName} disconnected from the live auction.`,
        metadata: {
          socketId,
          teamId: connection.teamId,
        },
      },
    });
  }

  return connection;
}
