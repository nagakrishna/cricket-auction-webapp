import { AuditAction, Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type AuditLogInput = {
  auctionId?: string;
  actorId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog(
  input: AuditLogInput,
  db: DbClient = prisma,
) {
  await db.auditLog.create({
    data: {
      auctionId: input.auctionId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      message: input.message,
      metadata: input.metadata,
    },
  });
}

export async function listAuditLogs(limit = 100) {
  return prisma.auditLog.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}
