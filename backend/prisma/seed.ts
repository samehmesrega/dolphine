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
      isActive: false, // will be enabled in Phase 2
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

  console.log('Seeding complete!');
  console.log(`  - Leads module: ${leadsModule.id}`);
  console.log(`  - Marketing module: ${marketingModule.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
