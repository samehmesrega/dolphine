/**
 * إدارة اتصالات النماذج (ووردبريس → دولفين)
 * المستخدم ينشئ اتصالاً ويضع اسم + shortcode ويحصل على رابط ويب هوك لاستخدامه في ووردبريس
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { z } from 'zod';
import crypto from 'crypto';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  shortcode: z.string().optional(),
});

// قائمة اتصالات النماذج
router.get('/', async (_req: Request, res: Response) => {
  const connections = await prisma.formConnection.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json({ connections });
});

// إنشاء اتصال جديد → يُنشأ token ويُرجع الاتصال مع رابط الويب هوك
router.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
    return;
  }
  const token = crypto.randomBytes(24).toString('hex');
  const connection = await prisma.formConnection.create({
    data: {
      name: parsed.data.name,
      shortcode: parsed.data.shortcode || null,
      token,
    },
  });
  res.status(201).json({ connection });
});

// حذف اتصال
router.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  await prisma.formConnection.deleteMany({ where: { id } });
  res.status(204).send();
});

export default router;
