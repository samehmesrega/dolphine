import { prisma } from '../../../db';

export async function listFaqs(productId: string) {
  return prisma.kbFaq.findMany({
    where: { productId },
    orderBy: { orderNum: 'asc' },
  });
}

export async function getFaqById(id: string) {
  return prisma.kbFaq.findUnique({ where: { id } });
}

export async function createFaq(data: {
  productId: string;
  question: string;
  answer: string;
  orderNum?: number;
}) {
  return prisma.kbFaq.create({
    data: {
      productId: data.productId,
      question: data.question,
      answer: data.answer,
      orderNum: data.orderNum ?? 0,
    },
  });
}

export async function updateFaq(
  id: string,
  data: Partial<{
    question: string;
    answer: string;
    orderNum: number;
  }>
) {
  return prisma.kbFaq.update({
    where: { id },
    data,
  });
}

export async function deleteFaq(id: string) {
  return prisma.kbFaq.delete({ where: { id } });
}

export async function reorderFaqs(productId: string, orderedIds: string[]) {
  const updates = orderedIds.map((id, index) =>
    prisma.kbFaq.update({
      where: { id },
      data: { orderNum: index },
    })
  );
  await prisma.$transaction(updates);
  return listFaqs(productId);
}
