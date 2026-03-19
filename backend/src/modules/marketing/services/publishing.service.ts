import { prisma } from '../../../db';
import type { PostStatus, PostType } from '@prisma/client';

interface CreatePostInput {
  creativeId?: string;
  caption: string;
  mediaUrl?: string;
  postType?: PostType;
  scheduledAt: string; // ISO date string
  createdBy: string;
  pageIds: string[]; // social page IDs to publish to
}

export async function createScheduledPost(input: CreatePostInput) {
  const { pageIds, scheduledAt, ...postData } = input;

  const post = await prisma.scheduledPost.create({
    data: {
      ...postData,
      scheduledAt: new Date(scheduledAt),
      pages: {
        create: pageIds.map((socialPageId) => ({
          socialPageId,
        })),
      },
    },
    include: {
      pages: { include: { socialPage: true } },
      creative: true,
    },
  });

  return post;
}

export async function listScheduledPosts(filters: {
  status?: PostStatus;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const { status, from, to, page = 1, pageSize = 50 } = filters;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (from || to) {
    where.scheduledAt = {};
    if (from) (where.scheduledAt as Record<string, unknown>).gte = new Date(from);
    if (to) (where.scheduledAt as Record<string, unknown>).lte = new Date(to);
  }

  const [posts, total] = await Promise.all([
    prisma.scheduledPost.findMany({
      where,
      include: {
        pages: { include: { socialPage: true } },
        creative: true,
        creator: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.scheduledPost.count({ where }),
  ]);

  return { posts, total, page, pageSize };
}

export async function getCalendarPosts(from: string, to: string) {
  return prisma.scheduledPost.findMany({
    where: {
      scheduledAt: {
        gte: new Date(from),
        lte: new Date(to),
      },
    },
    include: {
      pages: { include: { socialPage: true } },
      creative: true,
      creator: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  });
}

export async function getPostById(id: string) {
  return prisma.scheduledPost.findUnique({
    where: { id },
    include: {
      pages: { include: { socialPage: true } },
      creative: true,
      creator: { select: { id: true, name: true } },
    },
  });
}

export async function updatePost(id: string, data: Record<string, unknown>) {
  return prisma.scheduledPost.update({
    where: { id },
    data,
    include: {
      pages: { include: { socialPage: true } },
      creative: true,
    },
  });
}

export async function updatePostStatus(id: string, status: PostStatus) {
  return prisma.scheduledPost.update({
    where: { id },
    data: { status, ...(status === 'PUBLISHED' ? { publishedAt: new Date() } : {}) },
  });
}

export async function deletePost(id: string) {
  const post = await prisma.scheduledPost.findUnique({ where: { id } });
  if (!post) throw new Error('Post not found');
  if (post.status !== 'DRAFT' && post.status !== 'SCHEDULED') {
    throw new Error('Can only delete DRAFT or SCHEDULED posts');
  }
  return prisma.scheduledPost.delete({ where: { id } });
}

// --- Social Pages ---

export async function listSocialPages() {
  return prisma.socialPage.findMany({
    where: { isActive: true },
    include: { brand: true },
    orderBy: { pageName: 'asc' },
  });
}

export async function listBrands() {
  return prisma.brand.findMany({
    include: { pages: true },
    orderBy: { name: 'asc' },
  });
}

export async function createBrand(data: { name: string; slug: string; language?: string }) {
  return prisma.brand.create({ data });
}

export async function connectSocialPage(data: {
  platform: string;
  pageId: string;
  pageName: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: string;
  brandId: string;
}) {
  const { encryptToken } = await import('../../../shared/utils/token-encryption');
  return prisma.socialPage.create({
    data: {
      platform: data.platform,
      pageId: data.pageId,
      pageName: data.pageName,
      accessToken: encryptToken(data.accessToken),
      refreshToken: data.refreshToken ? encryptToken(data.refreshToken) : null,
      tokenExpiry: data.tokenExpiry ? new Date(data.tokenExpiry) : null,
      brandId: data.brandId,
    },
    include: { brand: true },
  });
}

export async function disconnectSocialPage(id: string) {
  return prisma.socialPage.update({
    where: { id },
    data: { isActive: false },
  });
}
