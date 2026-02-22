import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// في التطوير عدم تسجيل كل استعلام يقلل الثقل؛ استخدم DEBUG=prisma:query إن احتجت تتبع الاستعلامات
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
