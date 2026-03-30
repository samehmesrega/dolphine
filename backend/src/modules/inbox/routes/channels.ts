import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../../db';
import * as metaGraph from '../services/meta-graph.service';

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
 * GET /api/v1/inbox/channels/oauth/meta — Get OAuth URL for messaging permissions
 */
router.get('/oauth/meta', (_req: Request, res: Response) => {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    const url = metaGraph.getInboxOAuthUrl(state);
    res.json({ url, state });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate OAuth URL' });
  }
});

/**
 * POST /api/v1/inbox/channels/oauth/meta/callback — Exchange code for token, list available pages
 */
router.post('/oauth/meta/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Authorization code required' });

    // Exchange code for short-lived token
    const { accessToken: shortToken } = await metaGraph.exchangeCodeForToken(code);

    // Convert to long-lived user token
    const { accessToken: longToken } = await metaGraph.getLongLivedToken(shortToken);

    // Fetch pages with their Page Access Tokens + linked Instagram accounts
    const pages = await metaGraph.fetchUserPages(longToken);

    res.json({
      pages: pages.map((p) => ({
        id: p.id,
        name: p.name,
        hasInstagram: !!p.instagramBusinessAccountId,
        instagramId: p.instagramBusinessAccountId,
      })),
      // We'll need the long-lived token to get page tokens during connect
      _token: longToken,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'OAuth callback failed' });
  }
});

/**
 * POST /api/v1/inbox/channels/oauth/meta/connect — Connect selected pages
 */
router.post('/oauth/meta/connect', async (req: Request, res: Response) => {
  try {
    const { pages, token, brandId } = req.body;
    // pages: [{ pageId, pageName, instagramBusinessAccountId? }]
    // token: long-lived user token to fetch page tokens

    if (!pages?.length || !token || !brandId) {
      return res.status(400).json({ error: 'pages, token, and brandId required' });
    }

    // Fetch fresh page tokens from the user token
    const userPages = await metaGraph.fetchUserPages(token);
    const allChannels: any[] = [];

    for (const selected of pages) {
      const pageData = userPages.find((p) => p.id === selected.pageId);
      if (!pageData) continue;

      const result = await metaGraph.connectPageToInbox({
        pageId: pageData.id,
        pageName: pageData.name,
        accessToken: pageData.accessToken, // Page Access Token (permanent)
        brandId,
        instagramBusinessAccountId: pageData.instagramBusinessAccountId,
      });

      allChannels.push(...result.channels);
    }

    res.json({ channels: allChannels, count: allChannels.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to connect pages' });
  }
});

/**
 * POST /api/v1/inbox/channels/:id/sync — Trigger manual sync
 */
router.post('/:id/sync', async (req: Request, res: Response) => {
  // TODO: Implement full sync in Phase 5 (conversation-sync.service.ts)
  res.json({ message: 'Sync triggered', channelId: String(req.params.id) });
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
