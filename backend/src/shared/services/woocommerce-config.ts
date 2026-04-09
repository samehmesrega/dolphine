/**
 * WooCommerce config retrieval — shared integration utility.
 * Returns decrypted credentials for SERVER-SIDE use ONLY.
 * NEVER include return values in API responses or log output.
 */

import { prisma } from '../../db';
import { config } from '../config';
import { decryptToken } from '../utils/token-encryption';
import { logger } from '../config/logger';

const ENV_KEYS = {
  baseUrl: (config.woocommerce.baseUrl || '').replace(/\/$/, ''),
  consumerKey: config.woocommerce.consumerKey || '',
  consumerSecret: config.woocommerce.consumerSecret || '',
};

const DB_KEYS = {
  baseUrl: 'woocommerce_base_url',
  consumerKey: 'woocommerce_consumer_key',
  consumerSecret: 'woocommerce_consumer_secret',
} as const;

export type WooCommerceConfig = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
};

async function getFromDb(): Promise<WooCommerceConfig | null> {
  const rows = await prisma.integrationSetting.findMany({
    where: { key: { in: [DB_KEYS.baseUrl, DB_KEYS.consumerKey, DB_KEYS.consumerSecret] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const baseUrl = (map.get(DB_KEYS.baseUrl) || '').replace(/\/$/, '');
  const rawKey = map.get(DB_KEYS.consumerKey) || '';
  const rawSecret = map.get(DB_KEYS.consumerSecret) || '';
  let consumerKey = rawKey;
  let consumerSecret = rawSecret;
  if (rawKey) {
    try { consumerKey = decryptToken(rawKey); } catch {
      logger.error({ key: DB_KEYS.consumerKey }, 'Stored key is NOT encrypted — re-encrypt via settings');
    }
  }
  if (rawSecret) {
    try { consumerSecret = decryptToken(rawSecret); } catch {
      logger.error({ key: DB_KEYS.consumerSecret }, 'Stored key is NOT encrypted — re-encrypt via settings');
    }
  }
  if (baseUrl && consumerKey && consumerSecret) return { baseUrl, consumerKey, consumerSecret };
  return null;
}

/**
 * جلب الإعدادات: من قاعدة البيانات أولاً، ثم من متغيرات البيئة
 */
export async function getWooCommerceConfig(): Promise<WooCommerceConfig | null> {
  const fromDb = await getFromDb();
  if (fromDb) return fromDb;
  if (ENV_KEYS.baseUrl && ENV_KEYS.consumerKey && ENV_KEYS.consumerSecret) {
    return {
      baseUrl: ENV_KEYS.baseUrl,
      consumerKey: ENV_KEYS.consumerKey,
      consumerSecret: ENV_KEYS.consumerSecret,
    };
  }
  return null;
}
