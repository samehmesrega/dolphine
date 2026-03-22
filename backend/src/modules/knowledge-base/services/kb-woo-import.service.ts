/**
 * خدمة استيراد منتجات ووكومرس لبنك المعلومات
 * تجلب المنتجات من WooCommerce وتنشئ سجلات KbProduct كاملة
 */

import { prisma } from '../../../db';
import { getWooCommerceConfig } from '../../leads/services/woocommerce';

// ─── Types ──────────────────────────────────────────────────────────────────

interface WooImage {
  src: string;
}

interface WooCategory {
  name: string;
}

interface WooAttribute {
  name: string;
  option: string;
}

interface WooVariation {
  id: number;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  attributes: WooAttribute[];
}

interface WooProduct {
  id: number;
  name: string;
  slug: string;
  price: string;
  regular_price: string;
  sale_price: string;
  sku: string;
  description: string;
  short_description: string;
  images: WooImage[];
  categories: WooCategory[];
  variations: number[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

async function getAuthHeader() {
  const cfg = await getWooCommerceConfig();
  if (!cfg) throw new Error('WooCommerce غير مربوط — اضبط الإعدادات من موديول الليدز');
  const token = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64');
  return { baseUrl: cfg.baseUrl, auth: `Basic ${token}` };
}

async function getUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existing = await prisma.kbProduct.findUnique({ where: { slug } });
    if (!existing) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
    if (counter > 20) {
      slug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }

  return slug;
}

// ─── Fetch Functions ────────────────────────────────────────────────────────

/**
 * جلب كل المنتجات من ووكومرس
 */
export async function fetchWooProducts(): Promise<WooProduct[]> {
  const { baseUrl, auth } = await getAuthHeader();

  const res = await fetch(`${baseUrl}/wp-json/wc/v3/products?per_page=100`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth,
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

  return res.json() as Promise<WooProduct[]>;
}

/**
 * جلب تفاصيل منتج واحد من ووكومرس
 */
export async function fetchWooProductDetail(wooId: number): Promise<WooProduct> {
  const { baseUrl, auth } = await getAuthHeader();

  const res = await fetch(`${baseUrl}/wp-json/wc/v3/products/${wooId}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth,
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

  return res.json() as Promise<WooProduct>;
}

/**
 * جلب فاريشنز منتج من ووكومرس
 */
export async function fetchWooVariations(wooId: number): Promise<WooVariation[]> {
  const { baseUrl, auth } = await getAuthHeader();

  const res = await fetch(`${baseUrl}/wp-json/wc/v3/products/${wooId}/variations?per_page=100`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth,
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

  return res.json() as Promise<WooVariation[]>;
}

// ─── Import Orchestrator ────────────────────────────────────────────────────

/**
 * استيراد منتج كامل من ووكومرس إلى بنك المعلومات
 * 1. جلب بيانات المنتج والفاريشنز
 * 2. التأكد إنه مش مستورد قبل كده
 * 3. إنشاء/ربط سجل Product في الليدز
 * 4. إنشاء KbProduct + Media + Variations + Pricing
 */
export async function importWooProduct(wooProductId: number, createdBy: string) {
  // 1. Fetch product detail from WooCommerce
  const wooProduct = await fetchWooProductDetail(wooProductId);

  // 2. Fetch variations if product has any
  let wooVariations: WooVariation[] = [];
  if (wooProduct.variations && wooProduct.variations.length > 0) {
    wooVariations = await fetchWooVariations(wooProductId);
  }

  // 3. Check if already imported
  const existingKb = await prisma.kbProduct.findFirst({
    where: {
      wooProduct: {
        wooCommerceId: wooProductId,
      },
    },
  });
  if (existingKb) {
    throw new Error('المنتج مستورد بالفعل');
  }

  // 4. Find or create the Product record in leads module
  let product = await prisma.product.findUnique({
    where: { wooCommerceId: wooProductId },
  });

  if (!product) {
    product = await prisma.product.create({
      data: {
        wooCommerceId: wooProductId,
        name: wooProduct.name,
        slug: wooProduct.slug,
        data: {
          price: wooProduct.price,
          regular_price: wooProduct.regular_price,
          sale_price: wooProduct.sale_price,
          sku: wooProduct.sku,
          short_description: wooProduct.short_description,
        },
        variations: wooVariations.length > 0
          ? (wooVariations.map((v) => ({
              id: v.id,
              sku: v.sku,
              price: v.price,
              attributes: v.attributes.map((a) => ({ name: a.name, option: a.option })),
            })) as any)
          : undefined,
      },
    });
  }

  // 5. Create KbProduct with all relations in a transaction
  const uniqueSlug = await getUniqueSlug(wooProduct.slug || wooProduct.name.toLowerCase().replace(/\s+/g, '-'));

  const result = await prisma.$transaction(async (tx) => {
    // Create KbProduct
    const kbProduct = await tx.kbProduct.create({
      data: {
        name: wooProduct.name,
        slug: uniqueSlug,
        sku: wooProduct.sku || undefined,
        description: stripHtml(wooProduct.description || ''),
        category: wooProduct.categories[0]?.name || undefined,
        wooProductId: product!.id,
        createdBy,
      },
    });

    // 6. Create KbMedia from images
    for (let i = 0; i < wooProduct.images.length; i++) {
      await tx.kbMedia.create({
        data: {
          productId: kbProduct.id,
          type: 'image',
          url: wooProduct.images[i].src,
          source: 'UPLOAD',
          orderNum: i,
        },
      });
    }

    // 7. Create KbVariations from WC variations
    const createdVariations: Array<{ id: string; wooVariationId: number }> = [];

    for (const wcVar of wooVariations) {
      // Build name from attributes (e.g., "أحمر - L")
      const varName = wcVar.attributes.map((a) => a.option).join(' - ') || `Variation ${wcVar.id}`;

      // Extract color and size from attributes
      const colorAttr = wcVar.attributes.find(
        (a) => a.name.toLowerCase().includes('color') || a.name.includes('لون')
      );
      const sizeAttr = wcVar.attributes.find(
        (a) => a.name.toLowerCase().includes('size') || a.name.includes('مقاس')
      );

      const kbVariation = await tx.kbVariation.create({
        data: {
          productId: kbProduct.id,
          name: varName,
          color: colorAttr?.option || undefined,
          size: sizeAttr?.option || undefined,
          sku: wcVar.sku || undefined,
          wooVariationId: wcVar.id,
          source: 'WOOCOMMERCE',
        },
      });

      createdVariations.push({ id: kbVariation.id, wooVariationId: wcVar.id });
    }

    // 8. Create KbPricing
    // Main product pricing
    const regularPrice = parseFloat(wooProduct.regular_price);
    if (!isNaN(regularPrice) && regularPrice > 0) {
      await tx.kbPricing.create({
        data: {
          productId: kbProduct.id,
          currency: 'EGP',
          priceType: 'RETAIL',
          price: regularPrice,
        },
      });
    }

    const salePrice = parseFloat(wooProduct.sale_price);
    if (!isNaN(salePrice) && salePrice > 0) {
      await tx.kbPricing.create({
        data: {
          productId: kbProduct.id,
          currency: 'EGP',
          priceType: 'OFFER',
          price: salePrice,
        },
      });
    }

    // Variation pricing
    for (const wcVar of wooVariations) {
      const kbVar = createdVariations.find((v) => v.wooVariationId === wcVar.id);
      if (!kbVar) continue;

      const varRegularPrice = parseFloat(wcVar.regular_price);
      if (!isNaN(varRegularPrice) && varRegularPrice > 0) {
        await tx.kbPricing.create({
          data: {
            productId: kbProduct.id,
            variationId: kbVar.id,
            currency: 'EGP',
            priceType: 'RETAIL',
            price: varRegularPrice,
          },
        });
      }

      const varSalePrice = parseFloat(wcVar.sale_price);
      if (!isNaN(varSalePrice) && varSalePrice > 0) {
        await tx.kbPricing.create({
          data: {
            productId: kbProduct.id,
            variationId: kbVar.id,
            currency: 'EGP',
            priceType: 'OFFER',
            price: varSalePrice,
          },
        });
      }
    }

    return kbProduct;
  });

  // 9. Return the created KbProduct with all relations
  return prisma.kbProduct.findUnique({
    where: { id: result.id },
    include: {
      project: true,
      wooProduct: true,
      media: { orderBy: { orderNum: 'asc' } },
      pricing: {
        include: { variation: true },
        orderBy: { updatedAt: 'desc' },
      },
      variations: {
        include: { pricing: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}
