import { Router, Request, Response } from 'express';
import { prisma } from '../../../db';

const router = Router();

/**
 * GET /api/v1/inbox/conversations — List conversations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { brandId, channelId, status, assignedTo, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
    const take = parseInt(limit as string, 10);

    const where: any = {};
    if (status) where.status = status;
    if (assignedTo) where.assignedToId = assignedTo;
    if (channelId) where.channelId = channelId;
    if (brandId) {
      where.channel = { socialPage: { brandId: brandId } };
    }

    const [conversations, total] = await Promise.all([
      prisma.inboxConversation.findMany({
        where,
        include: {
          channel: {
            select: { id: true, platform: true, socialPage: { select: { pageName: true, brandId: true, brand: { select: { name: true } } } } },
          },
          assignedTo: { select: { id: true, name: true } },
          lead: { select: { id: true, name: true, phone: true } },
          customer: { select: { id: true, name: true, phone: true } },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { content: true, contentType: true, direction: true, createdAt: true },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take,
      }),
      prisma.inboxConversation.count({ where }),
    ]);

    res.json({ data: conversations, total, page: parseInt(page as string, 10), limit: take });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * GET /api/v1/inbox/conversations/:id — Get conversation detail
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const conversation = await prisma.inboxConversation.findUnique({
      where: { id: String(req.params.id) },
      include: {
        channel: {
          select: { id: true, platform: true, socialPage: { select: { pageName: true, pageId: true, brandId: true, brand: { select: { name: true } } } } },
        },
        assignedTo: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true, phone: true, statusId: true, status: { select: { name: true, slug: true } } } },
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    // Auto-reset unread count when viewed
    if (conversation.unreadCount > 0) {
      await prisma.inboxConversation.update({
        where: { id: String(req.params.id) },
        data: { unreadCount: 0 },
      });
    }

    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * GET /api/v1/inbox/conversations/:id/messages — Paginated messages (cursor-based)
 */
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { before, limit = '30' } = req.query;
    const take = parseInt(limit as string, 10);

    const where: any = { conversationId: String(req.params.id) };
    if (before) {
      where.createdAt = { lt: new Date(before as string) };
    }

    const messages = await prisma.inboxMessage.findMany({
      where,
      include: {
        sentByUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    // Return in chronological order (oldest first)
    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/v1/inbox/conversations/:id/messages — Send a message
 */
router.post('/:id/messages', async (req: Request, res: Response) => {
  // TODO: Implement sending via meta-graph.service.ts in Phase 5
  res.status(501).json({ error: 'Not implemented yet' });
});

/**
 * PUT /api/v1/inbox/conversations/:id/assign — Assign to user
 */
router.put('/:id/assign', async (req: Request, res: Response) => {
  try {
    const { assignedToId } = req.body;
    const conversation = await prisma.inboxConversation.update({
      where: { id: String(req.params.id) },
      data: { assignedToId },
    });
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign conversation' });
  }
});

/**
 * PUT /api/v1/inbox/conversations/:id/status — Change status
 */
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body; // "open" | "closed" | "snoozed"
    const conversation = await prisma.inboxConversation.update({
      where: { id: String(req.params.id) },
      data: { status },
    });
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

/**
 * PUT /api/v1/inbox/conversations/:id/link — Link to lead/customer
 */
router.put('/:id/link', async (req: Request, res: Response) => {
  try {
    const { leadId, customerId } = req.body;
    const conversation = await prisma.inboxConversation.update({
      where: { id: String(req.params.id) },
      data: { leadId: leadId || undefined, customerId: customerId || undefined },
    });
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: 'Failed to link conversation' });
  }
});

/**
 * PUT /api/v1/inbox/conversations/:id/read — Reset unread count
 */
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    await prisma.inboxConversation.update({
      where: { id: String(req.params.id) },
      data: { unreadCount: 0 },
    });
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

export default router;
