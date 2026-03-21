import { prisma } from '../../../db';

// ===== List Templates =====

export async function listTemplates() {
  return prisma.orderFormTemplate.findMany({
    include: { fields: true },
    orderBy: { createdAt: 'desc' },
  });
}

// ===== Get Template by ID =====

export async function getTemplateById(id: string) {
  return prisma.orderFormTemplate.findUnique({
    where: { id },
    include: { fields: { orderBy: { orderNum: 'asc' } } },
  });
}

// ===== Create Template =====

export async function createTemplate(data: {
  name: string;
  slug: string;
  paymentMethods?: string[];
  fields: Array<{
    fieldName: string;
    label: string;
    type?: string;
    required?: boolean;
    options?: string;
    leadField: string;
    orderNum?: number;
  }>;
}) {
  return prisma.$transaction(async (tx) => {
    const template = await tx.orderFormTemplate.create({
      data: {
        name: data.name,
        slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
        paymentMethods: data.paymentMethods || ['cod'],
        fields: {
          create: data.fields.map((f, i) => ({
            fieldName: f.fieldName,
            label: f.label,
            type: f.type || 'text',
            required: f.required ?? false,
            options: f.options || undefined,
            leadField: f.leadField,
            orderNum: f.orderNum ?? i,
          })),
        },
      },
      include: { fields: { orderBy: { orderNum: 'asc' } } },
    });
    return template;
  });
}

// ===== Update Template =====

export async function updateTemplate(
  id: string,
  data: {
    name?: string;
    slug?: string;
    paymentMethods?: string[];
    fields?: Array<{
      fieldName: string;
      label: string;
      type: string;
      required: boolean;
      options?: string;
      leadField: string;
      orderNum: number;
    }>;
  }
) {
  return prisma.$transaction(async (tx) => {
    await tx.orderFormTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.paymentMethods !== undefined ? { paymentMethods: data.paymentMethods } : {}),
      },
    });

    if (data.fields) {
      await tx.orderFormField.deleteMany({ where: { templateId: id } });
      await tx.orderFormField.createMany({
        data: data.fields.map((f) => ({
          templateId: id,
          fieldName: f.fieldName,
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.options || undefined,
          leadField: f.leadField,
          orderNum: f.orderNum,
        })),
      });
    }

    return tx.orderFormTemplate.findUnique({
      where: { id },
      include: { fields: { orderBy: { orderNum: 'asc' } } },
    });
  });
}

// ===== Delete Template =====

export async function deleteTemplate(id: string) {
  return prisma.orderFormTemplate.delete({ where: { id } });
}
