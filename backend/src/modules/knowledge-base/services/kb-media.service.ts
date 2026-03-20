import { prisma } from '../../../db';
import type { KbMediaSource } from '@prisma/client';

export async function listMedia(productId: string) {
  return prisma.kbMedia.findMany({
    where: { productId },
    orderBy: { orderNum: 'asc' },
  });
}

export async function getMediaById(id: string) {
  return prisma.kbMedia.findUnique({ where: { id } });
}

export async function createMedia(data: {
  productId: string;
  type: string;
  url: string;
  thumbnail?: string;
  caption?: string;
  tags?: string;
  source?: KbMediaSource;
  orderNum?: number;
}) {
  return prisma.kbMedia.create({
    data: {
      productId: data.productId,
      type: data.type,
      url: data.url,
      thumbnail: data.thumbnail,
      caption: data.caption,
      tags: data.tags,
      source: data.source ?? 'UPLOAD',
      orderNum: data.orderNum ?? 0,
    },
  });
}

export async function updateMedia(
  id: string,
  data: Partial<{
    type: string;
    url: string;
    thumbnail: string;
    caption: string;
    tags: string;
    source: KbMediaSource;
    orderNum: number;
  }>
) {
  return prisma.kbMedia.update({
    where: { id },
    data,
  });
}

export async function deleteMedia(id: string) {
  return prisma.kbMedia.delete({ where: { id } });
}

export async function reorderMedia(productId: string, orderedIds: string[]) {
  const updates = orderedIds.map((id, index) =>
    prisma.kbMedia.update({
      where: { id },
      data: { orderNum: index },
    })
  );
  await prisma.$transaction(updates);
  return listMedia(productId);
}
