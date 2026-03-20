import { prisma } from '../../../db';

export async function getManufacturing(productId: string) {
  return prisma.kbManufacturing.findUnique({
    where: { productId },
  });
}

export async function upsertManufacturing(
  productId: string,
  data: {
    materials?: string;
    productionSteps?: string;
    wastePercentage?: number;
    unitCost?: number;
    unitCostCurrency?: string;
    packagingType?: string;
    packagingDimensions?: string;
    packagingCost?: number;
    shippingTerms?: string;
  }
) {
  return prisma.kbManufacturing.upsert({
    where: { productId },
    create: {
      productId,
      ...data,
    },
    update: data,
  });
}

export async function deleteManufacturing(productId: string) {
  return prisma.kbManufacturing.delete({
    where: { productId },
  });
}
