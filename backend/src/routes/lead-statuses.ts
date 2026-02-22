import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { z } from 'zod';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const statuses = await prisma.leadStatus.findMany({
    where: { isActive: true },
    orderBy: [{ orderNum: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ statuses });
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
});

// حذف ناعم: تعطيل فقط
router.delete('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const status = await prisma.leadStatus.update({
    where: { id },
    data: { isActive: false },
  });
  res.json({ status });
});

export default router;

