/**
 * دولفين - Dolphin
 * نظام إدارة الليدز والمبيعات
 * Backend API
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import reportsRoutes from './routes/reports';
import { authMiddleware, requirePermission, AuthRequest } from './middleware/auth';
import { Response, NextFunction } from 'express';

// يسمح بـ users.manage أو مدير السيلز (يديروا موظفيهم فقط)
function requireUsersAccess(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) { res.status(401).json({ error: 'غير مصرح' }); return; }
  const allowed =
    req.user.permissions.includes('*') ||
    req.user.permissions.includes('users.manage') ||
    req.user.roleSlug === 'sales_manager';
  if (!allowed) { res.status(403).json({ error: 'غير مسموح', message: 'ليس لديك صلاحية' }); return; }
  next();
}

const app = express();

// ===== Security Headers =====
app.use(helmet({ contentSecurityPolicy: false }));

// ===== CORS =====
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // السماح بطلبات بلا origin (Postman / server-to-server) أو في بيئة التطوير
      if (!origin || config.nodeEnv === 'development') {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: الأصل غير مسموح: ${origin}`));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Rate Limiting =====

// حد عام لكل الـ API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'طلبات كثيرة جداً، حاول بعد قليل' },
});

// حد أشد لتسجيل الدخول لمنع brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات تسجيل دخول كثيرة، حاول بعد 15 دقيقة' },
});

// حد للويب هوك لمنع إنشاء ليدز spam
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // دقيقة واحدة
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'طلبات ويب هوك كثيرة جداً' },
});

app.use('/api', generalLimiter);

// ===== Static Uploads =====
const uploadDir = path.resolve(config.upload.dir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// ===== Health Check =====
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', app: 'dolphin', version: '1.0.0' });
});

// ===== Routes =====
app.use('/api/auth', authLimiter, authRoutes);
// ويب هوك استقبال الليدز من ووردبريس (بدون مصادقة - الاعتماد على token في الرابط)
app.use('/api/webhooks', webhookLimiter, webhooksRoutes);
app.use('/api/lead-statuses', authMiddleware, leadStatusesRoutes);
app.use('/api/leads', authMiddleware, leadsRoutes);
app.use('/api/users', authMiddleware, requireUsersAccess, usersRoutes);
app.use('/api/products', authMiddleware, productsRoutes);
app.use('/api/orders', authMiddleware, ordersRoutes);
app.use('/api/customers', authMiddleware, customersRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/shifts', authMiddleware, shiftsRoutes);
app.use('/api/woocommerce', authMiddleware, woocommerceRoutes);
app.use('/api/form-connections', authMiddleware, formConnectionsRoutes);
app.use('/api/notifications', authMiddleware, notificationsRoutes);
app.use('/api/audit-logs', authMiddleware, auditLogsRoutes);
app.use('/api/reports', authMiddleware, requirePermission('reports.view'), reportsRoutes);

// ===== Frontend Static Files (Production) =====
if (process.env.NODE_ENV === 'production') {
  // استخدام process.cwd() أكثر موثوقية من __dirname على Render
  const frontendDist = path.join(process.cwd(), 'frontend', 'dist');
  console.log('[Frontend] cwd:', process.cwd());
  console.log('[Frontend] dist path:', frontendDist);
  console.log('[Frontend] exists:', fs.existsSync(frontendDist));
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    // SPA fallback — يرجع index.html لكل routes الـ React Router
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }
}

// ===== Global Error Handler =====
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Global Error]', err.message);
  if (err.message.startsWith('CORS:')) {
    res.status(403).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'خطأ داخلي في الخادم' });
});

app.listen(config.port, () => {
  console.log(`دولفين API يعمل على المنفذ ${config.port}`);
});
