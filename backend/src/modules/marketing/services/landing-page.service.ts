import { prisma } from '../../../db';

// ===== CRUD =====

export async function listLandingPages(params?: {
  brandId?: string;
  status?: string;
}) {
  return prisma.landingPage.findMany({
    where: {
      ...(params?.brandId ? { brandId: params.brandId } : {}),
      ...(params?.status ? { status: params.status as any } : {}),
    },
    include: {
      brand: { select: { id: true, name: true, slug: true } },
      _count: { select: { versions: true, fieldMappings: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getLandingPageById(id: string) {
  return prisma.landingPage.findUnique({
    where: { id },
    include: {
      brand: { select: { id: true, name: true, slug: true, language: true } },
      versions: { orderBy: { versionNumber: 'desc' }, take: 10 },
      fieldMappings: true,
    },
  });
}

export async function createLandingPage(data: {
  title: string;
  slug: string;
  brandId: string;
  productId?: string;
  html: string;
  css?: string;
  createdBy: string;
}) {
  // Ensure unique slug
  let slug = data.slug;
  const existing = await prisma.landingPage.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Save initial version as v1
  return prisma.landingPage.create({
    data: {
      title: data.title,
      slug,
      brandId: data.brandId,
      productId: data.productId || undefined,
      html: data.html,
      css: data.css || undefined,
      createdBy: data.createdBy,
      versions: {
        create: {
          versionNumber: 1,
          html: data.html,
          css: data.css || undefined,
          editPrompt: 'Initial version',
        },
      },
    },
    include: { brand: true, versions: true },
  });
}

export async function updateLandingPage(
  id: string,
  data: { title?: string; slug?: string; productId?: string | null }
) {
  return prisma.landingPage.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.productId !== undefined ? { productId: data.productId } : {}),
    },
  });
}

export async function updateLandingPageHtml(
  id: string,
  html: string,
  css: string | undefined,
  editPrompt: string
) {
  // Get next version number
  const lastVersion = await prisma.landingPageVersion.findFirst({
    where: { landingPageId: id },
    orderBy: { versionNumber: 'desc' },
  });
  const nextVersion = (lastVersion?.versionNumber || 0) + 1;

  // Update page HTML + create version
  const [page] = await prisma.$transaction([
    prisma.landingPage.update({
      where: { id },
      data: { html, css },
    }),
    prisma.landingPageVersion.create({
      data: {
        landingPageId: id,
        versionNumber: nextVersion,
        html,
        css,
        editPrompt,
      },
    }),
  ]);
  return { page, versionNumber: nextVersion };
}

export async function publishLandingPage(id: string) {
  return prisma.landingPage.update({
    where: { id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });
}

export async function unpublishLandingPage(id: string) {
  return prisma.landingPage.update({
    where: { id },
    data: { status: 'DRAFT', publishedAt: null },
  });
}

export async function deleteLandingPage(id: string) {
  return prisma.landingPage.delete({ where: { id } });
}

// ===== Versions =====

export async function getVersions(landingPageId: string) {
  return prisma.landingPageVersion.findMany({
    where: { landingPageId },
    orderBy: { versionNumber: 'desc' },
  });
}

export async function rollbackToVersion(landingPageId: string, versionId: string) {
  const version = await prisma.landingPageVersion.findUnique({
    where: { id: versionId },
  });
  if (!version || version.landingPageId !== landingPageId) {
    throw new Error('Version not found');
  }

  // Create a new version based on the rollback
  const lastVersion = await prisma.landingPageVersion.findFirst({
    where: { landingPageId },
    orderBy: { versionNumber: 'desc' },
  });
  const nextVersion = (lastVersion?.versionNumber || 0) + 1;

  const [page] = await prisma.$transaction([
    prisma.landingPage.update({
      where: { id: landingPageId },
      data: { html: version.html, css: version.css },
    }),
    prisma.landingPageVersion.create({
      data: {
        landingPageId,
        versionNumber: nextVersion,
        html: version.html,
        css: version.css,
        editPrompt: `Rollback to version ${version.versionNumber}`,
      },
    }),
  ]);
  return page;
}

// ===== Field Mappings =====

export async function getFieldMappings(landingPageId: string) {
  return prisma.formFieldMapping.findMany({ where: { landingPageId } });
}

export async function updateFieldMappings(
  landingPageId: string,
  mappings: Array<{ formFieldName: string; leadField: string }>
) {
  // Delete existing and recreate
  await prisma.$transaction([
    prisma.formFieldMapping.deleteMany({ where: { landingPageId } }),
    ...mappings.map((m) =>
      prisma.formFieldMapping.create({
        data: {
          landingPageId,
          formFieldName: m.formFieldName,
          leadField: m.leadField,
        },
      })
    ),
  ]);
  return prisma.formFieldMapping.findMany({ where: { landingPageId } });
}

// ===== A/B Tests =====

export async function createABTest(data: {
  landingPageAId: string;
  landingPageBId: string;
  trafficSplit?: number;
}) {
  return prisma.aBTest.create({
    data: {
      landingPageAId: data.landingPageAId,
      landingPageBId: data.landingPageBId,
      trafficSplit: data.trafficSplit || 50,
    },
    include: {
      landingPageA: { select: { id: true, title: true, slug: true } },
      landingPageB: { select: { id: true, title: true, slug: true } },
    },
  });
}

export async function listABTests() {
  return prisma.aBTest.findMany({
    include: {
      landingPageA: { select: { id: true, title: true, slug: true } },
      landingPageB: { select: { id: true, title: true, slug: true } },
    },
    orderBy: { startedAt: 'desc' },
  });
}

export async function endABTest(id: string, winnerId?: string) {
  return prisma.aBTest.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      winnerId: winnerId || undefined,
      completedAt: new Date(),
    },
  });
}

export async function getActiveABTest(landingPageId: string) {
  return prisma.aBTest.findFirst({
    where: {
      status: 'RUNNING',
      OR: [
        { landingPageAId: landingPageId },
        { landingPageBId: landingPageId },
      ],
    },
    include: {
      landingPageA: { select: { id: true, html: true } },
      landingPageB: { select: { id: true, html: true } },
    },
  });
}

// ===== Public: Serve LP =====

export async function getPublishedLP(brandSlug: string, slug: string) {
  const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
  if (!brand) return null;

  return prisma.landingPage.findFirst({
    where: { brandId: brand.id, slug, status: 'PUBLISHED' },
    include: { fieldMappings: true },
  });
}

// ===== Public: Form Submission =====

export async function handleFormSubmission(
  landingPageId: string,
  formData: Record<string, string>
) {
  // Get LP with field mappings
  const lp = await prisma.landingPage.findUnique({
    where: { id: landingPageId },
    include: { fieldMappings: true, brand: true },
  });
  if (!lp) throw new Error('Landing page not found');

  // Map form fields to lead fields
  const leadData: Record<string, string> = {};
  for (const mapping of lp.fieldMappings) {
    if (formData[mapping.formFieldName]) {
      leadData[mapping.leadField] = formData[mapping.formFieldName];
    }
  }

  // Normalize phone
  const phone = leadData.phone || '';
  const phoneNormalized = phone.replace(/\D/g, '');

  // Duplicate check: same phone + same LP within 24h
  if (phoneNormalized) {
    const existing = await prisma.lead.findFirst({
      where: {
        phoneNormalized,
        landingPageId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (existing) return { duplicate: true };
  }

  // Get default status
  const defaultStatus = await prisma.leadStatus.findFirst({
    where: { slug: 'new' },
  });
  if (!defaultStatus) throw new Error('Default lead status not found');

  // Create lead
  const lead = await prisma.lead.create({
    data: {
      name: leadData.name || 'Unknown',
      phone: phone,
      phoneNormalized,
      whatsapp: leadData.whatsapp || undefined,
      email: leadData.email || undefined,
      address: leadData.address || undefined,
      source: 'landing_page',
      sourceDetail: `${lp.brand.name} - ${lp.title}`,
      statusId: defaultStatus.id,
      landingPageId,
      utmSource: formData._utm_source || undefined,
      utmMedium: formData._utm_medium || undefined,
      utmCampaign: formData._utm_campaign || undefined,
      utmContent: formData._utm_content || undefined,
      creativeCode: formData._utm_content || undefined,
    },
  });

  return { lead, duplicate: false };
}
