import { prisma } from '../../../db';
import type { Prisma } from '@prisma/client';

interface ListProductsParams {
  q?: string;
  category?: string;
  projectId?: string;
}

export async function listProducts(params?: ListProductsParams) {
  const where: Prisma.KbProductWhereInput = { isActive: true };

  if (params?.category) {
    where.category = params.category;
  }

  if (params?.projectId) {
    where.projectId = params.projectId;
  }

  if (params?.q) {
    where.OR = [
      { name: { contains: params.q, mode: 'insensitive' } },
      { description: { contains: params.q, mode: 'insensitive' } },
      {
        faqs: {
          some: {
            OR: [
              { question: { contains: params.q, mode: 'insensitive' } },
              { answer: { contains: params.q, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
  }

  const products = await prisma.kbProduct.findMany({
    where,
    include: {
      project: true,
      _count: {
        select: {
          media: true,
          faqs: true,
          variations: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return products;
}

export async function getProductById(id: string) {
  return prisma.kbProduct.findUnique({
    where: { id },
    include: {
      project: true,
      wooProduct: true,
      media: { orderBy: { orderNum: 'asc' } },
      suppliers: { orderBy: { createdAt: 'desc' } },
      manufacturing: true,
      pricing: {
        include: { variation: true },
        orderBy: { updatedAt: 'desc' },
      },
      variations: {
        include: { pricing: true },
        orderBy: { createdAt: 'desc' },
      },
      marketing: true,
      faqs: { orderBy: { orderNum: 'asc' } },
      objections: { orderBy: { orderNum: 'asc' } },
      upsellsFrom: {
        include: {
          relatedProduct: {
            select: { id: true, name: true, slug: true, category: true },
          },
        },
        orderBy: { orderNum: 'asc' },
      },
      afterSales: true,
      salesScripts: { orderBy: { orderNum: 'asc' } },
    },
  });
}

export async function createProduct(data: {
  name: string;
  slug: string;
  sku?: string;
  description?: string;
  category?: string;
  projectId?: string;
  wooProductId?: string;
  dimensions?: string;
  weight?: string;
  driveFolderUrl?: string;
  createdBy: string;
}) {
  return prisma.kbProduct.create({
    data: {
      name: data.name,
      slug: data.slug,
      sku: data.sku,
      description: data.description,
      category: data.category,
      projectId: data.projectId,
      wooProductId: data.wooProductId,
      dimensions: data.dimensions,
      weight: data.weight,
      driveFolderUrl: data.driveFolderUrl,
      createdBy: data.createdBy,
    },
    include: {
      project: true,
      _count: {
        select: {
          media: true,
          faqs: true,
          variations: true,
        },
      },
    },
  });
}

export async function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    slug: string;
    sku: string;
    description: string;
    category: string;
    projectId: string;
    wooProductId: string;
    dimensions: string;
    weight: string;
    driveFolderUrl: string;
  }>
) {
  return prisma.kbProduct.update({
    where: { id },
    data,
    include: {
      project: true,
      _count: {
        select: {
          media: true,
          faqs: true,
          variations: true,
        },
      },
    },
  });
}

export async function deleteProduct(id: string) {
  return prisma.kbProduct.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function searchProducts(q: string) {
  return prisma.kbProduct.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        {
          faqs: {
            some: {
              OR: [
                { question: { contains: q, mode: 'insensitive' } },
                { answer: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    },
    include: {
      project: true,
      faqs: {
        where: {
          OR: [
            { question: { contains: q, mode: 'insensitive' } },
            { answer: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
      _count: {
        select: {
          media: true,
          faqs: true,
          variations: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}
