/**
 * ويب هوك استقبال الليدز من ووردبريس (بدون مصادقة - الاعتماد على token في الرابط)
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { normalizePhone } from '../utils/phone';
import { getNextAssignedUserId } from '../services/roundRobin';

const router = Router();

type Payload = Record<string, unknown>;

function pickPhone(obj: Payload): string | null {
  const v = obj.phone ?? obj['your-phone'] ?? obj.tel ?? obj.mobile ?? obj['phone-1'] ?? obj['tel-1'];
  if (typeof v === 'string' && v.trim().length >= 6) return v.trim();
  for (const k of Object.keys(obj)) {
    const key = k.toLowerCase();
    if (key.includes('phone') || key.includes('tel') || key.includes('mobile') || key.includes('رقم')) {
      const val = obj[k];
      const s = typeof val === 'string' ? val.trim() : Array.isArray(val) ? String(val[0] ?? '').trim() : '';
      if (s.length >= 6) return s;
    }
  }
  return null;
}

function pickName(obj: Payload): string {
  const v = obj.name ?? obj['your-name'];
  if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 200);
  return 'وارد من النموذج';
}

function pickEmail(obj: Payload): string | undefined {
  const v = obj.email ?? obj['your-email'];
  if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 255);
  return undefined;
}

function pickAddress(obj: Payload): string | undefined {
  const v = obj.address ?? obj['your-address'];
  if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 500);
  return undefined;
}

// POST /api/webhooks/leads/:token
router.post('/leads/:token', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token);
    const connection = await prisma.formConnection.findUnique({ where: { token } });
    if (!connection) {
      console.log('[webhook] رابط غير صالح، token:', token.slice(0, 8) + '...');
      res.status(404).json({ error: 'رابط غير صالح أو منتهي' });
      return;
    }

    let body = req.body;
    if (typeof body !== 'object' || body === null) {
      body = {};
    }
    const raw: Payload = body as Payload;
    console.log('[webhook] استلام طلب، الحقول:', Object.keys(raw).join(', ') || '(فارغ)');

    const phoneRaw = pickPhone(raw);
    if (!phoneRaw) {
      console.log('[webhook] فشل: لم يُعثر على رقم هاتف. البيانات:', JSON.stringify(raw));
      res.status(400).json({ error: 'رقم الهاتف مطلوب في بيانات النموذج' });
      return;
    }

    const phoneNormalized = normalizePhone(phoneRaw);
    if (!phoneNormalized) {
      console.log('[webhook] فشل: رقم هاتف غير صالح:', phoneRaw);
      res.status(400).json({ error: 'رقم هاتف غير صالح' });
      return;
    }

    const name = pickName(raw);
    const email = pickEmail(raw);
    const address = pickAddress(raw);

    const status = await prisma.leadStatus.findUnique({ where: { slug: 'new' } });
    if (!status) {
      console.error('[webhook] حالة الليد الافتراضية "new" غير موجودة في قاعدة البيانات');
      res.status(500).json({ error: 'حالة الليد الافتراضية غير موجودة' });
      return;
    }

    const customer = await prisma.customer.upsert({
      where: { phone: phoneNormalized },
      update: {
        whatsapp: typeof raw.whatsapp === 'string' ? raw.whatsapp : undefined,
        email,
        address,
      },
      create: {
        phone: phoneNormalized,
        name,
        email,
        address,
      },
    });

    const assignedToId = await getNextAssignedUserId();

    const lead = await prisma.lead.create({
      data: {
        name,
        phone: phoneRaw,
        phoneNormalized,
        email,
        address,
        source: 'form',
        sourceDetail: connection.shortcode || connection.name,
        statusId: status.id,
        customerId: customer.id,
        ...(assignedToId ? { assignedToId } : {}),
      },
      include: { status: true, customer: true, assignedTo: { select: { id: true, name: true } } },
    });

    console.log('[webhook] تم إنشاء ليد:', lead.id, lead.name);
    res.status(201).json({ success: true, lead: { id: lead.id, name: lead.name } });
  } catch (err: unknown) {
    console.error('[webhook] خطأ غير متوقع:', err);
    res.status(500).json({ error: 'خطأ في معالجة النموذج' });
  }
});

export default router;
