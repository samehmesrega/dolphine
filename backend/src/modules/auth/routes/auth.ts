import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../../db';
import { config } from '../../../shared/config';
import { authMiddleware, type AuthRequest } from '../../../shared/middleware/auth';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../../shared/services/email';
import { OAuth2Client } from 'google-auth-library';

const router = Router();
const googleClient = new OAuth2Client(config.google.clientId);

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

// ===== REGISTRATION =====

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, recaptchaToken } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'الاسم والبريد وكلمة المرور مطلوبين' });
      return;
    }
    if (String(password).length < 8) {
      res.status(400).json({ error: 'كلمة المرور 8 أحرف على الأقل' });
      return;
    }

    // reCAPTCHA verification (if configured)
    if (config.recaptcha.secretKey && recaptchaToken) {
      const rcRes = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${config.recaptcha.secretKey}&response=${recaptchaToken}`);
      const rcData = await rcRes.json() as { success: boolean; score?: number };
      if (!rcData.success || (rcData.score !== undefined && rcData.score < 0.5)) {
        res.status(400).json({ error: 'فشل التحقق من reCAPTCHA — حاول مرة أخرى' });
        return;
      }
    }

    const emailNorm = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) {
      res.status(400).json({ error: 'البريد الإلكتروني مسجّل مسبقاً' });
      return;
    }

    // Find pending role
    const pendingRole = await prisma.role.findUnique({ where: { slug: 'pending' } });
    if (!pendingRole) {
      res.status(500).json({ error: 'خطأ في الإعداد — دور pending غير موجود. شغّل: npx prisma db seed' });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: emailNorm,
        passwordHash,
        phone: phone ? String(phone).trim() : null,
        roleId: pendingRole.id,
        status: 'pending',
        isActive: false,
        authMethod: 'email',
        emailVerified: false,
        verificationToken,
      },
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(emailNorm, user.name, verificationToken);
    console.log(`[Register] Verification email to ${emailNorm}: ${emailSent ? 'sent' : 'FAILED'}`);

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { isActive: true, role: { slug: { in: ['super_admin', 'admin'] } } },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: 'new_registration',
          title: 'طلب تسجيل جديد',
          body: `مستخدم جديد سجّل: ${user.name} (${user.email}) — في انتظار الموافقة`,
          link: '/settings/pending',
        })),
      });
    }

    res.status(201).json({ message: 'تم التسجيل بنجاح — تحقق من إيميلك لتأكيد الحساب' });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'خطأ في التسجيل' });
  }
});

// ===== GOOGLE OAUTH =====

router.post('/google', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      res.status(400).json({ error: 'Google credential مطلوب' });
      return;
    }
    if (!config.google.clientId) {
      res.status(500).json({ error: 'Google OAuth غير مُعد — أضف GOOGLE_CLIENT_ID' });
      return;
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.google.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).json({ error: 'Google token غير صالح' });
      return;
    }

    const { email, name, picture, sub: googleId } = payload;
    const emailNorm = email.toLowerCase();

    // Check if user exists by email
    let user = await prisma.user.findUnique({
      where: { email: emailNorm },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
        userPermissions: { include: { permission: true } },
      },
    });

    if (user) {
      // Existing user — link Google ID if not set
      if (!user.googleId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { googleId, avatarUrl: picture },
        });
      }

      // Check status
      if (user.status === 'pending') {
        res.status(403).json({ error: 'حسابك في انتظار موافقة المدير' });
        return;
      }
      if (user.status === 'suspended' || !user.isActive) {
        res.status(403).json({ error: 'حسابك معطّل — تواصل مع الإدارة' });
        return;
      }

      // Login — return JWT
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
          avatarUrl: user.avatarUrl || picture,
          role: user.role
            ? { id: user.role.id, name: user.role.name, slug: user.role.slug }
            : { id: '', name: 'Pending', slug: 'pending' },
          permissions,
        },
      });
    } else {
      // New user — create as pending
      const pendingRole = await prisma.role.findUnique({ where: { slug: 'pending' } });
      if (!pendingRole) {
        res.status(500).json({ error: 'خطأ في الإعداد — دور pending غير موجود' });
        return;
      }

      const newUser = await prisma.user.create({
        data: {
          name: name || emailNorm.split('@')[0],
          email: emailNorm,
          passwordHash: '', // No password for Google users
          roleId: pendingRole.id,
          status: 'pending',
          isActive: false,
          authMethod: 'google',
          emailVerified: true, // Google verified
          googleId,
          avatarUrl: picture,
        },
      });

      // Notify admins
      const admins = await prisma.user.findMany({
        where: { isActive: true, role: { slug: { in: ['super_admin', 'admin'] } } },
        select: { id: true },
      });
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            type: 'new_registration',
            title: 'طلب تسجيل جديد',
            body: `مستخدم جديد سجّل بـ Google: ${newUser.name} (${newUser.email}) — في انتظار الموافقة`,
            link: '/settings/pending',
          })),
        });
      }

      res.status(201).json({
        message: 'تم التسجيل بنجاح — حسابك في انتظار موافقة المدير',
        pending: true,
      });
    }
  } catch (err: any) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'خطأ في تسجيل الدخول بـ Google' });
  }
});

// ===== SLACK OAUTH =====

// GET /auth/slack — returns Slack OAuth URL
router.get('/slack', (_req: Request, res: Response) => {
  if (!config.slack.clientId) {
    res.status(500).json({ error: 'Slack OAuth غير مُعد — أضف SLACK_CLIENT_ID' });
    return;
  }
  const state = require('crypto').randomBytes(16).toString('hex');
  const url = `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId}&user_scope=identity.basic,identity.email,identity.avatar&redirect_uri=${encodeURIComponent(config.slack.redirectUri)}&state=${state}`;
  res.json({ url, state });
});

// POST /auth/slack/callback — exchange code for token + login/register
router.post('/slack/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Authorization code مطلوب' });
      return;
    }

    // Exchange code for access token
    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        code,
        redirect_uri: config.slack.redirectUri,
      }),
    });
    const tokenData = await tokenRes.json() as any;

    if (!tokenData.ok) {
      console.error('Slack token exchange failed:', tokenData.error);
      res.status(400).json({ error: `Slack OAuth فشل: ${tokenData.error}` });
      return;
    }

    // Get user identity
    const identityRes = await fetch('https://slack.com/api/users.identity', {
      headers: { Authorization: `Bearer ${tokenData.authed_user?.access_token}` },
    });
    const identity = await identityRes.json() as any;

    if (!identity.ok) {
      console.error('Slack identity failed:', identity.error);
      res.status(400).json({ error: 'فشل جلب بيانات المستخدم من Slack' });
      return;
    }

    const slackUser = identity.user;
    const slackTeam = identity.team;
    const email = (slackUser.email || '').toLowerCase();
    const name = slackUser.name || '';
    const avatar = slackUser.image_192 || slackUser.image_72 || '';
    const slackId = slackUser.id;
    const slackTeamId = slackTeam?.id || '';

    if (!email) {
      res.status(400).json({ error: 'الإيميل غير متوفر من Slack — تأكد من صلاحية identity.email' });
      return;
    }

    // Check if user exists by email or slackId
    let user = await prisma.user.findFirst({
      where: { OR: [{ email }, { slackId }] },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
        userPermissions: { include: { permission: true } },
      },
    });

    if (user) {
      // Link Slack ID if not set
      if (!user.slackId || !user.slackTeamId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { slackId, slackTeamId, avatarUrl: avatar || user.avatarUrl },
        });
      }

      if (user.status === 'pending') {
        res.status(403).json({ error: 'حسابك في انتظار موافقة المدير' });
        return;
      }
      if (user.status === 'suspended' || !user.isActive) {
        res.status(403).json({ error: 'حسابك معطّل — تواصل مع الإدارة' });
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
          avatarUrl: user.avatarUrl || avatar,
          role: user.role
            ? { id: user.role.id, name: user.role.name, slug: user.role.slug }
            : { id: '', name: 'Pending', slug: 'pending' },
          permissions,
        },
      });
    } else {
      // New user — create as pending
      const pendingRole = await prisma.role.findUnique({ where: { slug: 'pending' } });
      if (!pendingRole) {
        res.status(500).json({ error: 'خطأ في الإعداد — دور pending غير موجود' });
        return;
      }

      const newUser = await prisma.user.create({
        data: {
          name: name || email.split('@')[0],
          email,
          passwordHash: '',
          roleId: pendingRole.id,
          status: 'pending',
          isActive: false,
          authMethod: 'slack',
          emailVerified: true,
          slackId,
          slackTeamId,
          avatarUrl: avatar,
        },
      });

      const admins = await prisma.user.findMany({
        where: { isActive: true, role: { slug: { in: ['super_admin', 'admin'] } } },
        select: { id: true },
      });
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            type: 'new_registration',
            title: 'طلب تسجيل جديد',
            body: `مستخدم جديد سجّل بـ Slack: ${newUser.name} (${newUser.email}) — في انتظار الموافقة`,
            link: '/settings/pending',
          })),
        });
      }

      res.status(201).json({
        message: 'تم التسجيل بنجاح — حسابك في انتظار موافقة المدير',
        pending: true,
      });
    }
  } catch (err: any) {
    console.error('Slack auth error:', err);
    res.status(500).json({ error: 'خطأ في تسجيل الدخول بـ Slack' });
  }
});

// ===== EMAIL VERIFICATION =====

router.get('/verify-email/:token', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token);
    const user = await prisma.user.findFirst({ where: { verificationToken: token } });
    if (!user) {
      res.redirect(`${config.appUrl}/login?verify=invalid`);
      return;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null },
    });
    res.redirect(`${config.appUrl}/login?verify=success`);
  } catch (err) {
    console.error('Verify email error:', err);
    res.redirect(`${config.appUrl}/login?verify=error`);
  }
});

// ===== FORGOT PASSWORD =====

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email, recaptchaToken } = req.body;
    if (!email) {
      res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });
      return;
    }

    // reCAPTCHA verification
    if (config.recaptcha.secretKey && recaptchaToken) {
      const rcRes = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${config.recaptcha.secretKey}&response=${recaptchaToken}`);
      const rcData = await rcRes.json() as { success: boolean; score?: number };
      if (!rcData.success || (rcData.score !== undefined && rcData.score < 0.5)) {
        res.status(400).json({ error: 'فشل التحقق — حاول مرة أخرى' });
        return;
      }
    }

    // Always return same message (security)
    const successMsg = 'لو البريد مسجل عندنا، هتوصلك رسالة لاستعادة كلمة المرور';

    const user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (!user || user.authMethod !== 'email') {
      // Don't reveal if email exists or uses OAuth-only auth
      res.json({ message: successMsg });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    await sendPasswordResetEmail(user.email, user.name, resetToken);
    res.json({ message: successMsg });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'خطأ في إرسال رابط الاستعادة' });
  }
});

// ===== RESET PASSWORD =====

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: 'الرمز وكلمة المرور الجديدة مطلوبين' });
      return;
    }
    if (String(newPassword).length < 8) {
      res.status(400).json({ error: 'كلمة المرور 8 أحرف على الأقل' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: String(token),
        resetTokenExpiry: { gt: new Date() },
      },
    });
    if (!user) {
      res.status(400).json({ error: 'الرابط غير صالح أو منتهي الصلاحية' });
      return;
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    });

    res.json({ message: 'تم تغيير كلمة المرور بنجاح — يمكنك تسجيل الدخول الآن' });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'خطأ في إعادة تعيين كلمة المرور' });
  }
});

export default router;
