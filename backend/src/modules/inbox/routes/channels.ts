import { Router, Request, Response } from 'express';
import { prisma } from '../../../db';

const router = Router();

/**
 * GET /api/v1/inbox/channels — List inbox channels
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const channels = await prisma.inboxChannel.findMany({
      where: { isActive: true },
      include: {
        socialPage: {
          select: { id: true, platform: true, pageName: true, pageId: true, brandId: true, brand: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

/**
 * POST /api/v1/inbox/channels/:id/sync — Trigger manual sync
 */
router.post('/:id/sync', async (req: Request, res: Response) => {
  // TODO: Implement in Phase 5 (conversation-sync.service.ts)
  res.json({ message: 'Sync triggered', channelId: req.params.id });
});

/**
 * DELETE /api/v1/inbox/channels/:id — Deactivate channel
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.inboxChannel.update({
      where: { id: String(req.params.id) },
      data: { isActive: false },
    });
    res.json({ message: 'Channel deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate channel' });
  }
});

export default router;
