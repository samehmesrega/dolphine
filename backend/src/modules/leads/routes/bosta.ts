import { Router, Request, Response } from 'express';
import { prisma } from '../../../db';
import { getBostaConfigForUI, isConfigured as isBostaConfigured, getAllowOpenPackage, setAllowOpenPackage, getPackageDescription, setPackageDescription } from '../services/bosta';
import { config } from '../../../shared/config';
import { z } from 'zod';

const router = Router();

const bostaConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional().transform((s) => s?.replace(/\/$/, '') || ''),
  enabled: z.boolean().optional(),
});

// حالة الاتصال
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const configured = await isBostaConfigured();
    const uiConfig = await getBostaConfigForUI();
    res.json({ configured, enabled: uiConfig.enabled });
  } catch {
    res.json({ configured: false, enabled: false });
  }
});

// جلب إعدادات بوسطة للواجهة
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const data = await getBostaConfigForUI();
    const webhookUrl = `${config.appUrl}/api/webhooks/bosta`;
    res.json({ ...data, webhookUrl });
  } catch {
    res.json({
      configured: false,
      enabled: false,
      baseUrl: 'https://app.bosta.co/api/v2',
      apiKeyMasked: '',
      source: 'env' as const,
      webhookUrl: `${config.appUrl}/api/webhooks/bosta`,
    });
  }
});

// حفظ إعدادات بوسطة
router.post('/config', async (req: Request, res: Response) => {
  try {
    const parsed = bostaConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
      return;
    }
    const { apiKey, baseUrl, enabled } = parsed.data;

    if (apiKey != null && apiKey.trim() !== '') {
      await prisma.integrationSetting.upsert({
        where: { key: 'bosta_api_key' },
        update: { value: apiKey.trim() },
        create: { key: 'bosta_api_key', value: apiKey.trim() },
      });
    }
    if (baseUrl != null && baseUrl.trim() !== '') {
      await prisma.integrationSetting.upsert({
        where: { key: 'bosta_base_url' },
        update: { value: baseUrl.trim() },
        create: { key: 'bosta_base_url', value: baseUrl.trim() },
      });
    }
    if (enabled != null) {
      await prisma.integrationSetting.upsert({
        where: { key: 'bosta_enabled' },
        update: { value: String(enabled) },
        create: { key: 'bosta_enabled', value: String(enabled) },
      });
    }

    res.json({ success: true });
  } catch (err: unknown) {
    console.error('Bosta config save error:', err);
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : '';
    const msg =
      code === 'P2021' || code === 'P2010'
        ? 'جدول إعدادات التكامل غير موجود. شغّل في مجلد الـ Backend: npx prisma db push'
        : 'فشل حفظ الإعدادات. تحقق من اتصال قاعدة البيانات.';
    res.status(500).json({ error: msg });
  }
});

// جلب إعداد السماح بفتح الشحنة
router.get('/allow-open-package', async (_req: Request, res: Response) => {
  try {
    const allowed = await getAllowOpenPackage();
    res.json({ allowToOpenPackage: allowed });
  } catch {
    res.json({ allowToOpenPackage: true });
  }
});

// تعديل إعداد السماح بفتح الشحنة
router.post('/allow-open-package', async (req: Request, res: Response) => {
  try {
    const { allowToOpenPackage } = req.body;
    if (typeof allowToOpenPackage !== 'boolean') {
      res.status(400).json({ error: 'قيمة غير صحيحة' });
      return;
    }
    await setAllowOpenPackage(allowToOpenPackage);
    res.json({ success: true, allowToOpenPackage });
  } catch {
    res.status(500).json({ error: 'فشل حفظ الإعداد' });
  }
});

// وصف الشحنة الافتراضي
router.get('/package-description', async (_req: Request, res: Response) => {
  try {
    const description = await getPackageDescription();
    res.json({ description });
  } catch {
    res.json({ description: '' });
  }
});

router.post('/package-description', async (req: Request, res: Response) => {
  try {
    const { description } = req.body;
    if (typeof description !== 'string') {
      res.status(400).json({ error: 'قيمة غير صحيحة' });
      return;
    }
    await setPackageDescription(description);
    res.json({ success: true, description: description.trim() });
  } catch {
    res.status(500).json({ error: 'فشل حفظ الإعداد' });
  }
});

export default router;
