/**
 * Conversation Sync Service
 * Pulls conversations and messages from Meta API and stores them locally
 */

import { prisma } from '../../../db';
import { logger } from '../../../shared/config/logger';
import * as metaGraph from './meta-graph.service';

/**
 * Sync all conversations for a channel (initial pull or manual sync)
 */
export async function syncConversations(channelId: string): Promise<number> {
  const { token, pageId, platform } = await metaGraph.getChannelToken(channelId);
  let synced = 0;

  try {
    let after: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const { data: conversations, paging } = await metaGraph.getConversations(pageId, token, after);

      for (const conv of conversations) {
        // Extract participant (the non-page user)
        const participant = conv.participants?.data?.find((p: any) => p.id !== pageId);
        if (!participant) continue;

        // Upsert conversation
        const conversation = await prisma.inboxConversation.upsert({
          where: { channelId_platformId: { channelId, platformId: conv.id } },
          update: {
            participantName: participant.name,
            lastMessageAt: conv.updated_time ? new Date(conv.updated_time) : undefined,
          },
          create: {
            channelId,
            platform: platform === 'messenger' ? 'messenger' : 'instagram_dm',
            platformId: conv.id,
            participantId: participant.id,
            participantName: participant.name,
            lastMessageAt: conv.updated_time ? new Date(conv.updated_time) : new Date(),
          },
        });

        // Sync messages for this conversation
        await syncMessages(conversation.id, conv.id, token);
        synced++;
      }

      // Pagination
      after = paging?.cursors?.after;
      hasMore = !!paging?.next && !!after;
    }

    // Update channel lastSyncAt
    await prisma.inboxChannel.update({
      where: { id: channelId },
      data: { lastSyncAt: new Date() },
    });

    logger.info(`[Inbox Sync] Synced ${synced} conversations for channel ${channelId}`);
  } catch (err) {
    logger.error({ err }, `[Inbox Sync] Failed to sync conversations for channel ${channelId}`);
    throw err;
  }

  return synced;
}

/**
 * Sync messages for a single conversation
 */
async function syncMessages(conversationId: string, platformConvId: string, token: string): Promise<void> {
  try {
    const { data: messages } = await metaGraph.getConversationMessages(platformConvId, token);

    for (const msg of messages) {
      // Determine content type from attachments
      let contentType = 'text';
      let attachments: any[] | null = null;

      if (msg.attachments?.data?.length) {
        const att = msg.attachments.data[0];
        if (att.image_data) contentType = 'image';
        else if (att.video_data) contentType = 'video';
        else if (att.file_url) contentType = 'file';

        // TODO: Download attachment and upload to R2 — for now store Meta URLs
        attachments = msg.attachments.data.map((a: any) => ({
          type: a.mime_type || contentType,
          url: a.image_data?.url || a.video_data?.url || a.file_url || null,
          name: a.name,
          size: a.size,
        }));
      }

      await prisma.inboxMessage.upsert({
        where: { conversationId_platformId: { conversationId, platformId: msg.id } },
        update: {},
        create: {
          conversationId,
          platformId: msg.id,
          direction: 'inbound', // Will be refined when we know the page ID
          senderId: msg.from?.id,
          senderName: msg.from?.name,
          content: msg.message || null,
          contentType,
          attachments: attachments || undefined,
          platformTimestamp: msg.created_time ? new Date(msg.created_time) : new Date(),
        },
      });
    }
  } catch (err) {
    logger.error({ err }, `[Inbox Sync] Failed to sync messages for conversation ${conversationId}`);
  }
}

/**
 * Process an incoming message webhook event
 */
export async function processIncomingMessage(
  pageId: string,
  senderId: string,
  message: any,
  timestamp: number
): Promise<void> {
  // Find the channel by page ID
  const channel = await prisma.inboxChannel.findFirst({
    where: {
      isActive: true,
      socialPage: { pageId },
      platform: { in: ['messenger', 'instagram_dm'] },
    },
    include: { socialPage: true },
  });

  if (!channel) {
    logger.warn(`[Inbox Webhook] No active channel found for page ${pageId}`);
    return;
  }

  // Find or create conversation
  // Meta uses the conversation thread ID, but webhook gives us sender PSID
  // We'll use sender+channel as the lookup
  let conversation = await prisma.inboxConversation.findFirst({
    where: { channelId: channel.id, participantId: senderId },
  });

  if (!conversation) {
    conversation = await prisma.inboxConversation.create({
      data: {
        channelId: channel.id,
        platform: channel.platform === 'messenger' ? 'messenger' : 'instagram_dm',
        platformId: `conv_${senderId}_${Date.now()}`, // temporary, updated on next sync
        participantId: senderId,
        lastMessageAt: new Date(timestamp),
      },
    });
  }

  // Determine content type
  let contentType = 'text';
  let attachments: any[] | null = null;

  if (message.attachments?.length) {
    const att = message.attachments[0];
    contentType = att.type || 'file';
    attachments = message.attachments.map((a: any) => ({
      type: a.type,
      url: a.payload?.url,
    }));
  }

  // Create message
  const msgPlatformId = message.mid || `msg_${Date.now()}`;

  await prisma.inboxMessage.upsert({
    where: { conversationId_platformId: { conversationId: conversation.id, platformId: msgPlatformId } },
    update: {},
    create: {
      conversationId: conversation.id,
      platformId: msgPlatformId,
      direction: 'inbound',
      senderId,
      content: message.text || null,
      contentType,
      attachments: attachments || undefined,
      platformTimestamp: new Date(timestamp),
    },
  });

  // Update conversation
  await prisma.inboxConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(timestamp),
      unreadCount: { increment: 1 },
      status: 'open', // re-open if was closed/snoozed
    },
  });
}
