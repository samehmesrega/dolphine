/**
 * تكامل ووكومرس - رفع الطلبات ومزامنة المنتجات
 * الإعدادات: من قاعدة البيانات (صفحة الربط) أو من متغيرات البيئة
 */

import { prisma } from '../../../db';
import { config } from '../../../shared/config';
import { decryptToken } from '../../../shared/utils/token-encryption';

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
  // Decrypt credentials (try/catch for legacy plaintext values)
  const rawKey = map.get(DB_KEYS.consumerKey) || '';
  const rawSecret = map.get(DB_KEYS.consumerSecret) || '';
  let consumerKey = rawKey;
  let consumerSecret = rawSecret;
  if (rawKey) { try { consumerKey = decryptToken(rawKey); } catch { /* legacy plaintext */ } }
  if (rawSecret) { try { consumerSecret = decryptToken(rawSecret); } catch { /* legacy plaintext */ } }
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

/**
 * بناء Basic Auth header بدل إرسال credentials في URL
 * هذا أأمن لأن credentials لا تظهر في server logs أو browser history
 */
function buildAuthHeader(cfg: WooCommerceConfig): string {
  const credentials = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64');
  return `Basic ${credentials}`;
}

async function wcFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const cfg = await getWooCommerceConfig();
  if (!cfg) throw new Error('إعدادات ووكومرس غير مكتملة (أدخل البيانات من صفحة الربط أو متغيرات البيئة)');

  const url = `${cfg.baseUrl}/wp-json/wc/v3${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': buildAuthHeader(cfg),
      ...options.headers,
    },
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

export type WCLineItem = { product_id: number; quantity: number; name?: string; price?: string; subtotal?: string; total?: string };

export type WCOrderPayload = {
  billing: { first_name: string; last_name?: string; address_1?: string; city?: string; phone: string };
  shipping: { first_name: string; last_name?: string; address_1?: string };
  line_items: WCLineItem[];
  payment_method?: string;
  payment_method_title?: string;
  set_paid?: boolean;
  customer_note?: string;
  status?: string;
};

export async function createWooCommerceOrder(payload: WCOrderPayload, internalNote?: string): Promise<number> {
  const order = await wcFetch<{ id: number }>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  // Add private order note (visible in admin only)
  if (internalNote) {
    await wcFetch(`/orders/${order.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note: internalNote, customer_note: false }),
    }).catch((err) => console.error('[WooCommerce] Failed to add order note:', err));
  }

  return order.id;
}

export type WCOrderResponse = {
  id: number;
  status: string;
  date_created: string;
  billing: { first_name: string; last_name: string; address_1: string; city: string; phone: string };
  shipping: { first_name: string; last_name: string; address_1: string; city: string };
  line_items: Array<{ product_id: number; name: string; quantity: number; price: string }>;
  payment_method: string;
  total: string;
};

export async function fetchWooCommerceOrders(
  page = 1,
  perPage = 100,
  after?: string,
): Promise<WCOrderResponse[]> {
  let path = `/orders?per_page=${perPage}&page=${page}&orderby=date&order=asc`;
  if (after) path += `&after=${after}`;
  return wcFetch<WCOrderResponse[]>(path);
}

/**
 * إضافة ملاحظة على طلب ووكومرس (لإرسال رقم التتبع مثلاً)
 */
export async function addWooCommerceOrderNote(wooId: number, note: string): Promise<void> {
  await wcFetch(`/orders/${wooId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ note, customer_note: false }),
  });
}

/**
 * تحديث حالة طلب ووكومرس (مثلاً cancelled)
 */
export async function updateWooCommerceOrderStatus(wooId: number, status: string): Promise<void> {
  await wcFetch(`/orders/${wooId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

/**
 * منتج مخصص واحد على ووكومرس — يُستخدم لكل المنتجات اللي مالهاش wooCommerceId
 * الاسم الحقيقي بيتبعت في name override في الـ line item
 */
let _customProductId: number | null = null;
const CUSTOM_PRODUCT_SLUG = 'dolphin-custom-product';

export async function getCustomProductId(): Promise<number> {
  if (_customProductId) return _customProductId;
  // Search by slug
  const results = await wcFetch<Array<{ id: number }>>(`/products?slug=${CUSTOM_PRODUCT_SLUG}&per_page=1`);
  if (results.length > 0) {
    _customProductId = results[0].id;
    return _customProductId;
  }
  // Create once
  const product = await wcFetch<{ id: number }>('/products', {
    method: 'POST',
    body: JSON.stringify({
      name: 'منتج مخصص',
      slug: CUSTOM_PRODUCT_SLUG,
      type: 'simple',
      regular_price: '0',
      status: 'private',
    }),
  });
  _customProductId = product.id;
  return _customProductId;
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
