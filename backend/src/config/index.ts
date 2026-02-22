import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
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
};
