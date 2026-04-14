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
import blacklistRoutes from './blacklist';
import integrationSettingsRoutes from './integration-settings';
import whatsappMonitorRoutes from './whatsapp-monitor';

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
    req.user.permissions.includes('users.manage');
  if (!allowed) {
    res.status(403).json({ error: 'غير مسموح' });
    return;
  }
  next();
}

router.use('/lead-statuses', requirePermission('lead_statuses.manage'), leadStatusesRoutes);
router.use('/leads', requirePermission('leads.view'), leadsRoutes);
router.use('/users', requireUsersAccess, usersRoutes);
router.use('/products', requirePermission('products.view'), productsRoutes);
router.use('/orders', requirePermission('orders.view'), ordersRoutes);
router.use('/customers', requirePermission('customers.view'), customersRoutes);
router.use('/dashboard', requirePermission('dashboard.view'), dashboardRoutes);
router.use('/shifts', requirePermission('shifts.manage'), shiftsRoutes);
router.use('/woocommerce', requirePermission('integrations.manage'), woocommerceRoutes);
router.use('/form-connections', requirePermission('integrations.manage'), formConnectionsRoutes);
router.use('/sheet-connections', requirePermission('integrations.manage'), sheetConnectionsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/audit-logs', requirePermission('audit.view'), auditLogsRoutes);
router.use('/reports', requirePermission('reports.view'), reportsRoutes);
router.use('/tasks', tasksRoutes);
router.use('/task-rules', requirePermission('tasks.manage'), taskRulesRoutes);
router.use('/blacklist', requirePermission('blacklist.manage'), blacklistRoutes);
router.use('/integrations', requirePermission('integrations.manage'), integrationSettingsRoutes);
router.use('/whatsapp-monitor', requirePermission('leads.view'), whatsappMonitorRoutes);

export default router;
