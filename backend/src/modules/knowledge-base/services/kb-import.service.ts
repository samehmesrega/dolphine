import { z } from 'zod';
import { prisma } from '../../../db';

// ─── JSON Template ──────────────────────────────────────────────────────────

export const PRODUCT_IMPORT_TEMPLATE = {
  _instructions:
    'املأ بيانات المنتج أدناه. احذف الأقسام اللي مش محتاجها. الحقول المكتوب جنبها (مطلوب) لازم تتملأ.',
  product: {
    name: '(مطلوب) اسم المنتج',
    sku: 'كود المنتج مثل PRD-001',
    description: 'وصف المنتج التفصيلي',
    category: 'الفئة مثل: إلكترونيات، ملابس، مستحضرات تجميل',
    dimensions: 'الأبعاد مثل: 20x15x10 سم',
    weight: 'الوزن مثل: 0.5 كجم',
  },
  manufacturing: {
    materials: 'المواد الخام المستخدمة',
    productionSteps: 'خطوات الإنتاج',
    wastePercentage: 0,
    unitCost: 0,
    unitCostCurrency: 'EGP',
    packagingType: 'نوع التغليف',
    packagingDimensions: 'أبعاد التغليف',
    packagingCost: 0,
    shippingTerms: 'شروط الشحن',
  },
  pricing: [
    {
      _hint: 'currency: EGP | USD | SAR | AED | KWD — priceType: RETAIL | WHOLESALE | OFFER',
      currency: 'EGP',
      priceType: 'RETAIL',
      price: 0,
      notes: 'ملاحظات (اختياري)',
    },
  ],
  variations: [
    {
      name: 'اسم الفاريشن مثل: أحمر - كبير',
      color: 'اللون (اختياري)',
      size: 'المقاس (اختياري)',
      sku: 'كود الفاريشن (اختياري)',
    },
  ],
  marketing: {
    usps: 'نقاط البيع الفريدة (Unique Selling Points)',
    targetAudience: 'الجمهور المستهدف',
    competitorComparison: 'مقارنة بالمنافسين',
    brandVoice: 'صوت البراند / أسلوب التواصل',
    keywords: 'كلمات مفتاحية مفصولة بفاصلة',
  },
  faqs: [{ question: 'السؤال', answer: 'الإجابة' }],
  objections: [{ objection: 'الاعتراض', response: 'الرد على الاعتراض' }],
  afterSales: {
    returnPolicy: 'سياسة الإرجاع والاستبدال',
    usageInstructions: 'تعليمات الاستخدام',
    troubleshooting: 'حل المشاكل الشائعة',
    spareParts: 'قطع الغيار المتاحة',
    warrantyTerms: 'شروط الضمان',
  },
  salesScripts: [{ title: 'عنوان السكريبت مثل: سكريبت الرد على العميل الجديد', content: 'محتوى السكريبت' }],
  suppliers: [
    {
      name: 'اسم المورد',
      contactInfo: 'بيانات التواصل (تليفون، إيميل، عنوان)',
      rating: 5,
      notes: 'ملاحظات عن المورد',
    },
  ],
};

// ─── Zod Validation Schema ──────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1, 'اسم المنتج مطلوب'),
  slug: z.string().optional(),
  sku: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  dimensions: z.string().optional(),
  weight: z.string().optional(),
});

const manufacturingSchema = z
  .object({
    materials: z.string().optional(),
    productionSteps: z.string().optional(),
    wastePercentage: z.number().optional(),
    unitCost: z.number().optional(),
    unitCostCurrency: z.string().optional(),
    packagingType: z.string().optional(),
    packagingDimensions: z.string().optional(),
    packagingCost: z.number().optional(),
    shippingTerms: z.string().optional(),
  })
  .optional();

const pricingItemSchema = z.object({
  currency: z.enum(['EGP', 'USD', 'SAR', 'AED', 'KWD'], {
    error: 'العملة غير صحيحة. القيم المسموحة: EGP, USD, SAR, AED, KWD',
  }),
  priceType: z.enum(['RETAIL', 'WHOLESALE', 'OFFER'], {
    error: 'نوع السعر غير صحيح. القيم المسموحة: RETAIL, WHOLESALE, OFFER',
  }),
  price: z.number({ error: 'السعر مطلوب ولازم يكون رقم' }),
  notes: z.string().optional(),
});

const variationItemSchema = z.object({
  name: z.string().min(1, 'اسم الفاريشن مطلوب'),
  color: z.string().optional(),
  size: z.string().optional(),
  sku: z.string().optional(),
});

const marketingSchema = z
  .object({
    usps: z.string().optional(),
    targetAudience: z.string().optional(),
    competitorComparison: z.string().optional(),
    brandVoice: z.string().optional(),
    keywords: z.string().optional(),
  })
  .optional();

const faqItemSchema = z.object({
  question: z.string().min(1, 'السؤال مطلوب'),
  answer: z.string().min(1, 'الإجابة مطلوبة'),
});

const objectionItemSchema = z.object({
  objection: z.string().min(1, 'الاعتراض مطلوب'),
  response: z.string().min(1, 'الرد مطلوب'),
});

const afterSalesSchema = z
  .object({
    returnPolicy: z.string().optional(),
    usageInstructions: z.string().optional(),
    troubleshooting: z.string().optional(),
    spareParts: z.string().optional(),
    warrantyTerms: z.string().optional(),
  })
  .optional();

const salesScriptItemSchema = z.object({
  title: z.string().min(1, 'عنوان السكريبت مطلوب'),
  content: z.string().min(1, 'محتوى السكريبت مطلوب'),
});

const supplierItemSchema = z.object({
  name: z.string().min(1, 'اسم المورد مطلوب'),
  contactInfo: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
});

export const importSchema = z.object({
  product: productSchema,
  manufacturing: manufacturingSchema,
  pricing: z.array(pricingItemSchema).optional().default([]),
  variations: z.array(variationItemSchema).optional().default([]),
  marketing: marketingSchema,
  faqs: z.array(faqItemSchema).optional().default([]),
  objections: z.array(objectionItemSchema).optional().default([]),
  afterSales: afterSalesSchema,
  salesScripts: z.array(salesScriptItemSchema).optional().default([]),
  suppliers: z.array(supplierItemSchema).optional().default([]),
});

export type ProductImportData = z.infer<typeof importSchema>;

// ─── Slug Generation ────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u0621-\u064A\u0660-\u0669-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'product';
}

async function getUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existing = await prisma.kbProduct.findUnique({ where: { slug } });
    if (!existing) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
    if (counter > 20) {
      slug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }

  return slug;
}

// ─── Helper: check if object has any truthy values ──────────────────────────

function hasValues(obj: Record<string, any> | undefined | null): boolean {
  if (!obj) return false;
  return Object.values(obj).some((v) => v !== undefined && v !== null && v !== '' && v !== 0);
}

// ─── Format Zod Errors ─────────────────────────────────────────────────────

export function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });
}

// ─── Import Product ─────────────────────────────────────────────────────────

export async function importProduct(data: ProductImportData, userId: string) {
  const slug = data.product.slug || generateSlug(data.product.name);
  const uniqueSlug = await getUniqueSlug(slug);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the product
    const product = await tx.kbProduct.create({
      data: {
        name: data.product.name,
        slug: uniqueSlug,
        sku: data.product.sku,
        description: data.product.description,
        category: data.product.category,
        dimensions: data.product.dimensions,
        weight: data.product.weight,
        createdBy: userId,
      },
    });

    // 2. Manufacturing (1:1)
    if (hasValues(data.manufacturing)) {
      await tx.kbManufacturing.create({
        data: {
          productId: product.id,
          materials: data.manufacturing!.materials,
          productionSteps: data.manufacturing!.productionSteps,
          wastePercentage: data.manufacturing!.wastePercentage,
          unitCost: data.manufacturing!.unitCost,
          unitCostCurrency: data.manufacturing!.unitCostCurrency,
          packagingType: data.manufacturing!.packagingType,
          packagingDimensions: data.manufacturing!.packagingDimensions,
          packagingCost: data.manufacturing!.packagingCost,
          shippingTerms: data.manufacturing!.shippingTerms,
        },
      });
    }

    // 3. Pricing (1:many)
    for (const p of data.pricing) {
      await tx.kbPricing.create({
        data: {
          productId: product.id,
          currency: p.currency,
          priceType: p.priceType,
          price: p.price,
          notes: p.notes,
        },
      });
    }

    // 4. Variations (1:many)
    for (const v of data.variations) {
      await tx.kbVariation.create({
        data: {
          productId: product.id,
          name: v.name,
          color: v.color,
          size: v.size,
          sku: v.sku,
        },
      });
    }

    // 5. Marketing (1:1)
    if (hasValues(data.marketing)) {
      await tx.kbMarketing.create({
        data: {
          productId: product.id,
          usps: data.marketing!.usps,
          targetAudience: data.marketing!.targetAudience,
          competitorComparison: data.marketing!.competitorComparison,
          brandVoice: data.marketing!.brandVoice,
          keywords: data.marketing!.keywords,
        },
      });
    }

    // 6. FAQs (1:many)
    for (let i = 0; i < data.faqs.length; i++) {
      await tx.kbFaq.create({
        data: {
          productId: product.id,
          question: data.faqs[i].question,
          answer: data.faqs[i].answer,
          orderNum: i,
        },
      });
    }

    // 7. Objections (1:many)
    for (let i = 0; i < data.objections.length; i++) {
      await tx.kbObjection.create({
        data: {
          productId: product.id,
          objection: data.objections[i].objection,
          response: data.objections[i].response,
          orderNum: i,
        },
      });
    }

    // 8. After Sales (1:1)
    if (hasValues(data.afterSales)) {
      await tx.kbAfterSales.create({
        data: {
          productId: product.id,
          returnPolicy: data.afterSales!.returnPolicy,
          usageInstructions: data.afterSales!.usageInstructions,
          troubleshooting: data.afterSales!.troubleshooting,
          spareParts: data.afterSales!.spareParts,
          warrantyTerms: data.afterSales!.warrantyTerms,
        },
      });
    }

    // 9. Sales Scripts (1:many)
    for (let i = 0; i < data.salesScripts.length; i++) {
      await tx.kbSalesScript.create({
        data: {
          productId: product.id,
          title: data.salesScripts[i].title,
          content: data.salesScripts[i].content,
          orderNum: i,
        },
      });
    }

    // 10. Suppliers (1:many)
    for (const s of data.suppliers) {
      await tx.kbSupplier.create({
        data: {
          productId: product.id,
          name: s.name,
          contactInfo: s.contactInfo,
          rating: s.rating,
          notes: s.notes,
        },
      });
    }

    return product;
  });

  return { id: result.id, name: result.name, slug: result.slug };
}
