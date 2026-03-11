import { Router } from 'express';
import { requirePermission } from '../../../shared/middleware/auth';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';

import leadsRoutes from './leads';
import leadStatusesRoutes from './lead-statuses';
import usersRoutes from './users';
import productsRoutes from './products';
import ordersRoutes from './orders';
import customersRoutes from './customers';
import dashboardRoutes from './dashboard';
import shiftsRoutes from './shifts';
import woocommerceRoutes from './woocommerce';
import formConnectionsRoutes from './form-connections';
import sheetConnectionsRoutes from './sheet-connections';
import webhooksRoutes from './webhooks';
import notificationsRoutes from './notifications';
import auditLogsRoutes from './audit-logs';
import reportsRoutes from './reports';
import tasksRoutes from './tasks';
import taskRulesRoutes from './task-rules';

const router = Router();

// يسمح بـ users.manage أو مدير السيلز
function requireUsersAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'غير مصرح' });
    return;
  }
  const allowed =
    req.user.permissions.includes('*') ||
    req.user.permissions.includes('users.manage') ||
    req.user.roleSlug === 'sales_manager';
  if (!allowed) {
    res.status(403).json({ error: 'غير مسموح' });
    return;
  }
  next();
}

router.use('/lead-statuses', leadStatusesRoutes);
router.use('/leads', leadsRoutes);
router.use('/users', requireUsersAccess, usersRoutes);
router.use('/products', productsRoutes);
router.use('/orders', ordersRoutes);
router.use('/customers', customersRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/shifts', shiftsRoutes);
router.use('/woocommerce', woocommerceRoutes);
router.use('/form-connections', formConnectionsRoutes);
router.use(
  '/sheet-connections',
  requirePermission('integrations.manage'),
  sheetConnectionsRoutes
);
router.use('/notifications', notificationsRoutes);
router.use('/audit-logs', auditLogsRoutes);
router.use('/reports', requirePermission('reports.view'), reportsRoutes);
router.use('/tasks', tasksRoutes);
router.use('/task-rules', taskRulesRoutes);

export default router;
