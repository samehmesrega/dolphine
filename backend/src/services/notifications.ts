import type { PrismaClient, Prisma } from '@prisma/client';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>;

export async function createNotification(
  db: Tx,
  data: { userId: string; title: string; body?: string; type: string; entity?: string; entityId?: string }
) {
  return db.notification.create({
    data: {
      userId: data.userId,
      title: data.title,
      body: data.body ?? null,
      type: data.type,
      entity: data.entity ?? null,
      entityId: data.entityId ?? null,
    },
  });
}
