/**
 * Comment Sync Service
 * Pulls comments from Meta posts and stores them locally
 */

import { prisma } from '../../../db';
import { logger } from '../../../shared/config/logger';
import * as metaGraph from './meta-graph.service';

/**
 * Sync comments for a channel (initial pull or manual sync)
 */
export async function syncComments(channelId: string): Promise<number> {
  const { token, pageId } = await metaGraph.getChannelToken(channelId);
  let synced = 0;

  try {
    // Get recent posts
    const { data: posts } = await metaGraph.getPagePosts(pageId, token);

    for (const post of posts) {
      // Get comments on this post
      const { data: comments } = await metaGraph.getPostComments(post.id, token);
      if (!comments.length) continue;

      // Upsert comment thread
      const thread = await prisma.inboxCommentThread.upsert({
        where: { channelId_postPlatformId: { channelId, postPlatformId: post.id } },
        update: {
          postUrl: post.permalink_url,
          postCaption: post.message?.substring(0, 500),
          lastCommentAt: comments[0]?.created_time ? new Date(comments[0].created_time) : undefined,
        },
        create: {
          channelId,
          postPlatformId: post.id,
          postUrl: post.permalink_url,
          postCaption: post.message?.substring(0, 500),
          lastCommentAt: comments[0]?.created_time ? new Date(comments[0].created_time) : new Date(),
        },
      });

      // Upsert each comment
      for (const comment of comments) {
        await prisma.inboxComment.upsert({
          where: { threadId_platformId: { threadId: thread.id, platformId: comment.id } },
          update: {
            content: comment.message,
            isHidden: comment.is_hidden || false,
          },
          create: {
            threadId: thread.id,
            platformId: comment.id,
            parentCommentId: comment.parent?.id || null,
            direction: comment.from?.id === pageId ? 'outbound' : 'inbound',
            authorId: comment.from?.id,
            authorName: comment.from?.name,
            content: comment.message,
            attachmentUrl: comment.attachment?.url || null,
            platformTimestamp: comment.created_time ? new Date(comment.created_time) : new Date(),
            isHidden: comment.is_hidden || false,
          },
        });
      }

      synced++;
    }

    await prisma.inboxChannel.update({
      where: { id: channelId },
      data: { lastSyncAt: new Date() },
    });

    logger.info(`[Inbox Sync] Synced comments on ${synced} posts for channel ${channelId}`);
  } catch (err) {
    logger.error({ err }, `[Inbox Sync] Failed to sync comments for channel ${channelId}`);
    throw err;
  }

  return synced;
}

/**
 * Process incoming comment from webhook
 */
export async function processIncomingComment(
  pageId: string,
  postId: string,
  commentData: {
    comment_id: string;
    message: string;
    from: { id: string; name: string };
    created_time: number;
    parent_id?: string;
  }
): Promise<void> {
  // Find the channel by page ID
  const channel = await prisma.inboxChannel.findFirst({
    where: {
      isActive: true,
      socialPage: { pageId },
      platform: { in: ['facebook_comments', 'instagram_comments'] },
    },
  });

  if (!channel) {
    logger.warn(`[Inbox Webhook] No comment channel found for page ${pageId}`);
    return;
  }

  // Find or create thread
  let thread = await prisma.inboxCommentThread.findUnique({
    where: { channelId_postPlatformId: { channelId: channel.id, postPlatformId: postId } },
  });

  if (!thread) {
    thread = await prisma.inboxCommentThread.create({
      data: {
        channelId: channel.id,
        postPlatformId: postId,
        lastCommentAt: new Date(commentData.created_time * 1000),
      },
    });
  }

  // Upsert comment
  await prisma.inboxComment.upsert({
    where: { threadId_platformId: { threadId: thread.id, platformId: commentData.comment_id } },
    update: { content: commentData.message },
    create: {
      threadId: thread.id,
      platformId: commentData.comment_id,
      parentCommentId: commentData.parent_id || null,
      direction: commentData.from.id === pageId ? 'outbound' : 'inbound',
      authorId: commentData.from.id,
      authorName: commentData.from.name,
      content: commentData.message,
      platformTimestamp: new Date(commentData.created_time * 1000),
    },
  });

  // Update thread lastCommentAt
  await prisma.inboxCommentThread.update({
    where: { id: thread.id },
    data: { lastCommentAt: new Date(commentData.created_time * 1000), status: 'open' },
  });
}
