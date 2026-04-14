/**
 * Blacklisted Phones routes
 * GET    / — list all blacklisted phones
 * POST   / — add phone (requires blacklist.manage — enforced by index router)
 * DELETE /:id — remove phone (same)
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../db';
import { AuthRequest } from '../../../shared/middleware/auth';
import { normalizePhone } from '../../../shared/utils/phone';

const router = Router();

// GET / — list all blacklisted phones
router.get('/', async (_req, res: Response) => {
  try {
    const phones = await prisma.blacklistedPhone.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { id: true, name: true } },
      },
    });
    res.json({ phones });
  } catch (err) {
    console.error('Blacklist list error:', err);
    res.status(500).json({ error: 'خطأ في تحميل قائمة الحظر' });
  }
});

// POST / — add phone
const addPhoneSchema = z.object({
  phone: z.string().min(6),
  reason: z.string().optional(),
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'مطلوب تسجيل الدخول' });
      return;
    }

    const parsed = addPhoneSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
      return;
    }

    const phone = normalizePhone(parsed.data.phone) || parsed.data.phone.trim();
    const reason = parsed.data.reason?.trim() || null;

    // Check if already exists
    const existing = await prisma.blacklistedPhone.findUnique({ where: { phone } });
    if (existing) {
      res.status(409).json({ error: 'الرقم موجود بالفعل في قائمة الحظر' });
      return;
    }

    const entry = await prisma.blacklistedPhone.create({
      data: {
        phone,
        reason,
        addedBy: userId,
      },
      include: {
        creator: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ phone: entry });
  } catch (err) {
    console.error('Blacklist add error:', err);
    res.status(500).json({ error: 'خطأ في إضافة الرقم' });
  }
});

// DELETE /:id — remove phone
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const entry = await prisma.blacklistedPhone.findUnique({ where: { id } });
    if (!entry) {
      res.status(404).json({ error: 'الرقم غير موجود في قائمة الحظر' });
      return;
    }

    await prisma.blacklistedPhone.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error('Blacklist delete error:', err);
    res.status(500).json({ error: 'خطأ في حذف الرقم' });
  }
});

export default router;
