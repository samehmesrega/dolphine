/**
 * تكامل ووكومرس - رفع الطلبات ومزامنة المنتجات
 * الإعدادات: من قاعدة البيانات (صفحة الربط) أو من متغيرات البيئة
 */

import { prisma } from '../db';
import { config } from '../config';

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
  const consumerKey = map.get(DB_KEYS.consumerKey) || '';
  const consumerSecret = map.get(DB_KEYS.consumerSecret) || '';
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

function maskSecret(s: string, prefixLen = 5): string {
  if (!s || s.length <= prefixLen) return '••••••••';
  return s.slice(0, prefixLen) + '••••••••';
}

/**
 * للإرجاع في واجهة الإعدادات: القيم مع إخفاء الجزء الحساس من المفتاح والسر
 */
export async function getWooCommerceConfigForUI(): Promise<{
  configured: boolean;
  baseUrl: string;
  consumerKeyMasked: string;
  consumerSecretMasked: string;
  source: 'db' | 'env';
}> {
  const fromDb = await getFromDb();
  if (fromDb) {
    return {
      configured: true,
      baseUrl: fromDb.baseUrl,
      consumerKeyMasked: maskSecret(fromDb.consumerKey),
      consumerSecretMasked: maskSecret(fromDb.consumerSecret),
      source: 'db',
    };
  }
  if (ENV_KEYS.baseUrl && ENV_KEYS.consumerKey && ENV_KEYS.consumerSecret) {
    return {
      configured: true,
      baseUrl: ENV_KEYS.baseUrl,
      consumerKeyMasked: maskSecret(ENV_KEYS.consumerKey),
      consumerSecretMasked: maskSecret(ENV_KEYS.consumerSecret),
      source: 'env',
    };
  }
  return {
    configured: false,
    baseUrl: '',
    consumerKeyMasked: '',
    consumerSecretMasked: '',
    source: 'env',
  };
}

export async function isConfigured(): Promise<boolean> {
  const c = await getWooCommerceConfig();
  return !!c;
}

function authParams(cfg: WooCommerceConfig): URLSearchParams {
  const p = new URLSearchParams();
  p.set('consumer_key', cfg.consumerKey);
  p.set('consumer_secret', cfg.consumerSecret);
  return p;
}

async function wcFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const cfg = await getWooCommerceConfig();
  if (!cfg) throw new Error('إعدادات ووكومرس غير مكتملة (أدخل البيانات من صفحة الربط أو متغيرات البيئة)');
  const url = `${cfg.baseUrl}/wp-json/wc/v3${path}${path.includes('?') ? '&' : '?'}${authParams(cfg).toString()}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    let errMsg = text;
    try {
      const j = JSON.parse(text);
      errMsg = j.message || j.code || text;
    } catch {}
    throw new Error(`WooCommerce: ${res.status} ${errMsg}`);
  }
  return res.json() as Promise<T>;
}

export type WCLineItem =
  | { product_id: number; quantity: number }
  | { name: string; quantity: number; price: string };

export type WCOrderPayload = {
  billing: { first_name: string; last_name?: string; address_1?: string; city?: string; phone: string };
  shipping: { first_name: string; last_name?: string; address_1?: string };
  line_items: WCLineItem[];
  payment_method?: string;
  payment_method_title?: string;
  set_paid?: boolean;
};

export async function createWooCommerceOrder(payload: WCOrderPayload): Promise<number> {
  const order = await wcFetch<{ id: number }>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return order.id;
}

export async function fetchWooCommerceProducts(page = 1, perPage = 100): Promise<
  Array<{
    id: number;
    name: string;
    slug: string;
    price?: string;
    variations?: number[];
  }>
> {
  const list = await wcFetch<unknown[]>(`/products?per_page=${perPage}&page=${page}`);
  return list as Array<{ id: number; name: string; slug: string; price?: string; variations?: number[] }>;
}
