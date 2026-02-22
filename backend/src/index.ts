/**
 * دولفين - Dolphin
 * نظام إدارة الليدز والمبيعات
 * Backend API
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import { config } from './config';
import authRoutes from './routes/auth';
import leadsRoutes from './routes/leads';
import leadStatusesRoutes from './routes/lead-statuses';
import usersRoutes from './routes/users';
import productsRoutes from './routes/products';
import ordersRoutes from './routes/orders';
import customersRoutes from './routes/customers';
import dashboardRoutes from './routes/dashboard';
import shiftsRoutes from './routes/shifts';
import woocommerceRoutes from './routes/woocommerce';
import formConnectionsRoutes from './routes/form-connections';
import webhooksRoutes from './routes/webhooks';
import notificationsRoutes from './routes/notifications';
import auditLogsRoutes from './routes/audit-logs';
import { authMiddleware, requirePermission } from './middleware/auth';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.resolve(config.upload.dir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

app.get('/health', (_, res) => {
  res.json({ status: 'ok', app: 'dolphin', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
// ويب هوك استقبال الليدز من ووردبريس (بدون مصادقة)
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/lead-statuses', authMiddleware, leadStatusesRoutes);
app.use('/api/leads', authMiddleware, leadsRoutes);
app.use('/api/users', authMiddleware, requirePermission('users.manage'), usersRoutes);
app.use('/api/products', authMiddleware, productsRoutes);
app.use('/api/orders', authMiddleware, ordersRoutes);
app.use('/api/customers', authMiddleware, customersRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/shifts', authMiddleware, shiftsRoutes);
app.use('/api/woocommerce', authMiddleware, woocommerceRoutes);
app.use('/api/form-connections', authMiddleware, formConnectionsRoutes);
app.use('/api/notifications', authMiddleware, notificationsRoutes);
app.use('/api/audit-logs', authMiddleware, auditLogsRoutes);

app.listen(config.port, () => {
  console.log(`دولفين API يعمل على المنفذ ${config.port}`);
});
