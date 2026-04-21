import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../../db';

export interface AuthPayload {
  userId: string;
  email: string;
  permissions: string[];
  roleSlug: string;
  modules: string[];
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
    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: string;
      email: string;
    };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } },
        },
        userPermissions: { include: { permission: true } },
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'غير مصرح', message: 'الحساب غير فعال' });
      return;
    }

    // Check status field (if it exists — safe for pre-migration)
    const userStatus = (user as any).status;
    if (userStatus === 'suspended') {
      res.status(401).json({ error: 'غير مصرح', message: 'حسابك معطّل' });
      return;
    }
    if (userStatus === 'pending') {
      res.status(403).json({ error: 'غير مصرح', message: 'حسابك في انتظار موافقة المدير' });
      return;
    }

    // Safe role access — handle null/missing role (e.g., pending users)
    const roleSlug = user.role?.slug ?? 'pending';
    let permissions: string[];
    let modules: string[];
    if ((roleSlug === 'super_admin' || user.isSuperAdmin) && user.role) {
      permissions = ['*'];
      const distinct = await prisma.permission.findMany({
        distinct: ['module'],
        select: { module: true },
      });
      modules = distinct.map((d) => d.module);
    } else if (user.role) {
      const effective = new Map<string, string>(); // slug → module
      for (const rp of user.role.rolePermissions ?? []) {
        effective.set(rp.permission.slug, rp.permission.module);
      }
      for (const up of user.userPermissions ?? []) {
        if (up.grant) effective.set(up.permission.slug, up.permission.module);
        else effective.delete(up.permission.slug);
      }
      permissions = Array.from(effective.keys());
      modules = Array.from(new Set(effective.values()));
    } else {
      permissions = [];
      modules = [];
    }

    req.user = {
      userId: user.id,
      email: user.email,
      permissions,
      roleSlug,
      modules,
    };
    next();
  } catch {
    res
      .status(401)
      .json({ error: 'غير مصرح', message: 'رمز الدخول غير صالح أو منتهي' });
  }
}

/** يتطلب صلاحية معيّنة (أو سوبر أدمن) */
export function requirePermission(slug: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'غير مصرح', message: 'مطلوب تسجيل الدخول' });
      return;
    }
    const has =
      req.user.permissions.includes('*') || req.user.permissions.includes(slug);
    if (!has) {
      res.status(403).json({
        error: 'غير مسموح',
        message: 'ليس لديك صلاحية لهذا الإجراء',
      });
      return;
    }
    next();
  };
}

/** يتطلب الوصول لموديول معيّن */
export function requireModule(moduleSlug: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'غير مصرح' });
      return;
    }
    if (
      req.user.permissions.includes('*') ||
      req.user.modules.includes(moduleSlug)
    ) {
      next();
      return;
    }
    res.status(403).json({
      error: 'غير مسموح',
      message: `ليس لديك صلاحية للوصول إلى ${moduleSlug}`,
    });
  };
}
