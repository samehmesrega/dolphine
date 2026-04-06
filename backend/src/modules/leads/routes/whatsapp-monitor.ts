/**
 * WhatsApp Chat Monitor — استقبال وتخزين محادثات واتساب من Chrome Extension
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../db';
import { AuthRequest } from '../../../shared/middleware/auth';
import { normalizePhone } from '../../../shared/utils/phone';

const router = Router();

// ===== GET /check-lead?phone=+201xxxxx — مطابقة رقم بليد =====
router.get('/check-lead', async (req: AuthRequest, res: Response) => {
  try {
    const phone = req.query.phone as string;
    if (!phone) {
      res.status(400).json({ matched: false, error: 'phone مطلوب' });
      return;
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      res.json({ matched: false });
      return;
    }

    const lead = await prisma.lead.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { phoneNormalized: normalized },
          { whatsapp: normalized },
          { phone: { contains: phone.replace(/[\s\-\(\)\+]/g, '').slice(-10) } },
        ],
      },
      select: { id: true, name: true, phone: true, assignedToId: true },
    });

    if (lead) {
      res.json({ matched: true, leadId: lead.id, leadName: lead.name });
    } else {
      res.json({ matched: false });
    }
  } catch (err) {
    console.error('[whatsapp-monitor/check-lead]', err);
    res.status(500).json({ matched: false, error: 'خطأ في البحث' });
  }
});

// ===== POST /sessions — استقبال الشات من الإكستنشن =====
const sessionSchema = z.object({
  leadId: z.string().uuid(),
  phoneNumber: z.string(),
  messages: z.array(z.object({
    text: z.string(),
    timestamp: z.string(),
    direction: z.enum(['in', 'out']),
  })),
  chatStartedAt: z.string(),
  chatEndedAt: z.string(),
});

router.post('/sessions', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'غير مصرح' });
      return;
    }

    const parsed = sessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات غير صالحة', details: parsed.error.flatten() });
      return;
    }

    const { leadId, phoneNumber, messages, chatStartedAt, chatEndedAt } = parsed.data;

    // Verify lead exists
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) {
      res.status(404).json({ error: 'الليد غير موجود' });
      return;
    }

    const session = await prisma.whatsappChatSession.create({
      data: {
        leadId,
        agentId: req.user.userId,
        phoneNumber,
        messages,
        messageCount: messages.length,
        chatStartedAt: new Date(chatStartedAt),
        chatEndedAt: new Date(chatEndedAt),
      },
    });

    res.status(201).json({
      session: { id: session.id, messageCount: session.messageCount, createdAt: session.createdAt },
    });
  } catch (err) {
    console.error('[whatsapp-monitor/sessions]', err);
    res.status(500).json({ error: 'خطأ في حفظ المحادثة' });
  }
});

// ===== GET /leads/:leadId/sessions — كل sessions الشات لليد =====
router.get('/leads/:leadId/sessions', async (req: AuthRequest, res: Response) => {
  try {
    const leadId = String(req.params.leadId);
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const pageSize = Math.min(50, parseInt(String(req.query.pageSize || '10')));

    const [total, sessions] = await prisma.$transaction([
      prisma.whatsappChatSession.count({ where: { leadId } }),
      prisma.whatsappChatSession.findMany({
        where: { leadId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          agent: { select: { id: true, name: true } },
        },
      }),
    ]);

    res.json({ total, page, pageSize, sessions });
  } catch (err) {
    console.error('[whatsapp-monitor/lead-sessions]', err);
    res.status(500).json({ error: 'خطأ في تحميل المحادثات' });
  }
});

export default router;
