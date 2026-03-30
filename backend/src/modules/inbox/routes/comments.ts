import { Router, Request, Response } from 'express';
import { prisma } from '../../../db';

const router = Router();

/**
 * GET /api/v1/inbox/comments/threads — List comment threads
 */
router.get('/threads', async (req: Request, res: Response) => {
  try {
    const { brandId, channelId, status, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
    const take = parseInt(limit as string, 10);

    const where: any = {};
    if (status) where.status = status;
    if (channelId) where.channelId = channelId;
    if (brandId) {
      where.channel = { socialPage: { brandId: brandId } };
    }

    const [threads, total] = await Promise.all([
      prisma.inboxCommentThread.findMany({
        where,
        include: {
          channel: {
            select: { id: true, platform: true, socialPage: { select: { pageName: true, brandId: true, brand: { select: { name: true } } } } },
          },
          _count: { select: { comments: true } },
        },
        orderBy: { lastCommentAt: 'desc' },
        skip,
        take,
      }),
      prisma.inboxCommentThread.count({ where }),
    ]);

    res.json({ data: threads, total, page: parseInt(page as string, 10), limit: take });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch comment threads' });
  }
});

/**
 * GET /api/v1/inbox/comments/threads/:id — Get thread with comments
 */
router.get('/threads/:id', async (req: Request, res: Response) => {
  try {
    const thread = await prisma.inboxCommentThread.findUnique({
      where: { id: String(req.params.id) },
      include: {
        channel: {
          select: { id: true, platform: true, socialPage: { select: { pageName: true, pageId: true } } },
        },
        comments: {
          include: {
            sentByUser: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    res.json(thread);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

/**
 * PUT /api/v1/inbox/comments/threads/:id/status — Close/reopen thread
 */
router.put('/threads/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const thread = await prisma.inboxCommentThread.update({
      where: { id: String(req.params.id) },
      data: { status },
    });
    res.json(thread);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update thread status' });
  }
});

/**
 * POST /api/v1/inbox/comments/:commentId/reply — Reply to comment (public)
 */
router.post('/:commentId/reply', async (req: Request, res: Response) => {
  // TODO: Implement via meta-graph.service.ts in Phase 6
  res.status(501).json({ error: 'Not implemented yet' });
});

/**
 * POST /api/v1/inbox/comments/:commentId/private-reply — Send private DM to commenter
 */
router.post('/:commentId/private-reply', async (req: Request, res: Response) => {
  // TODO: Implement via meta-graph.service.ts in Phase 6
  res.status(501).json({ error: 'Not implemented yet' });
});

/**
 * POST /api/v1/inbox/comments/:commentId/hide — Hide/unhide comment
 */
router.post('/:commentId/hide', async (req: Request, res: Response) => {
  // TODO: Implement via meta-graph.service.ts in Phase 6
  res.status(501).json({ error: 'Not implemented yet' });
});

export default router;
