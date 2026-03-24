import dotenv from 'dotenv';

dotenv.config();

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[SECURITY] JWT_SECRET غير مضبوط في بيئة الإنتاج!');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && !process.env.TOKEN_ENCRYPTION_KEY) {
  console.error('[SECURITY] TOKEN_ENCRYPTION_KEY غير مضبوط في بيئة الإنتاج! أنشئ واحد بـ: openssl rand -hex 32');
  process.exit(1);
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  leadsApiKey: process.env.LEADS_API_KEY,
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10),
  },
  woocommerce: {
    baseUrl: (process.env.WOOCOMMERCE_BASE_URL || '').replace(/\/$/, ''),
    consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY || '',
    consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || '',
  },
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  sentryDsn: process.env.SENTRY_DSN || '',
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || '',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  },
  appUrl: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:4000',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  recaptcha: {
    secretKey: process.env.RECAPTCHA_SECRET_KEY || '',
  },
};
