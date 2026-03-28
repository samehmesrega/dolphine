/**
 * تكامل بوسطة - رفع الشحنات وتتبعها
 * الإعدادات: من قاعدة البيانات (صفحة الربط) أو من متغيرات البيئة
 * API Reference: https://docs.bosta.co (v2)
 */

import { prisma } from '../../../db';
import { config } from '../../../shared/config';
import { Decimal } from '@prisma/client/runtime/library';

// ===== Config =====

const ENV_KEYS = {
  apiKey: config.bosta.apiKey || '',
  baseUrl: (config.bosta.baseUrl || 'https://app.bosta.co/api/v2').replace(/\/$/, ''),
};

const DB_KEYS = {
  apiKey: 'bosta_api_key',
  baseUrl: 'bosta_base_url',
  enabled: 'bosta_enabled',
} as const;

export type BostaConfig = {
  apiKey: string;
  baseUrl: string;
};

async function getFromDb(): Promise<BostaConfig | null> {
  const rows = await prisma.integrationSetting.findMany({
    where: { key: { in: [DB_KEYS.apiKey, DB_KEYS.baseUrl] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const apiKey = map.get(DB_KEYS.apiKey) || '';
  const baseUrl = (map.get(DB_KEYS.baseUrl) || '').replace(/\/$/, '');
  if (apiKey && baseUrl) return { apiKey, baseUrl };
  if (apiKey) return { apiKey, baseUrl: ENV_KEYS.baseUrl };
  return null;
}

export async function getBostaConfig(): Promise<BostaConfig | null> {
  const fromDb = await getFromDb();
  if (fromDb) return fromDb;
  if (ENV_KEYS.apiKey) {
    return { apiKey: ENV_KEYS.apiKey, baseUrl: ENV_KEYS.baseUrl };
  }
  return null;
}

function maskSecret(s: string, prefixLen = 5): string {
  if (!s || s.length <= prefixLen) return '••••••••';
  return s.slice(0, prefixLen) + '••••••••';
}

export async function getBostaConfigForUI(): Promise<{
  configured: boolean;
  enabled: boolean;
  baseUrl: string;
  apiKeyMasked: string;
  source: 'db' | 'env';
}> {
  const enabled = await isEnabled();
  const fromDb = await getFromDb();
  if (fromDb) {
    return {
      configured: true,
      enabled,
      baseUrl: fromDb.baseUrl,
      apiKeyMasked: maskSecret(fromDb.apiKey),
      source: 'db',
    };
  }
  if (ENV_KEYS.apiKey) {
    return {
      configured: true,
      enabled,
      baseUrl: ENV_KEYS.baseUrl,
      apiKeyMasked: maskSecret(ENV_KEYS.apiKey),
      source: 'env',
    };
  }
  return {
    configured: false,
    enabled,
    baseUrl: ENV_KEYS.baseUrl || 'https://app.bosta.co/api/v2',
    apiKeyMasked: '',
    source: 'env',
  };
}

async function isEnabled(): Promise<boolean> {
  const row = await prisma.integrationSetting.findUnique({ where: { key: DB_KEYS.enabled } });
  return row?.value === 'true';
}

/**
 * هل التكامل مفعّل ومُعدّ؟ (يُستخدم قبل رفع الشحنات)
 */
export async function isConfigured(): Promise<boolean> {
  const enabled = await isEnabled();
  if (!enabled) return false;
  const c = await getBostaConfig();
  return !!c;
}

// ===== API Fetch Wrapper =====

async function bostaFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const cfg = await getBostaConfig();
  if (!cfg) throw new Error('إعدادات بوسطة غير مكتملة (أدخل البيانات من صفحة الربط أو متغيرات البيئة)');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const url = `${cfg.baseUrl}/${path}`;
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': cfg.apiKey,
        ...options.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      let errMsg = text;
      try {
        const j = JSON.parse(text);
        errMsg = j.message || j.errorCode || text;
      } catch {}
      throw new Error(`بوسطة: ${res.status} ${errMsg}`);
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

// ===== Delivery Functions =====

type BostaDeliveryResponse = {
  success: boolean;
  message: string;
  data: {
    _id: string;
    trackingNumber: string;
    businessReference: string;
    state: { code: number; value: string };
  };
};

type OrderWithItems = {
  id: string;
  number: number;
  wooCommerceId: number | null;
  shippingName: string;
  shippingPhone: string;
  shippingGovernorate: string | null;
  shippingCity: string | null;
  shippingAddress: string | null;
  notes: string | null;
  discount: Decimal | null;
  partialAmount: Decimal | null;
  paymentType: string;
  orderItems: Array<{
    productName: string | null;
    quantity: number;
    price: Decimal;
    product?: { name: string } | null;
  }>;
};

// DB setting for allowToOpenPackage
const DB_KEY_ALLOW_OPEN = 'bosta_allow_open_package' as const;
const DB_KEY_DESCRIPTION = 'bosta_package_description' as const;

export async function getAllowOpenPackage(): Promise<boolean> {
  const row = await prisma.integrationSetting.findUnique({ where: { key: DB_KEY_ALLOW_OPEN } });
  return row?.value !== 'false'; // default true
}

export async function setAllowOpenPackage(value: boolean): Promise<void> {
  await prisma.integrationSetting.upsert({
    where: { key: DB_KEY_ALLOW_OPEN },
    update: { value: String(value) },
    create: { key: DB_KEY_ALLOW_OPEN, value: String(value) },
  });
}

export async function getPackageDescription(): Promise<string> {
  const row = await prisma.integrationSetting.findUnique({ where: { key: DB_KEY_DESCRIPTION } });
  return row?.value || '';
}

export async function setPackageDescription(value: string): Promise<void> {
  await prisma.integrationSetting.upsert({
    where: { key: DB_KEY_DESCRIPTION },
    update: { value: value.trim() },
    create: { key: DB_KEY_DESCRIPTION, value: value.trim() },
  });
}

/**
 * إنشاء شحنة على بوسطة
 */
export async function createBostaDelivery(
  order: OrderWithItems,
): Promise<{ deliveryId: string; trackingNumber: string }> {
  // حساب مبلغ التحصيل = المبلغ المتبقي
  const totalPrice = order.orderItems.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );
  const discount = Number(order.discount || 0);
  const finalTotal = totalPrice - discount;
  const paidAmount = order.paymentType === 'full' ? finalTotal : Number(order.partialAmount || 0);
  const cod = Math.max(0, finalTotal - paidAmount);

  console.log(`[Bosta] Order #${order.number}: total=${totalPrice} discount=${discount} final=${finalTotal} paymentType=${order.paymentType} paid=${paidAmount} COD=${cod}`);

  // تقسيم الاسم
  const nameParts = (order.shippingName || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // وصف المنتجات — من الإعدادات أو أسماء المنتجات
  const customDesc = await getPackageDescription();
  const itemNames = customDesc || order.orderItems
    .map((it) => it.product?.name || it.productName || 'منتج')
    .join(', ');
  const itemsCount = order.orderItems.reduce((sum, it) => sum + it.quantity, 0);

  // Resolve Bosta address (city + district from Bosta API)
  const bostaAddr = await resolveBostaAddress(
    order.shippingGovernorate || '',
    order.shippingCity || '',
    order.shippingAddress || '',
  );

  // السماح بفتح الشحنة (من إعدادات الربط)
  const allowOpen = await getAllowOpenPackage();

  // مرجع الطلب = رقم WooCommerce أو رقم دولفين
  const businessRef = order.wooCommerceId ? String(order.wooCommerceId) : String(order.number);

  const payload = {
    type: 10, // Package Delivery
    cod,
    receiver: {
      firstName,
      lastName,
      phone: order.shippingPhone,
    },
    dropOffAddress: {
      country: { _id: 'wJB7VzprQ', name: 'Egypt', nameAr: 'مصر', code: 'EG' },
      city: bostaAddr.cityName,
      cityId: bostaAddr.cityId,
      districtId: bostaAddr.districtId,
      firstLine: bostaAddr.firstLine,
    },
    businessReference: businessRef,
    notes: order.notes || undefined,
    specs: {
      packageType: 'Parcel',
      size: 'MEDIUM',
      packageDetails: {
        itemsCount,
        description: itemNames,
        itemsValue: finalTotal,
      },
    },
    allowToOpenPackage: allowOpen,
  };

  const result = await bostaFetch<BostaDeliveryResponse>('deliveries?apiVersion=1', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!result.success || !result.data) {
    throw new Error(result.message || 'فشل إنشاء الشحنة على بوسطة');
  }

  return {
    deliveryId: result.data._id,
    trackingNumber: result.data.trackingNumber,
  };
}

/**
 * عرض تفاصيل شحنة
 */
export async function getDeliveryByTracking(trackingNumber: string): Promise<unknown> {
  const result = await bostaFetch<{ success: boolean; data: unknown }>(
    `deliveries/business/${trackingNumber}`,
  );
  return result.data;
}

/**
 * إلغاء شحنة
 */
export async function terminateDelivery(trackingNumber: string): Promise<void> {
  await bostaFetch(`deliveries/business/${trackingNumber}/terminate`, {
    method: 'DELETE',
  });
}

// ===== Cities & Districts Cache =====

type BostaCity = { _id: string; name: string; nameAr: string; code: string };
type BostaDistrict = { _id: string; name: string; nameAr: string; cityId: string };

let citiesCache: BostaCity[] | null = null;
let citiesCacheTime = 0;
const districtsCache = new Map<string, { data: BostaDistrict[]; time: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function getCities(): Promise<BostaCity[]> {
  if (citiesCache && Date.now() - citiesCacheTime < CACHE_TTL) {
    return citiesCache;
  }

  const result = await bostaFetch<{ success: boolean; data: { list: BostaCity[] } }>('cities');
  citiesCache = result.data?.list || [];
  citiesCacheTime = Date.now();
  return citiesCache;
}

export async function getDistricts(cityId: string): Promise<BostaDistrict[]> {
  const cached = districtsCache.get(cityId);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }

  try {
    const result = await bostaFetch<{ success: boolean; data: { list: BostaDistrict[] } }>(`districts?cityId=${cityId}`);
    const list = result.data?.list || [];
    districtsCache.set(cityId, { data: list, time: Date.now() });
    return list;
  } catch {
    return [];
  }
}

function fuzzyMatch(input: string, target: string): boolean {
  const a = input.trim().toLowerCase();
  const b = target.trim().toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Resolve Bosta address from order fields — always returns valid cityId + districtId
 */
export async function resolveBostaAddress(governorate: string, city: string, address: string): Promise<{
  cityId: string;
  cityName: string;
  districtId: string;
  districtName: string;
  firstLine: string;
}> {
  const cities = await getCities();
  const govInput = governorate || city || '';

  // Match city (governorate)
  let matchedCity = cities.find(c => fuzzyMatch(govInput, c.nameAr) || fuzzyMatch(govInput, c.name));
  if (!matchedCity) {
    matchedCity = cities.find(c => c.name.toLowerCase().includes('cairo')) || cities[0];
    console.log(`[Bosta Address] No city match for "${govInput}", using fallback: ${matchedCity?.nameAr}`);
  } else {
    console.log(`[Bosta Address] City matched: "${govInput}" → ${matchedCity.nameAr} (${matchedCity._id})`);
  }

  // Fetch districts for matched city
  const districts = await getDistricts(matchedCity._id);
  const districtInput = city || address || govInput;

  // Try matching district
  let matchedDistrict = districts.find(d => fuzzyMatch(districtInput, d.nameAr) || fuzzyMatch(districtInput, d.name));
  if (!matchedDistrict && address) {
    // Try matching against address parts
    matchedDistrict = districts.find(d =>
      address.includes(d.nameAr) || address.includes(d.name)
    );
  }
  if (!matchedDistrict) {
    matchedDistrict = districts[0];
    console.log(`[Bosta Address] No district match for "${districtInput}", using first: ${matchedDistrict?.nameAr || 'none'}`);
  } else {
    console.log(`[Bosta Address] District matched: "${districtInput}" → ${matchedDistrict.nameAr}`);
  }

  return {
    cityId: matchedCity._id,
    cityName: matchedCity.name,
    districtId: matchedDistrict?._id || '',
    districtName: matchedDistrict?.name || districtInput || 'غير محدد',
    firstLine: address || govInput || 'عنوان غير محدد',
  };
}
