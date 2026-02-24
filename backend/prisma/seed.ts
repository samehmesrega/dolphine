/**
 * دولفين - البيانات الأولية
 * أدوار افتراضية + مستخدم سوبر أدمن
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const roles = [
    { name: 'سوبر أدمن', slug: 'super_admin' },
    { name: 'أدمن', slug: 'admin' },
    { name: 'مدير فريق السيلز', slug: 'sales_manager' },
    { name: 'موظف سيلز', slug: 'sales' },
    { name: 'موظف حسابات', slug: 'accounts' },
    { name: 'مسئول أوبريشنز', slug: 'operations' },
    { name: 'عضو فريق ماركتينج', slug: 'marketing' },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { slug: r.slug },
      update: { name: r.name },
      create: r,
    });
  }

  // الصلاحيات
  const permissions = [
    { name: 'عرض الداشبورد', slug: 'dashboard.view', module: 'dashboard' },
    { name: 'عرض الليدز', slug: 'leads.view', module: 'leads' },
    { name: 'إدارة الليدز', slug: 'leads.manage', module: 'leads' },
    { name: 'عرض الطلبات', slug: 'orders.view', module: 'orders' },
    { name: 'إدارة الطلبات', slug: 'orders.manage', module: 'orders' },
    { name: 'عرض العملاء', slug: 'customers.view', module: 'customers' },
    { name: 'عرض المنتجات', slug: 'products.view', module: 'products' },
    { name: 'إدارة المنتجات', slug: 'products.manage', module: 'products' },
    { name: 'إدارة المستخدمين', slug: 'users.manage', module: 'users' },
    { name: 'إدارة الشيفتات', slug: 'shifts.manage', module: 'shifts' },
    { name: 'الربط والتكامل', slug: 'integrations.manage', module: 'integrations' },
    { name: 'التقارير', slug: 'reports.view', module: 'reports' },
    { name: 'سجل التدقيق', slug: 'audit.view', module: 'audit' },
  ];
  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { slug: p.slug },
      update: { name: p.name, module: p.module },
      create: p,
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const superAdminRole = await prisma.role.findUnique({
    where: { slug: 'super_admin' },
  });
  if (!superAdminRole) throw new Error('Role not found');

  // ربط الصلاحيات بالأدوار: سوبر أدمن وأدمن = كل الصلاحيات
  for (const roleSlug of ['super_admin', 'admin']) {
    const role = await prisma.role.findUnique({ where: { slug: roleSlug } });
    if (role) {
      for (const perm of allPermissions) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
  }
  // مدير السيلز وموظف سيلز: داشبورد، ليدز، طلبات، عملاء، تقارير
  for (const roleSlug of ['sales_manager', 'sales']) {
    const role = await prisma.role.findUnique({ where: { slug: roleSlug } });
    if (role) {
      const slugs = ['dashboard.view', 'leads.view', 'leads.manage', 'orders.view', 'orders.manage', 'customers.view', 'reports.view'];
      for (const slug of slugs) {
        const perm = await prisma.permission.findUnique({ where: { slug } });
        if (perm) {
          await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
            update: {},
            create: { roleId: role.id, permissionId: perm.id },
          });
        }
      }
    }
  }
  // حسابات: داشبورد، طلبات، تقارير
  const accountsRole = await prisma.role.findUnique({ where: { slug: 'accounts' } });
  if (accountsRole) {
    const slugs = ['dashboard.view', 'orders.view', 'orders.manage', 'reports.view'];
    for (const slug of slugs) {
      const perm = await prisma.permission.findUnique({ where: { slug } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: accountsRole.id, permissionId: perm.id } },
          update: {},
          create: { roleId: accountsRole.id, permissionId: perm.id },
        });
      }
    }
  }
  // أوبريشنز: داشبورد، منتجات، شيفتات، ربْط
  const opsRole = await prisma.role.findUnique({ where: { slug: 'operations' } });
  if (opsRole) {
    const slugs = ['dashboard.view', 'products.view', 'products.manage', 'shifts.manage', 'integrations.manage'];
    for (const slug of slugs) {
      const perm = await prisma.permission.findUnique({ where: { slug } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: opsRole.id, permissionId: perm.id } },
          update: {},
          create: { roleId: opsRole.id, permissionId: perm.id },
        });
      }
    }
  }

  // ماركتينج: داشبورد، ليدز (عرض فقط)
  const marketingRole = await prisma.role.findUnique({ where: { slug: 'marketing' } });
  if (marketingRole) {
    const slugs = ['dashboard.view', 'leads.view'];
    for (const slug of slugs) {
      const perm = await prisma.permission.findUnique({ where: { slug } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: marketingRole.id, permissionId: perm.id } },
          update: {},
          create: { roleId: marketingRole.id, permissionId: perm.id },
        });
      }
    }
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@dolphin.local' },
  });

  if (!existingAdmin) {
    const hash = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        email: 'admin@dolphin.local',
        passwordHash: hash,
        name: 'مدير النظام',
        roleId: superAdminRole.id,
      },
    });
    console.log('تم إنشاء المستخدم: admin@dolphin.local / admin123');
  }

  const leadStatuses = [
    { name: 'جديد', slug: 'new', orderNum: 1 },
    { name: 'تحت المتابعة', slug: 'in_progress', orderNum: 2 },
    { name: 'تم الاتصال', slug: 'contacted', orderNum: 3 },
    { name: 'عرض سعر مُرسل', slug: 'quoted', orderNum: 4 },
    { name: 'طلب مؤكد', slug: 'confirmed', orderNum: 5 },
    { name: 'مرفوض', slug: 'rejected', orderNum: 6 },
    { name: 'غير قابل للتواصل', slug: 'unreachable', orderNum: 7 },
  ];

  for (const s of leadStatuses) {
    await prisma.leadStatus.upsert({
      where: { slug: s.slug },
      update: { name: s.name, orderNum: s.orderNum },
      create: s,
    });
  }

  console.log('تم تنفيذ Seed بنجاح');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
