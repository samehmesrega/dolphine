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
import knowledgeBaseRoutes from './modules/knowledge-base/routes';
import settingsRoutes from './modules/settings/routes';
import ticketsRoutes from './modules/tickets/routes';

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

// Trust proxy (Render uses reverse proxy — fixes rate limiter X-Forwarded-For warning)
app.set('trust proxy', 1);

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
      // Allow requests without origin (server-to-server, Postman, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }
      // Development: allow localhost
      if (config.nodeEnv === 'development' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        callback(null, true);
        return;
      }
      // Production: check allowed origins
      if (config.allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: الأصل غير مسموح: ${origin}`));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Knowledge Base module
app.use('/api/v1/knowledge-base', authMiddleware, knowledgeBaseRoutes);
app.use('/api/knowledge-base', authMiddleware, knowledgeBaseRoutes);

// Settings module
app.use('/api/v1/settings', authMiddleware, settingsRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);

// Tickets module
app.use('/api/v1/tickets', authMiddleware, ticketsRoutes);
app.use('/api/tickets', authMiddleware, ticketsRoutes);

// Drive image proxy — validate fileId format to prevent SSRF
app.get('/drive-proxy/:fileId', async (req: Request, res: Response) => {
  try {
    const fileId = String(req.params.fileId);
    // Only allow valid Google Drive file IDs (alphanumeric, hyphens, underscores)
    if (!fileId || !/^[a-zA-Z0-9_-]{10,80}$/.test(fileId)) {
      return res.status(400).send('Invalid file ID');
    }
    const rawSize = Array.isArray(req.query.s) ? req.query.s[0] : req.query.s;
    const size = String(rawSize || '1600').replace(/\D/g, '') || '1600';
    const url = `https://lh3.googleusercontent.com/d/${fileId}=s${size}`;
    const response = await fetch(url);
    if (!response.ok) return res.status(404).send('Not found');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    // Only proxy image content types
    if (!contentType.startsWith('image/')) {
      return res.status(400).send('Not an image');
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch {
    res.status(500).send('Proxy error');
  }
});

// Landing page form submission rate limiter (5 req/min per IP)
const lpSubmitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'طلبات كثيرة جداً، حاول بعد دقيقة' },
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
  skip: (req) => req.method === 'GET', // only limit POST submissions
});

// Landing Pages (public routes — no auth)
app.use('/lp', lpSubmitLimiter, require('./modules/marketing/routes/lp-public').default);

// Webhooks (public, rate-limited)
// Keeping old path for backwards compatibility with WordPress plugins
app.use('/api/webhooks', webhookLimiter, require('./modules/leads/routes/webhooks').default);
app.use('/api/webhooks/bosta', webhookLimiter, require('./modules/leads/routes/bosta-webhook').default);

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
app.use('/api/bosta', authMiddleware, require('./modules/leads/routes/bosta').default);
app.use('/api/form-connections', authMiddleware, require('./modules/leads/routes/form-connections').default);
app.use('/api/sheet-connections', authMiddleware, requirePermission('integrations.manage'), require('./modules/leads/routes/sheet-connections').default);
app.use('/api/notifications', authMiddleware, require('./modules/leads/routes/notifications').default);
app.use('/api/audit-logs', authMiddleware, require('./modules/leads/routes/audit-logs').default);
app.use('/api/reports', authMiddleware, requirePermission('reports.view'), require('./modules/leads/routes/reports').default);
app.use('/api/tasks', authMiddleware, require('./modules/leads/routes/tasks').default);
app.use('/api/task-rules', authMiddleware, require('./modules/leads/routes/task-rules').default);
app.use('/api/blacklist', authMiddleware, require('./modules/leads/routes/blacklist').default);
app.use('/api/integrations', authMiddleware, require('./modules/leads/routes/integration-settings').default);

// ===== Dual Name Static Files =====
const dualNameDist = path.join(process.cwd(), 'dual-name', 'dist');
if (fs.existsSync(dualNameDist)) {
  app.use('/dual-name', express.static(dualNameDist));
  app.get('/dual-name/*', (_req: Request, res: Response) => {
    res.sendFile(path.join(dualNameDist, 'index.html'));
  });
}

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

  // Start Meta Ads auto-sync (every 2 hours)
  import('./modules/marketing/services/meta-ads.service').then((metaService) => {
    metaService.startAutoSyncScheduler(2);
  }).catch((err) => {
    logger.warn(`[AutoSync] Failed to start scheduler: ${err.message}`);
  });
});
