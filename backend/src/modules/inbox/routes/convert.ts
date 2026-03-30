import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../db';
import { normalizePhone } from '../../../shared/utils/phone';

const router = Router();

const createLeadSchema = z.object({
  conversationId: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  address: z.string().optional(),
});

/**
 * POST /api/v1/inbox/convert/to-lead — Create lead from conversation
 */
router.post('/to-lead', async (req: Request, res: Response) => {
  try {
    const data = createLeadSchema.parse(req.body);
    const phoneNormalized = normalizePhone(data.phone);

    // Verify conversation exists
    const conversation = await prisma.inboxConversation.findUnique({
      where: { id: data.conversationId },
    });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Upsert customer by phone
    const customer = await prisma.customer.upsert({
      where: { phone: phoneNormalized },
      update: { name: data.name },
      create: {
        name: data.name,
        phone: phoneNormalized,
        email: data.email,
        address: data.address,
      },
    });

    // Get default "new" lead status
    const status = await prisma.leadStatus.findFirst({
      where: { slug: 'new' },
    });
    if (!status) {
      return res.status(500).json({ error: 'Default lead status not found' });
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        phone: data.phone,
        phoneNormalized,
        email: data.email,
        address: data.address,
        source: 'meta_inbox',
        sourceDetail: conversation.platform,
        statusId: status.id,
        customerId: customer.id,
      },
    });

    // Link conversation to lead and customer
    await prisma.inboxConversation.update({
      where: { id: data.conversationId },
      data: { leadId: lead.id, customerId: customer.id },
    });

    res.json({ lead, customer });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.issues });
    }
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

/**
 * POST /api/v1/inbox/convert/to-order — Returns redirect URL to existing CreateOrder page
 */
router.post('/to-order', async (req: Request, res: Response) => {
  try {
    const { conversationId, leadId } = req.body;

    if (!conversationId || !leadId) {
      return res.status(400).json({ error: 'conversationId and leadId required' });
    }

    // Verify conversation is linked to this lead
    const conversation = await prisma.inboxConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation || conversation.leadId !== leadId) {
      return res.status(400).json({ error: 'Conversation not linked to this lead' });
    }

    res.json({ redirectUrl: `/leads/leads/${leadId}/create-order` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to convert' });
  }
});

export default router;
