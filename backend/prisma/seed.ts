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
    {
      name: 'Accounts',
      slug: 'accounts',
      permissions: [
        'leads.view', 'orders.view', 'orders.edit',
        'customers.view', 'dashboard.view',
        'blacklist.manage',
      ],
      isDefault: false,
    },
    {
      name: 'Marketing',
      slug: 'marketing',
      permissions: [
        'leads.view', 'dashboard.view', 'reports.view',
      ],
      isDefault: false,
    },
    {
      name: 'Operations',
      slug: 'operations',
      permissions: [
        'leads.view', 'orders.view', 'orders.edit',
        'customers.view', 'dashboard.view',
        'shifts.manage', 'products.manage',
      ],
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

  // Create Inbox module
  const inboxModule = await prisma.module.upsert({
    where: { slug: 'inbox' },
    update: {},
    create: {
      name: 'صندوق الوارد',
      slug: 'inbox',
      icon: '📨',
      description: 'رسائل وتعليقات ميتا — ماسنجر وانستجرام',
      isActive: true,
      order: 3,
    },
  });

  // Create default module roles for Inbox
  const inboxRoles = [
    { name: 'Admin', slug: 'admin', permissions: ['*'], isDefault: false },
    {
      name: 'Inbox Manager',
      slug: 'inbox_manager',
      permissions: [
        'inbox.view', 'inbox.reply', 'inbox.manage', 'inbox.convert',
      ],
      isDefault: false,
    },
    {
      name: 'Inbox Agent',
      slug: 'inbox_agent',
      permissions: ['inbox.view', 'inbox.reply', 'inbox.convert'],
      isDefault: true,
    },
    {
      name: 'Viewer',
      slug: 'viewer',
      permissions: ['inbox.view'],
      isDefault: false,
    },
  ];

  for (const role of inboxRoles) {
    await prisma.moduleRole.upsert({
      where: { moduleId_slug: { moduleId: inboxModule.id, slug: role.slug } },
      update: { permissions: role.permissions },
      create: {
        moduleId: inboxModule.id,
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

  // === Seed Leads Permissions ===
  const leadsPermissions = [
    { name: 'عرض الليدز', slug: 'leads.view', module: 'leads', description: 'عرض قائمة الليدز والبحث فيها' },
    { name: 'إضافة ليد', slug: 'leads.create', module: 'leads', description: 'إنشاء ليدز جديدة يدوياً' },
    { name: 'تعديل ليد', slug: 'leads.edit', module: 'leads', description: 'تعديل بيانات الليد وحالته وتعيينه' },
    { name: 'حذف ليد', slug: 'leads.delete', module: 'leads', description: 'حذف الليدز من النظام' },
    { name: 'عرض الطلبات', slug: 'orders.view', module: 'leads', description: 'عرض قائمة الطلبات وتفاصيلها' },
    { name: 'إنشاء طلب', slug: 'orders.create', module: 'leads', description: 'إنشاء طلب جديد من ليد' },
    { name: 'تعديل طلب', slug: 'orders.edit', module: 'leads', description: 'تعديل بيانات الطلب وحالته' },
    { name: 'عرض العملاء', slug: 'customers.view', module: 'leads', description: 'عرض قائمة العملاء وبياناتهم' },
    { name: 'تعديل عميل', slug: 'customers.edit', module: 'leads', description: 'تعديل بيانات العميل' },
    { name: 'إدارة الشيفتات', slug: 'shifts.manage', module: 'leads', description: 'إنشاء وتعديل الشيفتات وأعضائها' },
    { name: 'عرض الداشبورد', slug: 'dashboard.view', module: 'leads', description: 'عرض داشبورد الإحصائيات والرسوم البيانية' },
    { name: 'عرض التقارير', slug: 'reports.view', module: 'leads', description: 'عرض تقارير الأداء والمبيعات والمصادر' },
    { name: 'سجل التدقيق', slug: 'audit.view', module: 'leads', description: 'عرض سجل التدقيق وتتبع التغييرات' },
    { name: 'إدارة المنتجات', slug: 'products.manage', module: 'leads', description: 'إضافة وتعديل وإخفاء المنتجات' },
    { name: 'إدارة المهام', slug: 'tasks.manage', module: 'leads', description: 'إنشاء وتعديل المهام وقواعد المهام' },
    { name: 'إدارة الأرقام المحظورة', slug: 'blacklist.manage', module: 'leads', description: 'إضافة وحذف أرقام من القائمة السوداء' },
    { name: 'إدارة التكامل', slug: 'integrations.manage', module: 'leads', description: 'إعدادات الربط مع الخدمات الخارجية' },
    { name: 'إدارة المستخدمين', slug: 'users.manage', module: 'leads', description: 'إضافة وتعديل المستخدمين وأدوارهم' },
    { name: 'Dual Name', slug: 'dual-name.access', module: 'dual-name', description: 'الوصول لمولد الأسماء المزدوجة ثلاثية الأبعاد' },
  ];

  for (const perm of leadsPermissions) {
    await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: { name: perm.name, description: perm.description, module: perm.module },
      create: perm,
    });
  }
  console.log(`  - Leads permissions: ${leadsPermissions.length}`);

  // Assign leads permissions to admin roles
  const adminRolesForLeads = await prisma.role.findMany({
    where: { slug: { in: ['super_admin', 'admin'] } },
  });
  for (const role of adminRolesForLeads) {
    for (const perm of leadsPermissions) {
      const permission = await prisma.permission.findUnique({ where: { slug: perm.slug } });
      if (permission) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }
    }
  }

  // Assign appropriate leads permissions to sales_manager
  const salesManagerRole = await prisma.role.findUnique({ where: { slug: 'sales_manager' } });
  if (salesManagerRole) {
    const smPerms = ['leads.view', 'leads.create', 'leads.edit', 'leads.delete', 'orders.view', 'orders.create', 'orders.edit',
      'customers.view', 'customers.edit', 'shifts.manage', 'dashboard.view', 'reports.view', 'products.manage', 'tasks.manage',
      'blacklist.manage', 'users.manage'];
    for (const slug of smPerms) {
      const permission = await prisma.permission.findUnique({ where: { slug } });
      if (permission) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: salesManagerRole.id, permissionId: permission.id } },
          update: {},
          create: { roleId: salesManagerRole.id, permissionId: permission.id },
        });
      }
    }
  }

  // === Seed Knowledge Base Permissions ===
  const kbPermissions = [
    { name: 'KB - View', slug: 'kb.view', module: 'knowledge-base', description: 'عرض بنك المعلومات' },
    { name: 'KB - Edit Products', slug: 'kb.product.edit', module: 'knowledge-base', description: 'إضافة وتعديل المنتجات' },
    { name: 'KB - Edit Media', slug: 'kb.media.edit', module: 'knowledge-base', description: 'إدارة الصور والفيديوهات' },
    { name: 'KB - Edit Manufacturing', slug: 'kb.manufacturing.edit', module: 'knowledge-base', description: 'تعديل بيانات التصنيع والتوريد' },
    { name: 'KB - Edit Pricing', slug: 'kb.pricing.edit', module: 'knowledge-base', description: 'تعديل الأسعار والفاريشنز' },
    { name: 'KB - Edit Marketing', slug: 'kb.marketing.edit', module: 'knowledge-base', description: 'تعديل بيانات التسويق' },
    { name: 'KB - Edit Sales', slug: 'kb.sales.edit', module: 'knowledge-base', description: 'تعديل FAQ والاعتراضات والسكربتات' },
    { name: 'KB - Edit After Sales', slug: 'kb.aftersales.edit', module: 'knowledge-base', description: 'تعديل بيانات ما بعد البيع' },
    { name: 'KB - Admin', slug: 'kb.admin', module: 'knowledge-base', description: 'صلاحيات كاملة على بنك المعلومات' },
  ];

  for (const perm of kbPermissions) {
    await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: {},
      create: perm,
    });
  }

  // Assign all KB permissions to super_admin role (if exists)
  const superAdminRole = await prisma.role.findUnique({ where: { slug: 'super_admin' } });
  if (superAdminRole) {
    for (const perm of kbPermissions) {
      const permission = await prisma.permission.findUnique({ where: { slug: perm.slug } });
      if (permission) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: permission.id } },
          update: {},
          create: { roleId: superAdminRole.id, permissionId: permission.id },
        });
      }
    }
  }

  // Also assign all KB permissions to any role with slug 'admin' or 'sales_manager'
  const adminRoles = await prisma.role.findMany({
    where: { slug: { in: ['admin', 'sales_manager'] } },
  });
  for (const role of adminRoles) {
    for (const perm of kbPermissions) {
      const permission = await prisma.permission.findUnique({ where: { slug: perm.slug } });
      if (permission) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }
    }
  }

  console.log(`  - KB permissions: ${kbPermissions.length}`);

  // === Seed Pending Role (for new registrations) ===
  await prisma.role.upsert({
    where: { slug: 'pending' },
    update: {},
    create: { name: 'Pending', slug: 'pending' },
  });
  console.log('  - Pending role: created');

  // === Seed Marketing Permissions ===
  const marketingPermissions = [
    { name: 'Marketing - View Creatives', slug: 'marketing.creatives.view', module: 'marketing', description: 'عرض الكريتيفز' },
    { name: 'Marketing - Manage Creatives', slug: 'marketing.creatives.manage', module: 'marketing', description: 'إدارة الكريتيفز' },
    { name: 'Marketing - View Requests', slug: 'marketing.requests.view', module: 'marketing', description: 'عرض طلبات التصميم' },
    { name: 'Marketing - Manage Requests', slug: 'marketing.requests.manage', module: 'marketing', description: 'إدارة طلبات التصميم' },
    { name: 'Marketing - View Ideas', slug: 'marketing.ideas.view', module: 'marketing', description: 'عرض بنك الأفكار' },
    { name: 'Marketing - Manage Ideas', slug: 'marketing.ideas.manage', module: 'marketing', description: 'إدارة بنك الأفكار' },
    { name: 'Marketing - View Publishing', slug: 'marketing.publishing.view', module: 'marketing', description: 'عرض النشر والجدولة' },
    { name: 'Marketing - Manage Publishing', slug: 'marketing.publishing.manage', module: 'marketing', description: 'إدارة النشر والجدولة' },
    { name: 'Marketing - View Media Buying', slug: 'marketing.media-buying.view', module: 'marketing', description: 'عرض الحملات الإعلانية' },
    { name: 'Marketing - Manage Media Buying', slug: 'marketing.media-buying.manage', module: 'marketing', description: 'إدارة الحملات الإعلانية' },
    { name: 'Marketing - View Landing Pages', slug: 'marketing.landing-pages.view', module: 'marketing', description: 'عرض صفحات الهبوط' },
    { name: 'Marketing - Manage Landing Pages', slug: 'marketing.landing-pages.manage', module: 'marketing', description: 'إدارة صفحات الهبوط' },
    { name: 'Marketing - View Settings', slug: 'marketing.settings.view', module: 'marketing', description: 'عرض إعدادات التسويق' },
    { name: 'Marketing - Manage Settings', slug: 'marketing.settings.manage', module: 'marketing', description: 'إدارة إعدادات التسويق' },
  ];

  for (const perm of marketingPermissions) {
    await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: {},
      create: perm,
    });
  }
  console.log(`  - Marketing permissions: ${marketingPermissions.length}`);

  // === Seed Inbox Permissions ===
  const inboxPermissions = [
    { name: 'Inbox - View', slug: 'inbox.view', module: 'inbox', description: 'عرض المحادثات والتعليقات' },
    { name: 'Inbox - Reply', slug: 'inbox.reply', module: 'inbox', description: 'إرسال رسائل والرد على تعليقات' },
    { name: 'Inbox - Manage', slug: 'inbox.manage', module: 'inbox', description: 'إدارة القنوات وتعيين المحادثات' },
    { name: 'Inbox - Convert', slug: 'inbox.convert', module: 'inbox', description: 'تحويل محادثة لليد أو طلب' },
  ];

  for (const perm of inboxPermissions) {
    await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: {},
      create: perm,
    });
  }
  console.log(`  - Inbox permissions: ${inboxPermissions.length}`);

  // === Seed Settings Permissions ===
  const settingsPermissions = [
    { name: 'Settings - View Users', slug: 'settings.users.view', module: 'settings', description: 'عرض المستخدمين' },
    { name: 'Settings - Manage Users', slug: 'settings.users.manage', module: 'settings', description: 'إدارة المستخدمين' },
    { name: 'Settings - Manage Roles', slug: 'settings.roles.manage', module: 'settings', description: 'إدارة الأدوار والصلاحيات' },
  ];

  for (const perm of settingsPermissions) {
    await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: {},
      create: perm,
    });
  }
  console.log(`  - Settings permissions: ${settingsPermissions.length}`);

  // Assign marketing + settings permissions to admin roles
  const allNewPerms = [...marketingPermissions, ...settingsPermissions, ...inboxPermissions];
  const adminRolesForNewPerms = await prisma.role.findMany({
    where: { slug: { in: ['super_admin', 'admin'] } },
  });
  for (const role of adminRolesForNewPerms) {
    for (const perm of allNewPerms) {
      const permission = await prisma.permission.findUnique({ where: { slug: perm.slug } });
      if (permission) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }
    }
  }

  // === Seed Brands (mkt_brands) ===
  const brands = [
    { name: 'Print In', slug: 'print-in', language: 'ar' },
    { name: 'Picked In', slug: 'picked-in', language: 'en' },
    { name: 'Choroida', slug: 'choroida', language: 'en' },
  ];

  for (const b of brands) {
    await prisma.brand.upsert({
      where: { slug: b.slug },
      update: {},
      create: b,
    });
  }
  console.log(`  - Brands: ${brands.length}`);

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
  console.log(`  - Inbox module: ${inboxModule.id}`);
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
