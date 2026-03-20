import { prisma } from '../../../db';

export async function listSuppliers(productId: string) {
  return prisma.kbSupplier.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSupplierById(id: string) {
  return prisma.kbSupplier.findUnique({ where: { id } });
}

export async function createSupplier(data: {
  productId: string;
  name: string;
  contactInfo?: string;
  rating?: number;
  notes?: string;
}) {
  return prisma.kbSupplier.create({
    data: {
      productId: data.productId,
      name: data.name,
      contactInfo: data.contactInfo,
      rating: data.rating,
      notes: data.notes,
    },
  });
}

export async function updateSupplier(
  id: string,
  data: Partial<{
    name: string;
    contactInfo: string;
    rating: number;
    notes: string;
  }>
) {
  return prisma.kbSupplier.update({
    where: { id },
    data,
  });
}

export async function deleteSupplier(id: string) {
  return prisma.kbSupplier.delete({ where: { id } });
}
