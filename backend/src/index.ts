/**
 * Dolphin Platform - Unified Backend API
 * Modules: Auth, Leads (formerly Dolphin), Marketing (future)
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import path from 'path';
import fs from 'fs';

import { config } from './shared/config';
import { logger } from './shared/config/logger';
import { globalErrorHandler } from './shared/middleware/error-handler';
import { authMiddleware, requirePermission, requireModule } from './shared/middleware/auth';
import type { AuthRequest } from './shared/middleware/auth';
import type { Response as ExpressResponse, NextFunction } from 'express';

// Module routes
import authRoutes from './modules/auth/routes';
import leadsRoutes from './modules/leads/routes';
import marketingRoutes from './modules/marketing/routes';

// يسمح بـ users.manage أو مدير السيلز
function requireUsersAccess(
  req: AuthRequest,
  res: ExpressResponse,
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

const app = express();

// ===== Structured Logging =====
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
  })
);

// ===== Security Headers =====
app.use(helmet({ contentSecurityPolicy: false }));

// ===== CORS =====
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.nodeEnv === 'development') {
        callback(null, true);
        return;
      }
      if (config.allowedOrigins.includes(origin)) {
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
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'طلبات كثيرة جداً، حاول بعد قليل' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات تسجيل دخول كثيرة، حاول بعد 15 دقيقة' },
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
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
  res.json({
    status: 'ok',
    app: 'dolphin-platform',
    version: '2.0.0',
    modules: ['auth', 'leads', 'marketing'],
  });
});

// ===== API Routes (versioned) =====

// Auth module
app.use('/api/v1/auth', authLimiter, authRoutes);

// Leads module (backwards compatible: /api/v1/leads/*)
app.use('/api/v1/leads', authMiddleware, leadsRoutes);

// Marketing module
app.use('/api/v1/marketing', authMiddleware, marketingRoutes);
app.use('/api/marketing', authMiddleware, marketingRoutes);

// Landing Pages (public routes — no auth)
app.use('/lp', require('./modules/marketing/routes/lp-public').default);

// Webhooks (public, rate-limited)
// Keeping old path for backwards compatibility with WordPress plugins
app.use('/api/webhooks', webhookLimiter, require('./modules/leads/routes/webhooks').default);

// === Backwards compatibility: /api/* routes redirect to /api/v1/* ===
// This ensures the existing frontend works while we migrate
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/lead-statuses', authMiddleware, require('./modules/leads/routes/lead-statuses').default);
app.use('/api/leads', authMiddleware, require('./modules/leads/routes/leads').default);
app.use('/api/users', authMiddleware, requireUsersAccess, require('./modules/leads/routes/users').default);
app.use('/api/products', authMiddleware, require('./modules/leads/routes/products').default);
app.use('/api/orders', authMiddleware, require('./modules/leads/routes/orders').default);
app.use('/api/customers', authMiddleware, require('./modules/leads/routes/customers').default);
app.use('/api/dashboard', authMiddleware, require('./modules/leads/routes/dashboard').default);
app.use('/api/shifts', authMiddleware, require('./modules/leads/routes/shifts').default);
app.use('/api/woocommerce', authMiddleware, require('./modules/leads/routes/woocommerce').default);
app.use('/api/form-connections', authMiddleware, require('./modules/leads/routes/form-connections').default);
app.use('/api/sheet-connections', authMiddleware, requirePermission('integrations.manage'), require('./modules/leads/routes/sheet-connections').default);
app.use('/api/notifications', authMiddleware, require('./modules/leads/routes/notifications').default);
app.use('/api/audit-logs', authMiddleware, require('./modules/leads/routes/audit-logs').default);
app.use('/api/reports', authMiddleware, requirePermission('reports.view'), require('./modules/leads/routes/reports').default);
app.use('/api/tasks', authMiddleware, require('./modules/leads/routes/tasks').default);
app.use('/api/task-rules', authMiddleware, require('./modules/leads/routes/task-rules').default);

// ===== Frontend Static Files (Production) =====
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(process.cwd(), 'frontend', 'dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }
}

// ===== Global Error Handler =====
app.use(globalErrorHandler);

app.listen(config.port, () => {
  logger.info(`Dolphin Platform API running on port ${config.port}`);
});
