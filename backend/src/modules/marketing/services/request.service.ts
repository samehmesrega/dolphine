import { prisma } from '../../../db';
import type { RequestStatus, Prisma } from '@prisma/client';

interface CreateRequestInput {
  title: string;
  projectId: string;
  productId?: string;
  platform: string;
  language: string;
  instructions: string;
  referenceUrls?: string[];
  deadline?: Date;
  requestedBy: string;
}

export async function createRequest(input: CreateRequestInput) {
  return prisma.creativeRequest.create({
    data: {
      title: input.title,
      projectId: input.projectId,
      productId: input.productId,
      platform: input.platform,
      language: input.language,
      instructions: input.instructions,
      referenceUrls: input.referenceUrls ?? [],
      deadline: input.deadline,
      requestedBy: input.requestedBy,
    },
    include: {
      project: true,
      product: true,
      requester: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
}

export async function listRequests(filters: {
  status?: RequestStatus;
  projectId?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const where: Prisma.CreativeRequestWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.projectId) where.projectId = filters.projectId;

  const [requests, total] = await Promise.all([
    prisma.creativeRequest.findMany({
      where,
      include: {
        project: true,
        product: true,
        requester: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        _count: { select: { creatives: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.creativeRequest.count({ where }),
  ]);

  return { requests, total, page, pageSize };
}

export async function getRequestById(id: string) {
  return prisma.creativeRequest.findUnique({
    where: { id },
    include: {
      project: true,
      product: true,
      requester: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      creatives: {
        include: {
          creator: { select: { id: true, name: true } },
          tags: { include: { tag: true } },
        },
      },
    },
  });
}

export async function updateRequestStatus(id: string, status: RequestStatus) {
  return prisma.creativeRequest.update({
    where: { id },
    data: { status },
  });
}

export async function assignRequest(id: string, assignedTo: string) {
  return prisma.creativeRequest.update({
    where: { id },
    data: { assignedTo, status: 'IN_PRODUCTION' },
  });
}
