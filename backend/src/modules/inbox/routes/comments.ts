import { Router, Request, Response } from 'express';
import { prisma } from '../../../db';
import * as metaGraph from '../services/meta-graph.service';

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
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

    const commentId = String(req.params.commentId);
    const userId = (req as any).user?.userId;

    // Get the comment and its channel token
    const comment = await prisma.inboxComment.findUnique({
      where: { id: commentId },
      include: { thread: { include: { channel: true } } },
    });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const { token } = await metaGraph.getChannelToken(comment.thread.channelId);

    // Reply via Meta API
    const result = await metaGraph.replyToComment(comment.platformId, text, token);

    // Save reply locally
    const reply = await prisma.inboxComment.create({
      data: {
        threadId: comment.threadId,
        platformId: result.id || `reply_${Date.now()}`,
        parentCommentId: comment.platformId,
        direction: 'outbound',
        content: text,
        sentByUserId: userId,
        platformTimestamp: new Date(),
      },
      include: { sentByUser: { select: { id: true, name: true } } },
    });

    res.json(reply);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reply to comment' });
  }
});

/**
 * POST /api/v1/inbox/comments/:commentId/private-reply — Send private DM to commenter
 */
router.post('/:commentId/private-reply', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

    const commentId = String(req.params.commentId);
    const userId = (req as any).user?.userId;

    const comment = await prisma.inboxComment.findUnique({
      where: { id: commentId },
      include: { thread: { include: { channel: true } } },
    });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (!comment.authorId) return res.status(400).json({ error: 'Comment author unknown' });

    const { token } = await metaGraph.getChannelToken(comment.thread.channelId);

    // Send private reply via Meta API (1 per comment only)
    await metaGraph.sendPrivateReply(comment.platformId, text, token);

    // Create/find conversation with this user
    let conversation = await prisma.inboxConversation.findFirst({
      where: { channelId: comment.thread.channelId, participantId: comment.authorId },
    });

    if (!conversation) {
      // Find the messaging channel for this page (messenger or instagram_dm)
      const msgChannel = await prisma.inboxChannel.findFirst({
        where: {
          socialPage: { id: comment.thread.channel.socialPageId },
          platform: { in: ['messenger', 'instagram_dm'] },
          isActive: true,
        },
      });

      const channelForConv = msgChannel || comment.thread.channel;
      const platform = msgChannel?.platform === 'instagram_dm' ? 'instagram_dm' : 'messenger';

      conversation = await prisma.inboxConversation.create({
        data: {
          channelId: channelForConv.id,
          platform,
          platformId: `priv_${comment.platformId}`,
          participantId: comment.authorId,
          participantName: comment.authorName,
          lastMessageAt: new Date(),
        },
      });
    }

    // Save outbound message in the conversation
    await prisma.inboxMessage.create({
      data: {
        conversationId: conversation.id,
        platformId: `priv_reply_${Date.now()}`,
        direction: 'outbound',
        content: text,
        contentType: 'text',
        sentByUserId: userId,
        deliveryStatus: 'sent',
        platformTimestamp: new Date(),
      },
    });

    res.json({ message: 'Private reply sent', conversationId: conversation.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send private reply' });
  }
});

/**
 * POST /api/v1/inbox/comments/:commentId/hide — Hide/unhide comment
 */
router.post('/:commentId/hide', async (req: Request, res: Response) => {
  try {
    const commentId = String(req.params.commentId);

    const comment = await prisma.inboxComment.findUnique({
      where: { id: commentId },
      include: { thread: { include: { channel: true } } },
    });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const { token } = await metaGraph.getChannelToken(comment.thread.channelId);
    const newHidden = !comment.isHidden;

    // Toggle visibility via Meta API
    await metaGraph.hideComment(comment.platformId, newHidden, token);

    // Update locally
    const updated = await prisma.inboxComment.update({
      where: { id: commentId },
      data: { isHidden: newHidden },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to hide/unhide comment' });
  }
});

export default router;
