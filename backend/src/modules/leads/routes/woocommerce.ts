import { Router, Request, Response } from 'express';
import { prisma } from '../../../db';
import {
  fetchWooCommerceProducts,
  fetchWooCommerceOrders,
  getWooCommerceConfigForUI,
  isConfigured,
} from '../services/woocommerce';
import { normalizePhone } from '../../../shared/utils/phone';
import { encryptToken } from '../../../shared/utils/token-encryption';
import { z } from 'zod';

const router = Router();

const wooConfigSchema = z.object({
  baseUrl: z.string().min(1, 'رابط الموقع مطلوب').transform((s) => s.replace(/\/$/, '')),
  consumerKey: z.string().optional(),
  consumerSecret: z.string().optional(),
});

// حالة الاتصال (للتوافق مع الواجهة الحالية)
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const configured = await isConfigured();
    res.json({ configured });
  } catch {
    res.json({ configured: false });
  }
});

// جلب إعدادات ووكومرس للواجهة (رابط الموقع + قيم مخفية للمفتاح والسر)
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const data = await getWooCommerceConfigForUI();
    res.json(data);
  } catch {
    res.json({
      configured: false,
      baseUrl: '',
      consumerKeyMasked: '',
      consumerSecretMasked: '',
      source: 'env' as const,
    });
  }
});

// حفظ إعدادات ووكومرس من صفحة الربط (المفتاح والسر اختياريان عند التحديث للإبقاء على القيمة الحالية)
router.post('/config', async (req: Request, res: Response) => {
  try {
    const parsed = wooConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
      return;
    }
    const { baseUrl, consumerKey, consumerSecret } = parsed.data;
    await prisma.integrationSetting.upsert({
      where: { key: 'woocommerce_base_url' },
      update: { value: baseUrl },
      create: { key: 'woocommerce_base_url', value: baseUrl },
    });
    if (consumerKey != null && consumerKey.trim() !== '') {
      await prisma.integrationSetting.upsert({
        where: { key: 'woocommerce_consumer_key' },
        update: { value: encryptToken(consumerKey.trim()) },
        create: { key: 'woocommerce_consumer_key', value: encryptToken(consumerKey.trim()) },
      });
    }
    if (consumerSecret != null && consumerSecret.trim() !== '') {
      await prisma.integrationSetting.upsert({
        where: { key: 'woocommerce_consumer_secret' },
        update: { value: encryptToken(consumerSecret.trim()) },
        create: { key: 'woocommerce_consumer_secret', value: encryptToken(consumerSecret.trim()) },
      });
    }
    res.json({ success: true });
  } catch (err: unknown) {
    console.error('WooCommerce config save error:', err);
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : '';
    const msg =
      code === 'P2021' || code === 'P2010'
        ? 'جدول إعدادات التكامل غير موجود. شغّل في مجلد الـ Backend: npx prisma db push'
        : 'فشل حفظ الإعدادات. تحقق من اتصال قاعدة البيانات.';
    res.status(500).json({ error: msg });
  }
});

const MAX_SYNC_PAGES = 50;

router.post('/sync-products', async (_req: Request, res: Response) => {
  const configured = await isConfigured();
  if (!configured) {
    res.status(503).json({ error: 'إعدادات ووكومرس غير مكتملة. أدخل البيانات من صفحة الربط.' });
    return;
  }
  try {
    let page = 1;
    let total = 0;
    const perPage = 100;
    do {
      const list = await fetchWooCommerceProducts(page, perPage);
      for (const p of list) {
        await prisma.product.upsert({
          where: { wooCommerceId: p.id },
          update: {
            name: p.name,
            slug: p.slug || null,
            data: { id: p.id, name: p.name, slug: p.slug, price: p.price } as object,
            variations: (p.variations ? { ids: p.variations } : undefined) as object | undefined,
            syncedAt: new Date(),
          },
          create: {
            wooCommerceId: p.id,
            name: p.name,
            slug: p.slug || null,
            data: { id: p.id, name: p.name, slug: p.slug, price: p.price } as object,
            variations: (p.variations ? { ids: p.variations } : undefined) as object | undefined,
            isActive: false,
          },
        });
        total++;
      }
      if (list.length < perPage) break;
      page++;
    } while (page <= MAX_SYNC_PAGES);
    res.json({ success: true, synced: total });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع';
    res.status(502).json({ error: `فشل مزامنة المنتجات: ${message}` });
  }
});

// ==================== استيراد طلبات ووكومرس ====================

function mapWcStatus(wcStatus: string): { status: string; accountsStatus: string } {
  switch (wcStatus) {
    case 'completed':
    case 'processing':
      return { status: 'active', accountsStatus: 'confirmed' };
    case 'cancelled':
    case 'refunded':
    case 'failed':
      return { status: 'cancelled', accountsStatus: 'rejected' };
    default:
      return { status: 'active', accountsStatus: 'confirmed' };
  }
}

const MAX_IMPORT_PAGES = 50;

router.post('/import-orders', async (_req: Request, res: Response) => {
  const configured = await isConfigured();
  if (!configured) {
    res.status(503).json({ error: 'إعدادات ووكومرس غير مكتملة.' });
    return;
  }

  try {
    const after = (_req.body as { after?: string }).after || '2026-01-01T00:00:00';
    let page = 1;
    const perPage = 100;
    let importedCount = 0;
    let skippedCount = 0;
    const unmatched: Array<{ wcId: number; phone: string; reason: string }> = [];

    // Pre-load all products for fast lookup
    const allProducts = await prisma.product.findMany({
      select: { id: true, wooCommerceId: true },
    });
    const productMap = new Map(allProducts.map(p => [p.wooCommerceId, p.id]));

    do {
      const wcOrders = await fetchWooCommerceOrders(page, perPage, after);

      for (const wc of wcOrders) {
        // Skip already imported
        const exists = await prisma.order.findUnique({
          where: { wooCommerceId: wc.id },
          select: { id: true },
        });
        if (exists) { skippedCount++; continue; }

        // Normalize phone
        const rawPhone = wc.billing.phone;
        const normalized = normalizePhone(rawPhone);
        if (!normalized) {
          unmatched.push({ wcId: wc.id, phone: rawPhone, reason: 'invalid_phone' });
          continue;
        }

        // Find lead by phone
        const lead = await prisma.lead.findFirst({
          where: { phoneNormalized: normalized },
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, customerId: true, phone: true, email: true, whatsapp: true, address: true },
        });
        if (!lead) {
          unmatched.push({ wcId: wc.id, phone: rawPhone, reason: 'no_lead' });
          continue;
        }

        // Ensure customer exists
        let customerId = lead.customerId;
        if (!customerId) {
          const customer = await prisma.customer.upsert({
            where: { phone: normalized },
            update: { name: lead.name },
            create: { phone: normalized, name: lead.name, email: lead.email, whatsapp: lead.whatsapp, address: lead.address },
          });
          await prisma.lead.update({ where: { id: lead.id }, data: { customerId: customer.id } });
          customerId = customer.id;
        }

        // Build shipping name
        const shippingName =
          [wc.shipping.first_name, wc.shipping.last_name].filter(Boolean).join(' ') ||
          [wc.billing.first_name, wc.billing.last_name].filter(Boolean).join(' ') ||
          lead.name;

        const { status: dolphinStatus, accountsStatus: dolphinAccountsStatus } = mapWcStatus(wc.status);

        // Skip orders with no line items
        if (!wc.line_items || wc.line_items.length === 0) {
          unmatched.push({ wcId: wc.id, phone: rawPhone, reason: 'no_items' });
          continue;
        }

        // Create order + items in transaction
        await prisma.$transaction(async (tx) => {
          const order = await tx.order.create({
            data: {
              leadId: lead.id,
              customerId: customerId!,
              wooCommerceId: wc.id,
              status: dolphinStatus,
              accountsStatus: dolphinAccountsStatus,
              paymentType: 'full',
              shippingName,
              shippingPhone: rawPhone,
              shippingCity: wc.shipping.city || wc.billing.city || undefined,
              shippingAddress: wc.shipping.address_1 || wc.billing.address_1 || undefined,
              notes: `Imported from WooCommerce (WC #${wc.id})`,
              createdAt: new Date(wc.date_created),
            },
          });

          for (const item of wc.line_items) {
            const productId = item.product_id ? productMap.get(item.product_id) : undefined;
            await tx.orderItem.create({
              data: {
                orderId: order.id,
                productId: productId || undefined,
                productName: productId ? undefined : item.name,
                quantity: item.quantity,
                price: parseFloat(item.price) || 0,
              },
            });
          }
        });

        importedCount++;
      }

      if (wcOrders.length < perPage) break;
      page++;
    } while (page <= MAX_IMPORT_PAGES);

    res.json({ success: true, imported: importedCount, skipped: skippedCount, unmatched });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع';
    console.error('WC import error:', err);
    res.status(502).json({ error: `فشل استيراد الطلبات: ${message}` });
  }
});

export default router;
