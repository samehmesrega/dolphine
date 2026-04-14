/**
 * Generic IntegrationSetting read/write endpoints
 * GET  /setting/:key — get a single setting value
 * PUT  /setting/:key — upsert a single setting value
 * Access controlled by requirePermission('integrations.manage') at index router level
 */

import { Router, Response } from 'express';
import { prisma } from '../../../db';
import { AuthRequest } from '../../../shared/middleware/auth';

const router = Router();

// GET /setting/:key
router.get('/setting/:key', async (req: AuthRequest, res: Response) => {
  try {
    const key = String(req.params.key);
    const setting = await prisma.integrationSetting.findUnique({ where: { key } });
    res.json({ value: setting?.value ?? null });
  } catch (err) {
    console.error('Integration setting get error:', err);
    res.status(500).json({ error: 'خطأ في قراءة الإعداد' });
  }
});

// PUT /setting/:key
router.put('/setting/:key', async (req: AuthRequest, res: Response) => {
  try {
    const key = String(req.params.key);
    const { value } = req.body as { value?: string };
    if (typeof value !== 'string') {
      res.status(400).json({ error: 'value مطلوبة' });
      return;
    }

    await prisma.integrationSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Integration setting put error:', err);
    res.status(500).json({ error: 'خطأ في حفظ الإعداد' });
  }
});

export default router;
