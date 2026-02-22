import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../db';

export interface AuthPayload {
  userId: string;
  email: string;
  permissions: string[];
  roleSlug: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'غير مصرح', message: 'مطلوب تسجيل الدخول' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string; email: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'غير مصرح', message: 'الحساب غير فعال' });
      return;
    }
    const roleSlug = user.role.slug;
    const permissions =
      roleSlug === 'super_admin'
        ? ['*']
        : (user.role.rolePermissions?.map((rp) => rp.permission.slug) ?? []);
    req.user = { userId: user.id, email: user.email, permissions, roleSlug };
    next();
  } catch {
    res.status(401).json({ error: 'غير مصرح', message: 'رمز الدخول غير صالح أو منتهي' });
  }
}

/** يتطلب صلاحية معيّنة (أو سوبر أدمن). استدعِ بعد authMiddleware */
export function requirePermission(slug: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'غير مصرح', message: 'مطلوب تسجيل الدخول' });
      return;
    }
    const has = req.user.permissions.includes('*') || req.user.permissions.includes(slug);
    if (!has) {
      res.status(403).json({ error: 'غير مسموح', message: 'ليس لديك صلاحية لهذا الإجراء' });
      return;
    }
    next();
  };
}
