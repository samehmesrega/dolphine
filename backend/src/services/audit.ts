import type { PrismaClient } from '@prisma/client';
import { prisma } from '../db';

export async function auditLog(
  db: PrismaClient,
  data: {
    userId: string | null;
    action: string;
    entity: string;
    entityId: string;
    oldData?: unknown;
    newData?: unknown;
    ip?: string;
  }
) {
  return db.auditLog.create({
    data: {
      userId: data.userId,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId,
      oldData: (data.oldData ?? undefined) as object | undefined,
      newData: (data.newData ?? undefined) as object | undefined,
      ip: data.ip ?? undefined,
    },
  });
}
