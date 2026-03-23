import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../db';
import { config } from '../../../shared/config';
import { authMiddleware, type AuthRequest } from '../../../shared/middleware/auth';

const router = Router();

function getPermissions(
  role: { slug: string; rolePermissions?: { permission: { slug: string } }[] } | null,
  userPerms: { grant: boolean; permission: { slug: string } }[] = [],
) {
  if (!role) return []; // Pending users with no role → zero permissions
  if (role.slug === 'super_admin') return ['*'];
  const set = new Set((role.rolePermissions ?? []).map((rp) => rp.permission.slug));
  for (const up of userPerms) {
    if (up.grant) set.add(up.permission.slug);
    else set.delete(up.permission.slug);
  }
  return Array.from(set);
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'البريد وكلمة المرور مطلوبان' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
        userPermissions: { include: { permission: true } },
      },
    });
    if (!user) {
      res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
      return;
    }

    // Check account status (safe — uses optional chaining for pre-migration compat)
    const userStatus = (user as any).status as string | undefined;
    if (userStatus === 'pending') {
      res.status(403).json({ error: 'حسابك في انتظار موافقة المدير' });
      return;
    }
    if (userStatus === 'suspended' || !user.isActive) {
      res.status(403).json({ error: 'حسابك معطّل — تواصل مع الإدارة' });
      return;
    }

    // Check email verification (safe — field may not exist pre-migration)
    const emailVerified = (user as any).emailVerified as boolean | undefined;
    if (emailVerified === false) {
      res.status(403).json({ error: 'يرجى تأكيد الإيميل أولاً', needsVerification: true });
      return;
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );

    const permissions = getPermissions(user.role, user.userPermissions);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
          ? { id: user.role.id, name: user.role.name, slug: user.role.slug }
          : { id: '', name: 'Pending', slug: 'pending' },
        permissions,
      },
    });
  } catch (err: unknown) {
    console.error('Login error:', err);
    const isPrisma = err && typeof err === 'object' && 'code' in err;
    const code = isPrisma ? (err as { code?: string }).code : '';
    const msg =
      code === 'P1001' || code === 'P1002' || code === 'P1017'
        ? 'لا يمكن الاتصال بقاعدة البيانات. تحقق من DATABASE_URL وتأكد أن قاعدة البيانات تعمل.'
        : code === 'P2021' || code === 'P2010'
          ? 'جدول غير موجود في قاعدة البيانات. شغّل: npx prisma db push أو npx prisma migrate deploy'
          : 'خطأ في الخادم. راجع سجلات الـ Backend (الترمينال) لتفاصيل الخطأ.';
    res.status(500).json({ error: msg });
  }
});

/**
 * المستخدم الحالي + الصلاحيات
 * authMiddleware يضمن المستخدم نشط قبل الوصول لهذه النقطة
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // نجلب الاسم والدور فقط (authMiddleware يضمن أن الحساب نشط)
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!user) {
      res.status(404).json({ error: 'المستخدم غير موجود' });
      return;
    }
    res.json({
      user: {
        ...user,
        permissions: req.user!.permissions,
      },
    });
  } catch (err: unknown) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
