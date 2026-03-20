import { prisma } from '../../../db';

export async function getAfterSales(productId: string) {
  return prisma.kbAfterSales.findUnique({
    where: { productId },
  });
}

export async function upsertAfterSales(
  productId: string,
  data: {
    returnPolicy?: string;
    usageInstructions?: string;
    troubleshooting?: string;
    spareParts?: string;
    warrantyTerms?: string;
  }
) {
  return prisma.kbAfterSales.upsert({
    where: { productId },
    create: {
      productId,
      ...data,
    },
    update: data,
  });
}

export async function deleteAfterSales(productId: string) {
  return prisma.kbAfterSales.delete({
    where: { productId },
  });
}
