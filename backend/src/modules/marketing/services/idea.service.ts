import { prisma } from '../../../db';
import type { IdeaStatus, Prisma } from '@prisma/client';

export async function createIdea(input: {
  title: string;
  description: string;
  projectId: string;
  platform?: string;
  contentType?: string;
  submittedBy: string;
  referenceUrls?: string[];
}) {
  return prisma.idea.create({
    data: {
      title: input.title,
      description: input.description,
      projectId: input.projectId,
      platform: input.platform,
      contentType: input.contentType,
      submittedBy: input.submittedBy,
      referenceUrls: input.referenceUrls ?? [],
    },
    include: {
      project: true,
      submitter: { select: { id: true, name: true } },
    },
  });
}

export async function listIdeas(filters: {
  status?: IdeaStatus;
  projectId?: string;
  platform?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const where: Prisma.IdeaWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.platform) where.platform = filters.platform;

  const [ideas, total] = await Promise.all([
    prisma.idea.findMany({
      where,
      include: {
        project: true,
        submitter: { select: { id: true, name: true } },
        _count: { select: { comments: true, scripts: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.idea.count({ where }),
  ]);

  return { ideas, total, page, pageSize };
}

export async function getIdeaById(id: string) {
  return prisma.idea.findUnique({
    where: { id },
    include: {
      project: true,
      submitter: { select: { id: true, name: true } },
      comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      scripts: { select: { id: true, title: true, status: true } },
    },
  });
}

export async function updateIdeaStatus(id: string, status: IdeaStatus) {
  return prisma.idea.update({ where: { id }, data: { status } });
}

export async function addIdeaComment(ideaId: string, userId: string, text: string) {
  return prisma.ideaComment.create({
    data: { ideaId, userId, text },
    include: { user: { select: { id: true, name: true } } },
  });
}
