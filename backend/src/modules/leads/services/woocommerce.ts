/**
 * تكامل ووكومرس - رفع الطلبات ومزامنة المنتجات
 */

import { getWooCommerceConfig } from '../../../shared/services/woocommerce-config';
import type { WooCommerceConfig } from '../../../shared/services/woocommerce-config';

export { getWooCommerceConfig, type WooCommerceConfig };

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
}> {
  const cfg = await getWooCommerceConfig();
  if (cfg) {
    return {
      configured: true,
      baseUrl: cfg.baseUrl,
      consumerKeyMasked: maskSecret(cfg.consumerKey),
      consumerSecretMasked: maskSecret(cfg.consumerSecret),
    };
  }
  return {
    configured: false,
    baseUrl: '',
    consumerKeyMasked: '',
    consumerSecretMasked: '',
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
