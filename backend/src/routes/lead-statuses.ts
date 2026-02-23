import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { z } from 'zod';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const statuses = await prisma.leadStatus.findMany({
      where: { isActive: true },
      orderBy: [{ orderNum: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ statuses });
  } catch (err: unknown) {
    console.error('Lead statuses list error:', err);
    res.status(500).json({ error: 'خطأ في تحميل حالات الليد' });
  }
});

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  color: z.string().min(1).optional(),
  orderNum: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
      return;
    }

    const data = parsed.data;
    const status = await prisma.leadStatus.upsert({
      where: { slug: data.slug },
      update: {
        name: data.name,
        color: data.color,
        orderNum: data.orderNum ?? undefined,
        isActive: data.isActive ?? undefined,
      },
      create: {
        name: data.name,
        slug: data.slug,
        color: data.color,
        orderNum: data.orderNum ?? 0,
        isActive: data.isActive ?? true,
      },
    });

    res.json({ status });
  } catch (err: unknown) {
    console.error('Upsert lead status error:', err);
    res.status(500).json({ error: 'خطأ في حفظ حالة الليد' });
  }
});

// حذف ناعم: تعطيل فقط
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.leadStatus.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'حالة الليد غير موجودة' });
      return;
    }
    const status = await prisma.leadStatus.update({
      where: { id },
      data: { isActive: false },
    });
    res.json({ status });
  } catch (err: unknown) {
    console.error('Delete lead status error:', err);
    res.status(500).json({ error: 'خطأ في حذف حالة الليد' });
  }
});

export default router;
