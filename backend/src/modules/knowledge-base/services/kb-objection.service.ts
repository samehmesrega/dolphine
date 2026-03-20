import { prisma } from '../../../db';

export async function listObjections(productId: string) {
  return prisma.kbObjection.findMany({
    where: { productId },
    orderBy: { orderNum: 'asc' },
  });
}

export async function getObjectionById(id: string) {
  return prisma.kbObjection.findUnique({ where: { id } });
}

export async function createObjection(data: {
  productId: string;
  objection: string;
  response: string;
  orderNum?: number;
}) {
  return prisma.kbObjection.create({
    data: {
      productId: data.productId,
      objection: data.objection,
      response: data.response,
      orderNum: data.orderNum ?? 0,
    },
  });
}

export async function updateObjection(
  id: string,
  data: Partial<{
    objection: string;
    response: string;
    orderNum: number;
  }>
) {
  return prisma.kbObjection.update({
    where: { id },
    data,
  });
}

export async function deleteObjection(id: string) {
  return prisma.kbObjection.delete({ where: { id } });
}

export async function reorderObjections(productId: string, orderedIds: string[]) {
  const updates = orderedIds.map((id, index) =>
    prisma.kbObjection.update({
      where: { id },
      data: { orderNum: index },
    })
  );
  await prisma.$transaction(updates);
  return listObjections(productId);
}
