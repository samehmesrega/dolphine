import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding platform modules...');

  // Create platform modules
  const leadsModule = await prisma.module.upsert({
    where: { slug: 'leads' },
    update: {},
    create: {
      name: 'Dolphin Leads',
      slug: 'leads',
      icon: '📊',
      description: 'إدارة الليدز والعملاء والطلبات',
      isActive: true,
      order: 1,
    },
  });

  const marketingModule = await prisma.module.upsert({
    where: { slug: 'marketing' },
    update: {},
    create: {
      name: 'Dolphin Marketing',
      slug: 'marketing',
      icon: '📢',
      description: 'إدارة المحتوى والحملات واللاندنج بيدجز',
      isActive: true,
      order: 2,
    },
  });

  // Create default module roles for Leads
  const leadsRoles = [
    { name: 'Admin', slug: 'admin', permissions: ['*'], isDefault: false },
    {
      name: 'Sales Manager',
      slug: 'sales_manager',
      permissions: [
        'leads.view', 'leads.create', 'leads.edit', 'leads.delete',
        'customers.view', 'customers.create', 'customers.edit',
        'orders.view', 'orders.create', 'orders.edit',
        'shifts.manage', 'dashboard.view', 'reports.view',
      ],
      isDefault: false,
    },
    {
      name: 'Sales Agent',
      slug: 'sales_agent',
      permissions: [
        'leads.view', 'leads.edit',
        'customers.view',
        'orders.view', 'orders.create',
      ],
      isDefault: true,
    },
    {
      name: 'Viewer',
      slug: 'viewer',
      permissions: ['leads.view', 'customers.view', 'orders.view', 'dashboard.view'],
      isDefault: false,
    },
  ];

  for (const role of leadsRoles) {
    await prisma.moduleRole.upsert({
      where: { moduleId_slug: { moduleId: leadsModule.id, slug: role.slug } },
      update: { permissions: role.permissions },
      create: {
        moduleId: leadsModule.id,
        name: role.name,
        slug: role.slug,
        permissions: role.permissions,
        isDefault: role.isDefault,
      },
    });
  }

  // Create default module roles for Marketing (for future use)
  const marketingRoles = [
    { name: 'Admin', slug: 'admin', permissions: ['*'], isDefault: false },
    {
      name: 'Marketing Manager',
      slug: 'marketing_manager',
      permissions: [
        'creatives.view', 'creatives.create', 'creatives.edit', 'creatives.delete',
        'ideas.view', 'ideas.create', 'ideas.approve',
        'scripts.generate', 'scripts.view',
        'publishing.schedule', 'publishing.publish',
        'campaigns.view', 'spend.view',
        'landing_pages.create', 'landing_pages.edit', 'landing_pages.view',
        'settings.view',
      ],
      isDefault: false,
    },
    {
      name: 'Media Buyer',
      slug: 'media_buyer',
      permissions: ['creatives.view', 'campaigns.view', 'spend.view', 'landing_pages.view'],
      isDefault: false,
    },
    {
      name: 'Content Creator',
      slug: 'content_creator',
      permissions: ['creatives.view', 'ideas.create', 'ideas.view'],
      isDefault: true,
    },
  ];

  for (const role of marketingRoles) {
    await prisma.moduleRole.upsert({
      where: { moduleId_slug: { moduleId: marketingModule.id, slug: role.slug } },
      update: { permissions: role.permissions },
      create: {
        moduleId: marketingModule.id,
        name: role.name,
        slug: role.slug,
        permissions: role.permissions,
        isDefault: role.isDefault,
      },
    });
  }

  // === Seed Marketing Projects ===
  const projects = [
    { name: 'Print In', slug: 'print-in', language: 'ar' },
    { name: 'Picked In', slug: 'picked-in', language: 'ar' },
    { name: 'Choroida', slug: 'choroida', language: 'ar' },
  ];

  for (const p of projects) {
    await prisma.mktProject.upsert({
      where: { slug: p.slug },
      update: {},
      create: p,
    });
  }

  // === Seed Tag Categories & Tags ===
  const tagCategories = [
    { name: 'Season', tags: ['Ramadan', 'Valentine\'s', 'Back to School', 'Mother\'s Day', 'National Day', 'Black Friday', 'Summer'] },
    { name: 'Content Type', tags: ['UGC', 'Product Shot', 'Lifestyle', 'Motion Graphics', 'Unboxing', 'Tutorial', 'Testimonial'] },
    { name: 'Platform', tags: ['Meta', 'TikTok', 'Snapchat', 'Google'] },
  ];

  for (const cat of tagCategories) {
    const category = await prisma.tagCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: { name: cat.name, isFixed: true },
    });

    for (const tagName of cat.tags) {
      await prisma.tag.upsert({
        where: { name_categoryId: { name: tagName, categoryId: category.id } },
        update: {},
        create: { name: tagName, categoryId: category.id },
      });
    }
  }

  // === Seed Creative Code Config ===
  const existingConfig = await prisma.creativeCodeConfig.findFirst();
  if (!existingConfig) {
    await prisma.creativeCodeConfig.create({
      data: {
        segments: [
          { name: 'Language', order: 1, values: [{ code: '1', label: 'Arabic' }, { code: '2', label: 'English' }] },
          { name: 'Project', order: 2, values: [{ code: '1', label: 'Print In' }, { code: '2', label: 'Picked In' }, { code: '3', label: 'Choroida' }] },
          { name: 'Product', order: 3, values: [{ code: '1', label: 'Dual Name' }, { code: '2', label: 'Slipperz' }, { code: '3', label: 'Decor Lamp' }] },
        ],
        separator: '-',
        seqDigits: 3,
      },
    });
  }

  console.log('Seeding complete!');
  console.log(`  - Leads module: ${leadsModule.id}`);
  console.log(`  - Marketing module: ${marketingModule.id}`);
  console.log(`  - Projects: ${projects.length}`);
  console.log(`  - Tag categories: ${tagCategories.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
