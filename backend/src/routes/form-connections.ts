/**
 * إدارة اتصالات النماذج (ووردبريس → دولفين)
 * المستخدم ينشئ اتصالاً ويضع اسم + shortcode ويحصل على رابط ويب هوك لاستخدامه في ووردبريس
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';

const router = Router();

const fieldMappingSchema = z.object({
  name:         z.string().optional(),
  phone:        z.string().optional(),
  email:        z.string().optional(),
  address:      z.string().optional(),
  customFields: z.array(z.object({
    label: z.string().min(1),
    field: z.string().min(1),
  })).optional(),
}).optional();

const createSchema = z.object({
  name:         z.string().min(1, 'الاسم مطلوب'),
  shortcode:    z.string().optional(),
  fieldMapping: fieldMappingSchema,
});

// قائمة اتصالات النماذج
router.get('/', async (_req: Request, res: Response) => {
  try {
    const connections = await prisma.formConnection.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ connections });
  } catch (err: unknown) {
    console.error('Form connections list error:', err);
    res.status(500).json({ error: 'خطأ في تحميل اتصالات النماذج' });
  }
});

// إنشاء اتصال جديد → يُنشأ token ويُرجع الاتصال مع رابط الويب هوك
router.post('/', async (req: Request, res: Response) => {
  try {
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
        fieldMapping: (parsed.data.fieldMapping ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
    res.status(201).json({ connection });
  } catch (err: unknown) {
    console.error('Create form connection error:', err);
    res.status(500).json({ error: 'خطأ في إنشاء اتصال النموذج' });
  }
});

// تحديث field mapping
router.patch('/:id/mapping', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const parsed = fieldMappingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة' });
      return;
    }
    const existing = await prisma.formConnection.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'الاتصال غير موجود' });
      return;
    }
    const connection = await prisma.formConnection.update({
      where: { id },
      data: { fieldMapping: (parsed.data ?? Prisma.JsonNull) as Prisma.InputJsonValue },
    });
    res.json({ connection });
  } catch (err: unknown) {
    console.error('Update field mapping error:', err);
    res.status(500).json({ error: 'خطأ في تحديث الـ mapping' });
  }
});

// حذف اتصال
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.formConnection.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'الاتصال غير موجود' });
      return;
    }
    await prisma.formConnection.delete({ where: { id } });
    res.status(204).send();
  } catch (err: unknown) {
    console.error('Delete form connection error:', err);
    res.status(500).json({ error: 'خطأ في حذف الاتصال' });
  }
});

export default router;
