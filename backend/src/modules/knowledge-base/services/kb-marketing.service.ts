import { prisma } from '../../../db';

export async function getMarketing(productId: string) {
  return prisma.kbMarketing.findUnique({
    where: { productId },
  });
}

export async function upsertMarketing(
  productId: string,
  data: {
    usps?: string;
    targetAudience?: string;
    competitorComparison?: string;
    brandVoice?: string;
    keywords?: string;
  }
) {
  return prisma.kbMarketing.upsert({
    where: { productId },
    create: {
      productId,
      ...data,
    },
    update: data,
  });
}

export async function deleteMarketing(productId: string) {
  return prisma.kbMarketing.delete({
    where: { productId },
  });
}
