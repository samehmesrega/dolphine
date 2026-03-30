import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../../../shared/config';
import { logger } from '../../../shared/config/logger';
import { prisma } from '../../../db';
import { processIncomingMessage } from '../services/conversation-sync.service';
import { processIncomingComment } from '../services/comment-sync.service';

const router = Router();

/**
 * GET /api/webhooks/meta — Meta webhook verification challenge
 */
router.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.meta.webhookVerifyToken) {
    logger.info('Meta webhook verified');
    return res.status(200).send(challenge);
  }

  logger.warn('[Meta Webhook] Verification failed');
  return res.status(403).send('Forbidden');
});

/**
 * POST /api/webhooks/meta — Receive webhook events from Meta
 * Body arrives as raw Buffer (via express.raw() middleware in index.ts)
 */
router.post('/', async (req: Request, res: Response) => {
  // Always respond 200 immediately — Meta retries on timeout
  res.status(200).send('EVENT_RECEIVED');

  try {
    const rawBody = req.body as Buffer;
    const signature = req.headers['x-hub-signature-256'] as string;

    // Verify signature
    if (!verifySignature(rawBody, signature)) {
      logger.warn('Meta webhook: invalid signature');
      return;
    }

    const payload = JSON.parse(rawBody.toString('utf8'));

    // Log the webhook event
    await prisma.inboxWebhookLog.create({
      data: {
        source: payload.object || 'unknown',
        event: extractEventType(payload),
        payload: payload,
        processed: false,
      },
    });

    // Process asynchronously
    processWebhookPayload(payload).catch((err) => {
      logger.error({ err }, '[Meta Webhook] Processing error');
    });
  } catch (err) {
    logger.error({ err }, '[Meta Webhook] Handler error');
  }
});

/**
 * POST /api/webhooks/meta/data-deletion — Meta data deletion callback
 */
router.post('/data-deletion', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Buffer;
    const signature = req.headers['x-hub-signature-256'] as string;

    if (!verifySignature(rawBody, signature)) {
      return res.status(403).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    const userId = payload?.signed_request ? 'meta_user' : 'unknown';

    // Delete user data from inbox tables
    // In practice, we'd parse the signed_request to get the actual user ID
    // and delete their specific conversations/messages
    const confirmationCode = crypto.randomUUID();

    logger.info(`[Meta Webhook] Data deletion request: ${confirmationCode}`);

    return res.json({
      url: `${config.appUrl}/api/webhooks/meta/data-deletion/status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (err) {
    logger.error({ err }, '[Meta Webhook] Data deletion error');
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * Verify Meta webhook signature using HMAC-SHA256
 */
function verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature || !config.meta.appSecret) return false;

  const expectedSignature =
    'sha256=' +
    crypto.createHmac('sha256', config.meta.appSecret).update(rawBody).digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Extract event type from webhook payload for logging
 */
function extractEventType(payload: any): string {
  if (payload.entry?.[0]?.messaging) return 'message';
  if (payload.entry?.[0]?.changes?.[0]?.field === 'feed') return 'comment';
  if (payload.entry?.[0]?.changes?.[0]?.field === 'comments') return 'ig_comment';
  return 'unknown';
}

/**
 * Process webhook payload asynchronously
 * TODO: Implement full processing in Phase 5/6
 */
async function processWebhookPayload(payload: any): Promise<void> {
  const object = payload.object; // "page" or "instagram"

  for (const entry of payload.entry || []) {
    const pageId = entry.id;

    // Messenger / Instagram DM messages
    if (entry.messaging) {
      for (const event of entry.messaging) {
        if (event.message) {
          logger.info(`[Meta Webhook] Incoming message from ${event.sender?.id} on page ${pageId}`);
          await processIncomingMessage(pageId, event.sender.id, event.message, event.timestamp || Date.now());
        }
        if (event.delivery) {
          logger.info(`[Meta Webhook] Delivery update on page ${pageId}`);
          // TODO: Update message delivery status
        }
        if (event.read) {
          logger.info(`[Meta Webhook] Read receipt on page ${pageId}`);
          // TODO: Update message read status
        }
      }
    }

    // Facebook/Instagram comments
    if (entry.changes) {
      for (const change of entry.changes) {
        if (change.field === 'feed' && change.value?.item === 'comment') {
          logger.info(`[Meta Webhook] Incoming comment on page ${pageId}`);
          await processIncomingComment(pageId, change.value.post_id, {
            comment_id: change.value.comment_id,
            message: change.value.message || '',
            from: { id: change.value.from?.id || '', name: change.value.from?.name || '' },
            created_time: change.value.created_time || Math.floor(Date.now() / 1000),
            parent_id: change.value.parent_id,
          });
        }
      }
    }
  }

  // Mark webhook as processed
  // The specific webhook log will be updated when full processing is implemented
}

export default router;
