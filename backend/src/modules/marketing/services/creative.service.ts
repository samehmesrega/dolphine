import { prisma } from '../../../db';
import { generateCreativeCode } from '../utils/creative-code';
import type { CreativeType, CreativeStatus, Prisma } from '@prisma/client';

interface CreateCreativeInput {
  name: string;
  description?: string;
  type: CreativeType;
  driveUrl?: string;
  projectId: string;
  productId?: string;
  language: string;
  creatorId: string;
  requestId?: string;
  tagIds?: string[];
  codeSegments: Record<string, string>;
  photographerName?: string;
}

function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  // Format: /file/d/FILE_ID or /file/u/0/d/FILE_ID
  const m1 = url.match(/\/file(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

function generateDriveThumbnailUrl(driveUrl: string): string | null {
  const fileId = extractDriveFileId(driveUrl);
  if (!fileId) return null;
  return `https://lh3.googleusercontent.com/d/${fileId}=w400`;
}

interface ListCreativesInput {
  projectId?: string;
  productId?: string;
  status?: CreativeStatus;
  type?: CreativeType;
  tagIds?: string[];
  creatorId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function createCreative(input: CreateCreativeInput) {
  const code = await generateCreativeCode(input.codeSegments);

  const thumbnailUrl = input.driveUrl ? generateDriveThumbnailUrl(input.driveUrl) : undefined;

  const creative = await prisma.creative.create({
    data: {
      code,
      name: input.name,
      description: input.description,
      type: input.type,
      driveUrl: input.driveUrl,
      thumbnailUrl: thumbnailUrl ?? undefined,
      projectId: input.projectId,
      productId: input.productId,
      language: input.language,
      photographerName: input.photographerName,
      creatorId: input.creatorId,
      requestId: input.requestId,
      tags: input.tagIds?.length
        ? { create: input.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
    include: {
      project: true,
      product: true,
      creator: { select: { id: true, name: true } },
      tags: { include: { tag: { include: { category: true } } } },
    },
  });

  return creative;
}

export async function listCreatives(input: ListCreativesInput) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 25;

  const where: Prisma.CreativeWhereInput = {};

  if (input.projectId) where.projectId = input.projectId;
  if (input.productId) where.productId = input.productId;
  if (input.status) where.status = input.status;
  if (input.type) where.type = input.type;
  if (input.creatorId) where.creatorId = input.creatorId;
  if (input.search) {
    where.OR = [
      { name: { contains: input.search, mode: 'insensitive' } },
      { code: { contains: input.search, mode: 'insensitive' } },
    ];
  }
  if (input.tagIds?.length) {
    where.tags = { some: { tagId: { in: input.tagIds } } };
  }

  const [creatives, total] = await Promise.all([
    prisma.creative.findMany({
      where,
      include: {
        project: true,
        product: true,
        creator: { select: { id: true, name: true } },
        tags: { include: { tag: { include: { category: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.creative.count({ where }),
  ]);

  return { creatives, total, page, pageSize };
}

export async function getCreativeById(id: string) {
  return prisma.creative.findUnique({
    where: { id },
    include: {
      project: true,
      product: true,
      creator: { select: { id: true, name: true } },
      tags: { include: { tag: { include: { category: true } } } },
      performances: { orderBy: { date: 'desc' }, take: 30 },
      request: true,
    },
  });
}

export async function updateCreative(id: string, data: Partial<{
  name: string;
  description: string;
  type: CreativeType;
  driveUrl: string;
  thumbnailUrl: string;
  productId: string;
  language: string;
  status: CreativeStatus;
}>) {
  return prisma.creative.update({
    where: { id },
    data,
    include: {
      project: true,
      product: true,
      creator: { select: { id: true, name: true } },
      tags: { include: { tag: { include: { category: true } } } },
    },
  });
}

export async function updateCreativeTags(creativeId: string, tagIds: string[]) {
  await prisma.creativeTag.deleteMany({ where: { creativeId } });
  if (tagIds.length > 0) {
    await prisma.creativeTag.createMany({
      data: tagIds.map((tagId) => ({ creativeId, tagId })),
    });
  }
  return getCreativeById(creativeId);
}

export async function deleteCreative(id: string) {
  return prisma.creative.delete({ where: { id } });
}
