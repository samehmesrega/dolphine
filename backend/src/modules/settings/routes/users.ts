import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../../db';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { requirePermission } from '../../../shared/middleware/auth';
import { sendAccountApprovedEmail } from '../../../shared/services/email';

// Middleware: require users.manage permission for write operations
const requireManage = requirePermission('users.manage');

const router = Router();

const userSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  status: true,
  authMethod: true,
  emailVerified: true,
  avatarUrl: true,
  createdAt: true,
  role: { select: { id: true, name: true, slug: true } },
};

// Helper: get caller role
async function getCallerRole(req: AuthRequest) {
  const callerId = req.user?.userId;
  if (!callerId) return null;
  const caller = await prisma.user.findUnique({ where: { id: callerId }, include: { role: true } });
  return caller?.role ?? null;
}

// GET /settings/users — list users
router.get('/', async (req: AuthRequest, res: Response) => {
  const includeInactive = req.query.includeInactive === '1';
  const callerRole = await getCallerRole(req);

  let roleIdFilter: string | undefined;
  if (callerRole?.slug === 'sales_manager') {
    const salesRole = await prisma.role.findUnique({ where: { slug: 'sales' } });
    roleIdFilter = salesRole?.id;
  }

  const where: any = {
    ...(includeInactive ? {} : { isActive: true }),
    ...(roleIdFilter ? { roleId: roleIdFilter } : {}),
    status: { not: 'pending' }, // Don't show pending users here — they have their own page
  };

  const users = await prisma.user.findMany({ where, select: userSelect, orderBy: { name: 'asc' } });
  res.json({ users });
});

// GET /settings/users/pending — list pending registrations
router.get('/pending', async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { status: 'pending' },
      select: {
        ...userSelect,
        phone: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /settings/users/:id/approve — approve pending user
router.patch('/:id/approve', requireManage, async (req: AuthRequest, res: Response) => {
  try {
    const { roleId } = req.body;
    if (!roleId) {
      res.status(400).json({ error: 'يجب اختيار دور للمستخدم' });
      return;
    }
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      res.status(400).json({ error: 'الدور غير موجود' });
      return;
    }
    const user = await prisma.user.update({
      where: { id: String(req.params.id) },
      data: {
        status: 'active',
        isActive: true,
        roleId,
      },
      select: userSelect,
    });
    // Send approval email
    await sendAccountApprovedEmail(user.email, user.name);
    res.json({ user });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /settings/users/:id/reject — reject pending user
router.patch('/:id/reject', requireManage, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: String(req.params.id) },
      data: { status: 'suspended', isActive: false },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /settings/users/roles — list roles
router.get('/roles', async (_req: AuthRequest, res: Response) => {
  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: { rolePermissions: { include: { permission: true } } },
  });
  res.json({ roles });
});

// GET /settings/users/permissions — list all permissions
router.get('/permissions', async (_req: AuthRequest, res: Response) => {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { name: 'asc' }],
  });
  res.json({ permissions });
});

// PUT /settings/users/roles/:id/permissions — update role permissions
router.put('/roles/:id/permissions', requireManage, async (req: AuthRequest, res: Response) => {
  try {
    const roleId = String(req.params.id);
    const { permissionIds } = req.body as { permissionIds: string[] };
    if (!Array.isArray(permissionIds)) {
      res.status(400).json({ error: 'permissionIds يجب أن يكون مصفوفة' });
      return;
    }
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) { res.status(404).json({ error: 'الدور غير موجود' }); return; }
    if (role.slug === 'super_admin') {
      res.status(403).json({ error: 'لا يمكن تعديل صلاحيات المدير العام' });
      return;
    }
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      }),
    ]);
    const updatedRole = await prisma.role.findUnique({
      where: { id: roleId },
      include: { rolePermissions: { include: { permission: true } } },
    });
    res.json({ role: updatedRole });
  } catch (err) {
    console.error('Update role permissions error:', err);
    res.status(500).json({ error: 'خطأ في تحديث الصلاحيات' });
  }
});

const createUserSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  email: z.string().email('بريد غير صالح').transform((e) => e.trim().toLowerCase()),
  password: z.string().min(6, 'كلمة المرور 6 أحرف على الأقل'),
  roleId: z.string().uuid('الدور مطلوب'),
});

// POST /settings/users — create user (admin)
router.post('/', requireManage, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join('؛ ');
      res.status(400).json({ error: msg });
      return;
    }
    const { name, email, password, roleId } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: 'البريد الإلكتروني مستخدم مسبقاً' });
      return;
    }
    const callerRole = await getCallerRole(req);
    if (callerRole?.slug === 'sales_manager') {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (role?.slug !== 'sales') {
        res.status(403).json({ error: 'يمكنك إضافة موظفي سيلز فقط' });
        return;
      }
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        roleId,
        status: 'active',
        authMethod: 'email',
        emailVerified: true,
      },
      select: userSelect,
    });
    res.status(201).json({ user });
  } catch (err: unknown) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'خطأ في إنشاء المستخدم' });
  }
});

// GET /settings/users/me — current user profile
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json({ error: 'غير مصادق' }); return; }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ...userSelect, phone: true, whatsappNumber: true },
    });
    if (!user) { res.status(404).json({ error: 'المستخدم غير موجود' }); return; }
    res.json({ user });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'خطأ في تحميل الملف الشخصي' });
  }
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  whatsappNumber: z.string().optional().nullable(),
  password: z.string().min(6).optional(),
});

// PATCH /settings/users/me — update own profile
router.patch('/me', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json({ error: 'غير مصادق' }); return; }
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join('؛ ');
      res.status(400).json({ error: msg });
      return;
    }
    const updates: any = {};
    if (parsed.data.name != null) updates.name = parsed.data.name;
    if (parsed.data.whatsappNumber !== undefined) updates.whatsappNumber = parsed.data.whatsappNumber;
    if (parsed.data.password != null) updates.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: { ...userSelect, phone: true, whatsappNumber: true },
    });
    res.json({ user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'خطأ في تحديث الملف الشخصي' });
  }
});

// GET /settings/users/:id — single user
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: String(req.params.id) },
    select: userSelect,
  });
  if (!user) { res.status(404).json({ error: 'المستخدم غير موجود' }); return; }
  res.json({ user });
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().transform((e) => e.trim().toLowerCase()).optional(),
  password: z.string().min(6).optional(),
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

// PATCH /settings/users/:id — update user
router.patch('/:id', requireManage, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!existing) {
      res.status(404).json({ error: 'المستخدم غير موجود' });
      return;
    }
    const callerRole = await getCallerRole(req);
    if (callerRole?.slug === 'sales_manager' && existing.role?.slug !== 'sales') {
      res.status(403).json({ error: 'يمكنك تعديل موظفي سيلز فقط' });
      return;
    }
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((e) => e.message).join('؛ ') });
      return;
    }
    const updates: any = {};
    if (parsed.data.name != null) updates.name = parsed.data.name;
    if (parsed.data.email != null) {
      const other = await prisma.user.findFirst({ where: { email: parsed.data.email, id: { not: id } } });
      if (other) { res.status(400).json({ error: 'البريد الإلكتروني مستخدم لمستخدم آخر' }); return; }
      updates.email = parsed.data.email;
    }
    if (parsed.data.password != null) updates.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    if (parsed.data.roleId != null) {
      // Only super_admin can assign super_admin role
      const targetRole = await prisma.role.findUnique({ where: { id: parsed.data.roleId } });
      if (targetRole?.slug === 'super_admin') {
        const callerRole = await getCallerRole(req);
        if (callerRole?.slug !== 'super_admin') {
          res.status(403).json({ error: 'فقط المدير العام يمكنه تعيين دور المدير العام' });
          return;
        }
      }
      updates.roleId = parsed.data.roleId;
    }
    if (parsed.data.isActive != null) {
      updates.isActive = parsed.data.isActive;
      updates.status = parsed.data.isActive ? 'active' : 'suspended';
    }
    const user = await prisma.user.update({
      where: { id },
      data: updates,
      select: userSelect,
    });
    res.json({ user });
  } catch (err: unknown) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'خطأ في تحديث المستخدم' });
  }
});

export default router;
