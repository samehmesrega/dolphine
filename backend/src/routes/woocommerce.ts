import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import {
  fetchWooCommerceProducts,
  getWooCommerceConfigForUI,
  isConfigured,
} from '../services/woocommerce';
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
        update: { value: consumerKey.trim() },
        create: { key: 'woocommerce_consumer_key', value: consumerKey.trim() },
      });
    }
    if (consumerSecret != null && consumerSecret.trim() !== '') {
      await prisma.integrationSetting.upsert({
        where: { key: 'woocommerce_consumer_secret' },
        update: { value: consumerSecret.trim() },
        create: { key: 'woocommerce_consumer_secret', value: consumerSecret.trim() },
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

export default router;
