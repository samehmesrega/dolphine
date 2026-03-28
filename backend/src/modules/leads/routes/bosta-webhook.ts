/**
 * Bosta Webhook Receiver
 * يستقبل تحديثات حالة الشحنات من بوسطة
 * الرابط يتحط يدوياً في Dashboard بوسطة
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../../db';
import { addWooCommerceOrderNote, isConfigured as isWooConfigured } from '../services/woocommerce';
import { logger } from '../../../shared/config/logger';
import { config } from '../../../shared/config';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  // دايماً نرد 200 عشان بوسطة ما تعيدش المحاولة
  try {
    // Verify webhook authentication
    if (config.bosta.webhookSecret) {
      const apiKey = req.headers['x-api-key'] as string;
      if (apiKey !== config.bosta.webhookSecret) {
        logger.warn('[Bosta Webhook] Invalid or missing x-api-key');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }

    const body = req.body;
    if (!body) {
      res.status(200).json({ received: true });
      return;
    }

    // بوسطة بتبعت الـ delivery ID و الحالة الجديدة
    const deliveryId = body._id || body.deliveryId;
    const trackingNumber = body.trackingNumber;
    const state = body.state; // { code: number, value: string }

    if (!deliveryId && !trackingNumber) {
      logger.warn('[Bosta Webhook] Received payload without deliveryId or trackingNumber');
      res.status(200).json({ received: true });
      return;
    }

    // ابحث عن الأوردر
    let order = null;
    if (deliveryId) {
      order = await prisma.order.findUnique({
        where: { bostaDeliveryId: deliveryId },
        select: { id: true, number: true, wooCommerceId: true, bostaStatus: true },
      });
    }
    if (!order && trackingNumber) {
      order = await prisma.order.findFirst({
        where: { trackingNumber },
        select: { id: true, number: true, wooCommerceId: true, bostaStatus: true },
      });
    }

    if (!order) {
      logger.warn(`[Bosta Webhook] Order not found for deliveryId=${deliveryId} trackingNumber=${trackingNumber}`);
      res.status(200).json({ received: true });
      return;
    }

    // حدّث حالة الشحنة
    const newStatus = state?.value || body.status;
    const updateData: Record<string, string> = {};

    if (newStatus && newStatus !== order.bostaStatus) {
      updateData.bostaStatus = newStatus;
    }
    if (trackingNumber) {
      updateData.trackingNumber = trackingNumber;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.order.update({
        where: { id: order.id },
        data: updateData,
      });

      // ابعت تحديث لووكومرس
      if (order.wooCommerceId && newStatus) {
        const wooConfigured = await isWooConfigured();
        if (wooConfigured) {
          await addWooCommerceOrderNote(
            order.wooCommerceId,
            `بوسطة: ${newStatus}${trackingNumber ? ` (تتبع: ${trackingNumber})` : ''}`,
          ).catch((err) => {
            logger.error({ err }, `[Bosta Webhook] Failed to add WooCommerce note for order #${order!.number}`);
          });
        }
      }

      logger.info(`[Bosta Webhook] Updated order #${order.number} → ${newStatus}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    logger.error({ err }, '[Bosta Webhook] Error processing webhook');
    // لا ترد بـ error عشان بوسطة ما تفضلش تعيد
    res.status(200).json({ received: true });
  }
});

export default router;
