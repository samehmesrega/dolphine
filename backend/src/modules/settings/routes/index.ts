import { Router } from 'express';
import { requirePermission } from '../../../shared/middleware/auth';
import usersRouter from './users';

const router = Router();

// All settings routes require users.manage OR settings.users.manage
function requireSettingsAccess(req: any, res: any, next: any) {
  if (!req.user) {
    res.status(401).json({ error: 'غير مصرح' });
    return;
  }
  const allowed =
    req.user.permissions.includes('*') ||
    req.user.permissions.includes('users.manage') ||
    req.user.permissions.includes('settings.users.manage') ||
    req.user.permissions.includes('settings.users.view') ||
    req.user.roleSlug === 'sales_manager';
  if (!allowed) {
    res.status(403).json({ error: 'غير مسموح' });
    return;
  }
  next();
}

router.use('/users', requireSettingsAccess, usersRouter);

export default router;
