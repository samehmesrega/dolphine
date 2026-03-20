import { prisma } from '../../../db';
import type { KbCurrency, KbPriceType } from '@prisma/client';

export async function listPricing(productId: string) {
  return prisma.kbPricing.findMany({
    where: { productId },
    include: { variation: true },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getPricingById(id: string) {
  return prisma.kbPricing.findUnique({
    where: { id },
    include: { variation: true },
  });
}

export async function createPricing(data: {
  productId: string;
  variationId?: string;
  currency: KbCurrency;
  priceType: KbPriceType;
  price: number;
  notes?: string;
}) {
  return prisma.kbPricing.create({
    data: {
      productId: data.productId,
      variationId: data.variationId,
      currency: data.currency,
      priceType: data.priceType,
      price: data.price,
      notes: data.notes,
    },
    include: { variation: true },
  });
}

export async function updatePricing(
  id: string,
  data: Partial<{
    variationId: string;
    currency: KbCurrency;
    priceType: KbPriceType;
    price: number;
    notes: string;
  }>
) {
  return prisma.kbPricing.update({
    where: { id },
    data,
    include: { variation: true },
  });
}

export async function deletePricing(id: string) {
  return prisma.kbPricing.delete({ where: { id } });
}
