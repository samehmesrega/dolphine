/**
 * WooCommerce Webhook Receiver
 * يستقبل تحديثات الطلبات من ووكومرس (order.updated)
 * الرابط يتحط في WooCommerce → Settings → Advanced → Webhooks
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../../db';
import { logger } from '../../../shared/config/logger';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body || !body.id) {
      res.status(200).json({ received: true });
      return;
    }

    const wcOrderId = body.id;

    // Find order in Dolphin by WooCommerce ID
    const order = await prisma.order.findUnique({
      where: { wooCommerceId: wcOrderId },
      select: { id: true, number: true, status: true, accountsStatus: true },
    });

    if (!order) {
      logger.warn(`[WooCommerce Webhook] Order not found for wooCommerceId=${wcOrderId}`);
      res.status(200).json({ received: true });
      return;
    }

    // Sync line items — update prices and quantities, add new items
    const wcItems = body.line_items || [];
    if (wcItems.length > 0) {
      // Get current order items
      const currentItems = await prisma.orderItem.findMany({
        where: { orderId: order.id },
      });

      for (const wcItem of wcItems) {
        const matchingItem = currentItems.find(
          (item) => item.productName === wcItem.name || item.productId === String(wcItem.product_id)
        );

        if (matchingItem) {
          // Update existing item
          await prisma.orderItem.update({
            where: { id: matchingItem.id },
            data: {
              quantity: wcItem.quantity,
              price: new Decimal(wcItem.price || wcItem.subtotal / wcItem.quantity),
            },
          });
        } else {
          // New item added on WooCommerce — add to Dolphin
          await prisma.orderItem.create({
            data: {
              orderId: order.id,
              productName: wcItem.name,
              quantity: wcItem.quantity,
              price: new Decimal(wcItem.price || wcItem.subtotal / wcItem.quantity),
              notes: 'تمت الإضافة من ووكومرس',
            },
          });
        }
      }

      // Remove items that were deleted on WooCommerce
      const wcItemNames = new Set(wcItems.map((i: any) => i.name));
      for (const item of currentItems) {
        if (item.productName && !wcItemNames.has(item.productName)) {
          await prisma.orderItem.delete({ where: { id: item.id } });
        }
      }
    }

    // Sync order status from WooCommerce
    const wcStatus = body.status;
    const updateData: Record<string, any> = {};

    if (wcStatus === 'cancelled' || wcStatus === 'refunded' || wcStatus === 'failed') {
      if (order.status !== 'cancelled') {
        updateData.status = 'cancelled';
      }
    }

    // Update shipping info if changed
    if (body.shipping) {
      const s = body.shipping;
      const fullName = [s.first_name, s.last_name].filter(Boolean).join(' ');
      if (fullName) updateData.shippingName = fullName;
      if (s.address_1) updateData.shippingAddress = [s.address_1, s.address_2].filter(Boolean).join(', ');
      if (s.city) updateData.shippingCity = s.city;
      if (s.state) updateData.shippingGovernorate = s.state;
      if (s.phone) updateData.shippingPhone = s.phone;
    }

    // Update discount if changed
    if (body.discount_total && parseFloat(body.discount_total) > 0) {
      updateData.discount = new Decimal(body.discount_total);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.order.update({
        where: { id: order.id },
        data: updateData,
      });
    }

    logger.info(`[WooCommerce Webhook] Updated order #${order.number} (wcId=${wcOrderId}, items=${wcItems.length})`);
    res.status(200).json({ received: true });
  } catch (err) {
    logger.error({ err }, '[WooCommerce Webhook] Error processing webhook');
    res.status(200).json({ received: true });
  }
});

export default router;
