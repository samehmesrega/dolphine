import { prisma } from '../../../db';
import type { KbUpsellType } from '@prisma/client';

export async function listUpsells(productId: string) {
  return prisma.kbUpsell.findMany({
    where: { productId },
    include: {
      relatedProduct: {
        select: { id: true, name: true, slug: true, category: true },
      },
    },
    orderBy: { orderNum: 'asc' },
  });
}

export async function getUpsellById(id: string) {
  return prisma.kbUpsell.findUnique({
    where: { id },
    include: {
      relatedProduct: {
        select: { id: true, name: true, slug: true, category: true },
      },
    },
  });
}

export async function createUpsell(data: {
  productId: string;
  relatedProductId: string;
  type: KbUpsellType;
  notes?: string;
  orderNum?: number;
}) {
  return prisma.kbUpsell.create({
    data: {
      productId: data.productId,
      relatedProductId: data.relatedProductId,
      type: data.type,
      notes: data.notes,
      orderNum: data.orderNum ?? 0,
    },
    include: {
      relatedProduct: {
        select: { id: true, name: true, slug: true, category: true },
      },
    },
  });
}

export async function updateUpsell(
  id: string,
  data: Partial<{
    relatedProductId: string;
    type: KbUpsellType;
    notes: string;
    orderNum: number;
  }>
) {
  return prisma.kbUpsell.update({
    where: { id },
    data,
    include: {
      relatedProduct: {
        select: { id: true, name: true, slug: true, category: true },
      },
    },
  });
}

export async function deleteUpsell(id: string) {
  return prisma.kbUpsell.delete({ where: { id } });
}
