import { prisma } from '../../../db';

export async function listSalesScripts(productId: string) {
  return prisma.kbSalesScript.findMany({
    where: { productId },
    orderBy: { orderNum: 'asc' },
  });
}

export async function getSalesScriptById(id: string) {
  return prisma.kbSalesScript.findUnique({ where: { id } });
}

export async function createSalesScript(data: {
  productId: string;
  title: string;
  content: string;
  orderNum?: number;
}) {
  return prisma.kbSalesScript.create({
    data: {
      productId: data.productId,
      title: data.title,
      content: data.content,
      orderNum: data.orderNum ?? 0,
    },
  });
}

export async function updateSalesScript(
  id: string,
  data: Partial<{
    title: string;
    content: string;
    orderNum: number;
  }>
) {
  return prisma.kbSalesScript.update({
    where: { id },
    data,
  });
}

export async function deleteSalesScript(id: string) {
  return prisma.kbSalesScript.delete({ where: { id } });
}

export async function reorderSalesScripts(productId: string, orderedIds: string[]) {
  const updates = orderedIds.map((id, index) =>
    prisma.kbSalesScript.update({
      where: { id },
      data: { orderNum: index },
    })
  );
  await prisma.$transaction(updates);
  return listSalesScripts(productId);
}
