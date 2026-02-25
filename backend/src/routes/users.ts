import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db';
import type { AuthRequest } from '../middleware/auth';
import { auditLog } from '../services/audit';

const router = Router();

const userSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  role: { select: { id: true, name: true, slug: true } },
};

// قائمة المستخدمين (اختياري: تضمين المعطّلين)
router.get('/', async (req: AuthRequest, res: Response) => {
  const includeInactive = req.query.includeInactive === '1';
  const users = await prisma.user.findMany({
    where: includeInactive ? undefined : { isActive: true },
    select: userSelect,
    orderBy: { name: 'asc' },
  });
  res.json({ users });
});

// قائمة الأدوار مع الصلاحيات
router.get('/roles', async (_req: AuthRequest, res: Response) => {
  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: { rolePermissions: { include: { permission: true } } },
  });
  res.json({ roles });
});

// قائمة كل الصلاحيات المتاحة
router.get('/permissions', async (_req: AuthRequest, res: Response) => {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { name: 'asc' }],
  });
  res.json({ permissions });
});

// تحديث صلاحيات دور معين
router.put('/roles/:id/permissions', async (req: AuthRequest, res: Response) => {
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

// إنشاء مستخدم
router.post('/', async (req: AuthRequest, res: Response) => {
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
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      res.status(400).json({ error: 'الدور غير موجود' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, roleId },
      select: userSelect,
    });
    await auditLog(prisma, {
      userId: req.user?.userId ?? null,
      action: 'create',
      entity: 'user',
      entityId: user.id,
      newData: { name: user.name, email: user.email, roleId: user.role.id },
    });
    res.status(201).json({ user });
  } catch (err: unknown) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'خطأ في إنشاء المستخدم' });
  }
});

// GET /api/users/me - الملف الشخصي للمستخدم الحالي
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json({ error: 'غير مصادق' }); return; }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, isActive: true, whatsappNumber: true, role: { select: { id: true, name: true, slug: true } } },
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

// PATCH /api/users/me - تحديث الملف الشخصي
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
    const updates: { name?: string; whatsappNumber?: string | null; passwordHash?: string } = {};
    if (parsed.data.name != null) updates.name = parsed.data.name;
    if (parsed.data.whatsappNumber !== undefined) updates.whatsappNumber = parsed.data.whatsappNumber;
    if (parsed.data.password != null) updates.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: { id: true, name: true, email: true, isActive: true, whatsappNumber: true, role: { select: { id: true, name: true, slug: true } } },
    });
    res.json({ user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'خطأ في تحديث الملف الشخصي' });
  }
});

// مستخدم واحد (للتعديل)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const user = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });
  if (!user) {
    res.status(404).json({ error: 'المستخدم غير موجود' });
    return;
  }
  res.json({ user });
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().transform((e) => e.trim().toLowerCase()).optional(),
  password: z.string().min(6).optional(),
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

// تحديث مستخدم (تعديل / تعطيل)
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'المستخدم غير موجود' });
      return;
    }
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = (parsed.error as { issues: { message?: string }[] }).issues.map((e: { message?: string }) => e.message ?? '').join('؛ ');
      res.status(400).json({ error: msg });
      return;
    }
    const updates: { name?: string; email?: string; passwordHash?: string; roleId?: string; isActive?: boolean } = {};
    if (parsed.data.name != null) updates.name = parsed.data.name;
    if (parsed.data.email != null) {
      const other = await prisma.user.findFirst({ where: { email: parsed.data.email, id: { not: id } } });
      if (other) {
        res.status(400).json({ error: 'البريد الإلكتروني مستخدم لمستخدم آخر' });
        return;
      }
      updates.email = parsed.data.email;
    }
    if (parsed.data.password != null) updates.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    if (parsed.data.roleId != null) {
      const role = await prisma.role.findUnique({ where: { id: parsed.data.roleId } });
      if (!role) {
        res.status(400).json({ error: 'الدور غير موجود' });
        return;
      }
      updates.roleId = parsed.data.roleId;
    }
    if (parsed.data.isActive != null) updates.isActive = parsed.data.isActive;

    const user = await prisma.user.update({
      where: { id },
      data: updates,
      select: userSelect,
    });
    await auditLog(prisma, {
      userId: req.user?.userId ?? null,
      action: 'update',
      entity: 'user',
      entityId: id,
      oldData: { name: existing.name, email: existing.email, isActive: existing.isActive, roleId: existing.roleId },
      newData: { name: user.name, email: user.email, isActive: user.isActive, roleId: user.role.id },
    });
    res.json({ user });
  } catch (err: unknown) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'خطأ في تحديث المستخدم' });
  }
});

export default router;
