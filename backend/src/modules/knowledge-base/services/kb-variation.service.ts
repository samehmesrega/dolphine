import { prisma } from '../../../db';
import type { KbVariationSource } from '@prisma/client';

export async function listVariations(productId: string) {
  return prisma.kbVariation.findMany({
    where: { productId },
    include: { pricing: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getVariationById(id: string) {
  return prisma.kbVariation.findUnique({
    where: { id },
    include: { pricing: true },
  });
}

export async function createVariation(data: {
  productId: string;
  name: string;
  color?: string;
  size?: string;
  sku?: string;
  wooVariationId?: number;
  source?: KbVariationSource;
}) {
  return prisma.kbVariation.create({
    data: {
      productId: data.productId,
      name: data.name,
      color: data.color,
      size: data.size,
      sku: data.sku,
      wooVariationId: data.wooVariationId,
      source: data.source ?? 'MANUAL',
    },
    include: { pricing: true },
  });
}

export async function updateVariation(
  id: string,
  data: Partial<{
    name: string;
    color: string;
    size: string;
    sku: string;
    wooVariationId: number;
    source: KbVariationSource;
    isActive: boolean;
  }>
) {
  return prisma.kbVariation.update({
    where: { id },
    data,
    include: { pricing: true },
  });
}

export async function deleteVariation(id: string) {
  return prisma.kbVariation.delete({ where: { id } });
}
