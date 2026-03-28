import { Router, Request, Response } from 'express';
import { prisma } from '../../../db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { uploadSingle } from '../../../shared/middleware/upload';
import { normalizePhone } from '../../../shared/utils/phone';
import { AuthRequest } from '../../../shared/middleware/auth';
import { createWooCommerceOrder, isConfigured as isWooConfigured, addWooCommerceOrderNote, updateWooCommerceOrderStatus } from '../services/woocommerce';
import { createBostaDelivery, isConfigured as isBostaConfigured, terminateDelivery } from '../services/bosta';
import { auditLog } from '../services/audit';

const router = Router();

const orderItemSchema = z.object({
  productId: z.string().uuid().optional(),
  productName: z.string().min(1).optional(),
  variation: z.record(z.string(), z.any()).optional(),
  quantity: z.number().int().min(1),
  price: z.number().min(0),
  notes: z.string().optional(),
}).refine((d) => d.productId || d.productName, { message: 'أدخل المنتج أو اسم المنتج' });

const createOrderSchema = z.object({
  leadId: z.string().uuid(),
  shippingName: z.string().min(1),
  shippingPhone: z.string().min(6),
  shippingGovernorate: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingAddress: z.string().optional(),
  notes: z.string().optional(),
  paymentType: z.enum(['full', 'partial']),
  discount: z.coerce.number().min(0).optional().default(0),
  discountReason: z.string().optional(),
  partialAmount: z.coerce.number().min(0).optional().default(0),
  items: z.array(orderItemSchema).min(1),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const accountsStatus = typeof req.query.accountsStatus === 'string' ? req.query.accountsStatus : undefined;
    const leadId = typeof req.query.leadId === 'string' ? req.query.leadId : undefined;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize), 10) || 20));

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (accountsStatus) where.accountsStatus = accountsStatus;
    if (leadId) where.leadId = leadId;
    const [total, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          lead: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, phone: true } },
          orderItems: { include: { product: { select: { id: true, name: true } } } },
        },
      }),
    ]);

    res.json({ total, page, pageSize, orders });
  } catch (err: unknown) {
    console.error('Orders list error:', err);
    res.status(500).json({ error: 'خطأ في تحميل قائمة الطلبات' });
  }
});

router.post('/', uploadSingle, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (typeof body.items === 'string') {
      try {
        body.items = JSON.parse(body.items);
      } catch {
        res.status(400).json({ error: 'عناصر الطلب غير صحيحة' });
        return;
      }
    }

    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
      return;
    }

    const { leadId, shippingName, shippingPhone, shippingGovernorate, shippingCity, shippingAddress, notes, paymentType, discount, discountReason, partialAmount, items } = parsed.data;

    let leadCustomerId: string | null = null;
    const foundLead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { customer: true },
    });
    if (!foundLead) {
      res.status(404).json({ error: 'الليد غير موجود' });
      return;
    }

    // Prevent duplicate orders — one active order per lead
    const existingOrder = await prisma.order.findFirst({
      where: { leadId, deletedAt: null },
    });
    if (existingOrder) {
      res.status(409).json({ error: 'هذا الليد لديه طلب بالفعل. احذف الطلب الأول لإنشاء طلب جديد.' });
      return;
    }

    // إذا الليد ما له عميل مربوط، نربطه تلقائياً حسب رقم الفون
    if (!foundLead.customerId) {
      const phoneNorm = foundLead.phoneNormalized || normalizePhone(foundLead.phone);
      if (!phoneNorm) {
        res.status(400).json({ error: 'رقم جوال الليد غير صالح لربط عميل' });
        return;
      }
      const customer = await prisma.customer.upsert({
        where: { phone: phoneNorm },
        update: {
          name: foundLead.name,
          whatsapp: foundLead.whatsapp ?? undefined,
          email: foundLead.email ?? undefined,
          address: foundLead.address ?? undefined,
        },
        create: {
          phone: phoneNorm,
          name: foundLead.name,
          whatsapp: foundLead.whatsapp,
          email: foundLead.email,
          address: foundLead.address,
        },
      });
      await prisma.lead.update({ where: { id: leadId }, data: { customerId: customer.id } });
      leadCustomerId = customer.id;
    } else {
      leadCustomerId = foundLead.customerId;
    }

    const transferImage = (req as Request & { file?: { filename: string } }).file?.filename ?? undefined;

    // New fields from body
    const senderPhone = typeof body.senderPhone === 'string' ? body.senderPhone.trim() || undefined : undefined;
    const noTransferImage = body.noTransferImage === 'true' || body.noTransferImage === true;
    const noImageReason = typeof body.noImageReason === 'string' ? body.noImageReason.trim() || undefined : undefined;

    const order = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.create({
        data: {
          leadId,
          customerId: leadCustomerId!,
          status: 'active',
          accountsStatus: 'pending',
          paymentType,
          transferImage,
          senderPhone,
          noTransferImage,
          noImageReason,
          shippingName,
          shippingPhone,
          shippingGovernorate: shippingGovernorate || undefined,
          shippingCity: shippingCity || undefined,
          shippingAddress: shippingAddress || undefined,
          notes: notes || undefined,
          discount: discount ?? 0,
          discountReason: discountReason || undefined,
          partialAmount: partialAmount ?? 0,
        },
      });

      for (const it of items) {
        const productId = it.productId || undefined;
        if (productId) {
          const product = await tx.product.findUnique({ where: { id: productId } });
          if (!product) {
            throw new Error(`المنتج غير موجود: ${productId}`);
          }
        }
        const itemData: Prisma.OrderItemUncheckedCreateInput = {
          orderId: ord.id,
          quantity: it.quantity,
          price: it.price,
          variation: (it.variation as Prisma.InputJsonValue) ?? undefined,
          notes: it.notes ?? undefined,
        };
        if (productId) itemData.productId = productId;
        else itemData.productName = it.productName ?? undefined;
        await tx.orderItem.create({ data: itemData });
      }

      return tx.order.findUnique({
        where: { id: ord.id },
        include: {
          lead: { include: { assignedTo: { select: { name: true } } } },
          customer: true,
          orderItems: { include: { product: true } },
        },
      });
    });

    if (!order) {
      res.status(500).json({ error: 'فشل إنشاء الطلب' });
      return;
    }

    // Push to WooCommerce + Bosta IMMEDIATELY after order creation
    let currentOrder = order;

    // 1) Push to WooCommerce
    const wooConfigured = await isWooConfigured();
    if (wooConfigured) {
      try {
        const nameParts = currentOrder.shippingName.trim().split(/\s+/);
        const wooFirstName = nameParts[0] || currentOrder.shippingName;
        const wooLastName = nameParts.slice(1).join(' ') || '';
        const wooLineItems = currentOrder.orderItems.map((item: { product?: { wooCommerceId?: number | null } | null; productName: string | null; quantity: number; price: unknown }) => {
          const wcId = item.product?.wooCommerceId;
          const itemTotal = String(Number(item.price) * item.quantity);
          const unitPrice = String(item.price);
          if (wcId) return { product_id: wcId, quantity: item.quantity, subtotal: itemTotal, total: itemTotal, price: unitPrice };
          return { name: item.productName || 'منتج', quantity: item.quantity, subtotal: itemTotal, total: itemTotal, price: unitPrice };
        });

        // Customer note
        const customerNoteLines: string[] = [];
        for (const item of currentOrder.orderItems) {
          const productLabel = (item as { productName?: string | null; product?: { name?: string } | null }).productName || (item as { product?: { name?: string } | null }).product?.name || 'منتج';
          customerNoteLines.push(`📦 ${productLabel}`);
          if ((item as { notes?: string | null }).notes?.trim()) {
            customerNoteLines.push(`   ملاحظة: ${(item as { notes?: string | null }).notes!.trim()}`);
          }
        }

        // Internal note
        const salesName = currentOrder.lead?.assignedTo?.name || '—';
        const totalPrice = currentOrder.orderItems.reduce((sum: number, i: { price: unknown; quantity: number }) => sum + Number(i.price) * i.quantity, 0);
        const discountVal = Number(currentOrder.discount) || 0;
        const finalTotal = totalPrice - discountVal;
        const paidAmount = currentOrder.paymentType === 'full' ? finalTotal : (Number(currentOrder.partialAmount) || 0);
        const remaining = finalTotal - paidAmount;
        const internalNoteLines = [
          `🔹 السيلز: ${salesName}`,
          `🔹 المبلغ المدفوع: ${paidAmount} EGP`,
          `🔹 المبلغ المتبقي: ${remaining} EGP`,
        ];
        if (currentOrder.notes?.trim()) internalNoteLines.push(`🔹 ملاحظات: ${currentOrder.notes.trim()}`);
        internalNoteLines.push('', 'تم الرفع من خلال دولفين ليدز — بانتظار مراجعة الحسابات');

        const wooId = await createWooCommerceOrder({
          billing: { first_name: wooFirstName, last_name: wooLastName, address_1: currentOrder.shippingAddress || undefined, phone: currentOrder.shippingPhone },
          shipping: { first_name: wooFirstName, last_name: wooLastName, address_1: currentOrder.shippingAddress || undefined },
          line_items: wooLineItems,
          payment_method: 'cod',
          payment_method_title: currentOrder.paymentType === 'full' ? 'دفع كامل' : 'دفع جزئي',
          set_paid: false,
          status: 'processing',
          customer_note: customerNoteLines.length > 0 ? customerNoteLines.join('\n') : undefined,
        }, internalNoteLines.join('\n'));

        await prisma.order.update({ where: { id: order.id }, data: { wooCommerceId: wooId } });
        currentOrder = { ...currentOrder, wooCommerceId: wooId } as typeof currentOrder;
        console.log(`[Auto WooCommerce] Order #${currentOrder.number} → WC #${wooId}`);
      } catch (wooErr) {
        console.error('[Auto WooCommerce] Failed:', wooErr instanceof Error ? wooErr.message : wooErr);
      }
    }

    // 2) Push to Bosta
    const bostaEnabled = await isBostaConfigured();
    if (bostaEnabled) {
      try {
        const bostaResult = await createBostaDelivery(currentOrder);
        await prisma.order.update({
          where: { id: order.id },
          data: {
            bostaDeliveryId: bostaResult.deliveryId,
            trackingNumber: bostaResult.trackingNumber,
            bostaStatus: 'Pickup requested',
          },
        });

        // Sync tracking number to WooCommerce
        if (currentOrder.wooCommerceId) {
          const wooStillConfigured = await isWooConfigured();
          if (wooStillConfigured) {
            await addWooCommerceOrderNote(
              currentOrder.wooCommerceId,
              `بوسطة - رقم التتبع: ${bostaResult.trackingNumber}`,
            ).catch((err) => console.error('[Bosta→WooCommerce] Failed to sync tracking:', err));
          }
        }
      } catch (bostaErr) {
        const bostaMsg = bostaErr instanceof Error ? bostaErr.message : 'خطأ غير متوقع';
        console.error('[Bosta] Failed to create delivery:', bostaMsg);
        await prisma.order.update({
          where: { id: order.id },
          data: { bostaStatus: 'failed', bostaError: bostaMsg },
        });
      }
    }

    // إشعار موظفي الحسابات بطلب جديد للمراجعة
    const accountsRole = await prisma.role.findUnique({ where: { slug: 'accounts' } });
    if (accountsRole) {
      const accountsUsers = await prisma.user.findMany({
        where: { roleId: accountsRole.id, isActive: true },
        select: { id: true },
      });
      const leadName = order.lead?.name ?? 'طلب جديد';
      for (const u of accountsUsers) {
        await prisma.notification.create({
          data: {
            userId: u.id,
            title: 'طلب يحتاج مراجعة الحسابات',
            body: `طلب جديد من الليد: ${leadName}`,
            type: 'order_review_needed',
            entity: 'order',
            entityId: order.id,
          },
        });
      }
    }

    res.status(201).json({ order });
  } catch (err: unknown) {
    console.error('Create order error:', err);
    const message = err instanceof Error ? err.message : 'خطأ في إنشاء الطلب';
    res.status(500).json({ error: message });
  }
});

// حذف جميع الطلبات
router.post('/delete-all', async (req: Request, res: Response) => {
  try {
    const callerId = (req as AuthRequest).user?.userId;
    if (callerId) {
      const callerUser = await prisma.user.findUnique({
        where: { id: callerId },
        include: { role: true },
      });
      if (!callerUser || !['super_admin', 'admin'].includes(callerUser.role?.slug ?? '')) {
        res.status(403).json({ error: 'ليس لديك صلاحية' });
        return;
      }
    }
    await prisma.task.updateMany({ where: { orderId: { not: null } }, data: { orderId: null } });
    const result = await prisma.order.deleteMany();
    res.json({ deleted: result.count });
  } catch (err: unknown) {
    console.error('Delete all orders error:', err);
    res.status(500).json({ error: 'خطأ في حذف الطلبات' });
  }
});

// حذف مجمّع للطلبات
router.post('/bulk-delete', async (req: Request, res: Response) => {
  try {
    const callerId = (req as AuthRequest).user?.userId;
    if (callerId) {
      const callerUser = await prisma.user.findUnique({
        where: { id: callerId },
        include: { role: true },
      });
      const allowedSlugs = ['super_admin', 'admin', 'sales_manager'];
      if (!callerUser || !allowedSlugs.includes(callerUser.role?.slug ?? '')) {
        res.status(403).json({ error: 'ليس لديك صلاحية حذف الطلبات' });
        return;
      }
    }
    const { orderIds } = req.body as { orderIds?: string[] };
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      res.status(400).json({ error: 'يجب تحديد طلب واحد على الأقل' });
      return;
    }

    // Cancel Bosta + WC for each order before deletion
    const ordersToDelete = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, number: true, trackingNumber: true, wooCommerceId: true },
    });
    for (const ord of ordersToDelete) {
      if (ord.trackingNumber) {
        try {
          await terminateDelivery(ord.trackingNumber);
          console.log(`[Bosta] Terminated delivery ${ord.trackingNumber} for bulk-deleted order #${ord.number}`);
        } catch (bostaErr) {
          console.error('[Bosta] Failed to terminate on bulk-delete:', bostaErr instanceof Error ? bostaErr.message : bostaErr);
        }
      }
      if (ord.wooCommerceId) {
        try {
          const wooConfigured = await isWooConfigured();
          if (wooConfigured) {
            await updateWooCommerceOrderStatus(ord.wooCommerceId, 'cancelled');
            console.log(`[WC] Cancelled WC order #${ord.wooCommerceId} for bulk-deleted order #${ord.number}`);
          }
        } catch (wcErr) {
          console.error('[WC] Failed to cancel on bulk-delete:', wcErr instanceof Error ? wcErr.message : wcErr);
        }
      }
    }

    const result = await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    res.json({ deleted: result.count });
  } catch (err: unknown) {
    console.error('Bulk delete orders error:', err);
    res.status(500).json({ error: 'خطأ في حذف الطلبات' });
  }
});

// حذف طلب واحد
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const callerId = (req as AuthRequest).user?.userId;
    if (callerId) {
      const callerUser = await prisma.user.findUnique({
        where: { id: callerId },
        include: { role: true },
      });
      const allowedSlugs = ['super_admin', 'admin', 'sales_manager'];
      if (!callerUser || !allowedSlugs.includes(callerUser.role?.slug ?? '')) {
        res.status(403).json({ error: 'ليس لديك صلاحية حذف الطلبات' });
        return;
      }
    }
    const id = String(req.params.id);
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) { res.status(404).json({ error: 'الطلب غير موجود' }); return; }

    // Cancel Bosta delivery if exists
    if (order.trackingNumber) {
      try {
        await terminateDelivery(order.trackingNumber);
        console.log(`[Bosta] Terminated delivery ${order.trackingNumber} for deleted order #${order.number}`);
      } catch (bostaErr) {
        console.error('[Bosta] Failed to terminate on delete:', bostaErr instanceof Error ? bostaErr.message : bostaErr);
      }
    }

    // Cancel WC order if exists
    if (order.wooCommerceId) {
      try {
        const wooConfigured = await isWooConfigured();
        if (wooConfigured) {
          await updateWooCommerceOrderStatus(order.wooCommerceId, 'cancelled');
          console.log(`[WC] Cancelled WC order #${order.wooCommerceId} for deleted order #${order.number}`);
        }
      } catch (wcErr) {
        console.error('[WC] Failed to cancel on delete:', wcErr instanceof Error ? wcErr.message : wcErr);
      }
    }

    await prisma.order.delete({ where: { id } });
    res.status(204).send();
  } catch (err: unknown) {
    console.error('Delete order error:', err);
    res.status(500).json({ error: 'خطأ في حذف الطلب' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        customer: { select: { id: true, name: true, phone: true } },
        orderItems: { include: { product: { select: { id: true, name: true } } } },
      },
    });
    if (!order) {
      res.status(404).json({ error: 'الطلب غير موجود' });
      return;
    }
    res.json({ order });
  } catch (err: unknown) {
    console.error('Order detail error:', err);
    res.status(500).json({ error: 'خطأ في تحميل الطلب' });
  }
});

const confirmRejectSchema = z.object({
  action: z.enum(['confirm', 'reject']),
  rejectedReason: z.string().optional(),
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'مطلوب تسجيل الدخول' });
      return;
    }

    // Permission check: only accounts, admin, super_admin can confirm/reject
    const callerUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    const allowedSlugs = ['super_admin', 'admin', 'accounts'];
    if (!callerUser || !allowedSlugs.includes(callerUser.role?.slug ?? '')) {
      res.status(403).json({ error: 'ليس لديك صلاحية تأكيد أو رفض الطلبات' });
      return;
    }

    const parsed = confirmRejectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
      return;
    }
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true, assignedToId: true, assignedTo: { select: { name: true } } } },
      },
    });
    if (!order) {
      res.status(404).json({ error: 'الطلب غير موجود' });
      return;
    }
    if (order.accountsStatus !== 'pending') {
      res.status(400).json({ error: 'الطلب ليس بانتظار تأكيد الحسابات' });
      return;
    }
    const { action, rejectedReason } = parsed.data;
    if (action === 'reject' && !rejectedReason?.trim()) {
      res.status(400).json({ error: 'أدخل سبب الرفض' });
      return;
    }

    if (action === 'confirm') {
      const updated = await prisma.order.update({
        where: { id },
        data: {
          accountsStatus: 'confirmed',
          accountsConfirmed: true,
          accountsConfirmedAt: new Date(),
          accountsConfirmedBy: userId,
          rejectedReason: null,
        },
        include: {
          lead: { select: { id: true, name: true, assignedTo: { select: { name: true } } } },
          customer: { select: { id: true, name: true, phone: true } },
          orderItems: { include: { product: { select: { id: true, name: true, wooCommerceId: true } } } },
        },
      });

      // Add WC note
      if (updated.wooCommerceId) {
        const wooConfigured = await isWooConfigured();
        if (wooConfigured) {
          await addWooCommerceOrderNote(updated.wooCommerceId, 'تم التأكيد من الحسابات').catch((err) =>
            console.error('[WC Note] Failed:', err instanceof Error ? err.message : err),
          );
        }
      }

      await auditLog(prisma, {
        userId,
        action: 'order_confirm',
        entity: 'order',
        entityId: id,
        oldData: { accountsStatus: 'pending' },
        newData: { accountsStatus: 'confirmed' },
      });

      res.json({ order: updated });
    } else {
      // Reject
      const updated = await prisma.order.update({
        where: { id },
        data: {
          accountsStatus: 'rejected',
          rejectedReason: rejectedReason?.trim(),
          accountsConfirmed: false,
        },
        include: {
          lead: { select: { id: true, name: true, assignedTo: { select: { name: true } } } },
          customer: { select: { id: true, name: true, phone: true } },
          orderItems: { include: { product: { select: { id: true, name: true, wooCommerceId: true } } } },
        },
      });

      // Cancel Bosta delivery if exists
      if (order.trackingNumber) {
        try {
          await terminateDelivery(order.trackingNumber);
          await prisma.order.update({
            where: { id },
            data: { bostaStatus: 'Terminated' },
          });
          console.log(`[Bosta] Terminated delivery ${order.trackingNumber} for rejected order #${order.number}`);
        } catch (bostaErr) {
          console.error('[Bosta] Failed to terminate delivery:', bostaErr instanceof Error ? bostaErr.message : bostaErr);
        }
      }

      // Add WC note for rejection
      if (updated.wooCommerceId) {
        const wooConfigured = await isWooConfigured();
        if (wooConfigured) {
          await addWooCommerceOrderNote(updated.wooCommerceId, `مرفوض من الحسابات: ${rejectedReason?.trim() || '—'}`).catch((err) =>
            console.error('[WC Note] Failed:', err instanceof Error ? err.message : err),
          );
        }
      }

      // Notify sales agent about rejection
      const salesAgentId = order.lead?.assignedToId;
      if (salesAgentId) {
        await prisma.notification.create({
          data: {
            userId: salesAgentId,
            title: 'تم رفض الطلب من الحسابات',
            body: `الطلب #${order.number} اترفض. السبب: ${rejectedReason?.trim() || '—'}`,
            type: 'order_rejected',
            entity: 'order',
            entityId: id,
          },
        });
      }

      await auditLog(prisma, {
        userId,
        action: 'order_reject',
        entity: 'order',
        entityId: id,
        oldData: { accountsStatus: 'pending' },
        newData: { accountsStatus: 'rejected', rejectedReason: rejectedReason?.trim() },
      });

      res.json({ order: updated });
    }
  } catch (err: unknown) {
    console.error('Order confirm/reject error:', err);
    res.status(500).json({ error: 'خطأ في تحديث الطلب' });
  }
});

/**
 * إعادة رفع الطلب لبوسطة (للطلبات الفاشلة أو اللي مترفعتش)
 */
router.post('/:id/push-to-bosta', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: { include: { product: { select: { id: true, name: true } } } },
      },
    });
    if (!order) {
      res.status(404).json({ error: 'الطلب غير موجود' });
      return;
    }
    if (order.bostaDeliveryId && order.bostaStatus !== 'failed') {
      res.status(400).json({ error: 'الطلب مرفوع مسبقاً لبوسطة' });
      return;
    }
    if (!(await isBostaConfigured())) {
      res.status(503).json({ error: 'تكامل بوسطة غير مفعّل. فعّله من صفحة الربط والتكامل.' });
      return;
    }
    const result = await createBostaDelivery(order);
    await prisma.order.update({
      where: { id },
      data: {
        bostaDeliveryId: result.deliveryId,
        trackingNumber: result.trackingNumber,
        bostaStatus: 'Pickup requested',
        bostaError: null,
      },
    });
    // مزامنة رقم التتبع مع ووكومرس
    if (order.wooCommerceId) {
      const wooConfigured = await isWooConfigured();
      if (wooConfigured) {
        await addWooCommerceOrderNote(
          order.wooCommerceId,
          `بوسطة - رقم التتبع: ${result.trackingNumber}`,
        ).catch((err) => console.error('[Bosta→WooCommerce] Failed to sync tracking:', err));
      }
    }
    const updated = await prisma.order.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        orderItems: { include: { product: { select: { id: true, name: true } } } },
      },
    });
    res.json({ order: updated, trackingNumber: result.trackingNumber });
  } catch (err: unknown) {
    console.error('Push to Bosta error:', err);
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع';
    res.status(502).json({ error: `فشل رفع الطلب لبوسطة: ${message}` });
  }
});

/**
 * إعادة رفع الطلب إلى ووكومرس (retry — لو الرفع التلقائي فشل)
 */
router.post('/:id/push-to-woocommerce', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: { include: { product: true } },
        lead: { select: { name: true, assignedTo: { select: { name: true } } } },
      },
    });
    if (!order) {
      res.status(404).json({ error: 'الطلب غير موجود' });
      return;
    }
    if (order.wooCommerceId) {
      res.status(400).json({ error: 'الطلب مرفوع مسبقاً إلى ووكومرس' });
      return;
    }
    if (!(await isWooConfigured())) {
      res.status(503).json({ error: 'إعدادات ووكومرس غير مكتملة. أدخل البيانات من صفحة الربط أو متغيرات البيئة.' });
      return;
    }
    const nameParts = order.shippingName.trim().split(/\s+/);
    const firstName = nameParts[0] || order.shippingName;
    const lastName = nameParts.slice(1).join(' ') || '';
    const lineItems = order.orderItems.map((item) => {
      const wcId = item.product?.wooCommerceId;
      const itemTotal = String(Number(item.price) * item.quantity);
      const unitPrice = String(item.price);
      if (wcId) {
        return { product_id: wcId, quantity: item.quantity, subtotal: itemTotal, total: itemTotal, price: unitPrice };
      }
      return {
        name: item.productName || 'منتج',
        quantity: item.quantity,
        subtotal: itemTotal,
        total: itemTotal,
        price: unitPrice,
      } as { name: string; quantity: number; subtotal: string; total: string; price: string };
    });
    if (lineItems.length === 0) {
      res.status(400).json({ error: 'الطلب لا يحتوي عناصر' });
      return;
    }
    // Build customer_note — product-level notes from each item
    const customerNoteLines: string[] = [];
    for (const item of order.orderItems) {
      const productLabel = item.productName || item.product?.name || 'منتج';
      const variation = item.variation ? Object.values(item.variation as Record<string, string>).join(' - ') : '';
      const label = variation ? `📦 ${productLabel} (${variation})` : `📦 ${productLabel}`;
      customerNoteLines.push(label);
      if (item.notes?.trim()) {
        customerNoteLines.push(`   ملاحظة: ${item.notes.trim()}`);
      }
    }
    const customerNote = customerNoteLines.length > 0 ? customerNoteLines.join('\n') : undefined;

    // Build internal order note — sales info, payment details
    const salesName = order.lead?.assignedTo?.name || '—';
    const totalPrice = order.orderItems.reduce((sum: number, i: { price: unknown; quantity: number }) => sum + Number(i.price) * i.quantity, 0);
    const discount = Number(order.discount) || 0;
    const finalTotal = totalPrice - discount;
    const paidAmount = order.paymentType === 'full' ? finalTotal : (Number(order.partialAmount) || 0);
    const remaining = finalTotal - paidAmount;

    const internalNoteLines = [
      `🔹 السيلز: ${salesName}`,
      `🔹 المبلغ المدفوع: ${paidAmount} EGP`,
      `🔹 المبلغ المتبقي: ${remaining} EGP`,
    ];
    if (order.notes?.trim()) {
      internalNoteLines.push(`🔹 ملاحظات: ${order.notes.trim()}`);
    }
    internalNoteLines.push('');
    internalNoteLines.push('تم الرفع من خلال دولفين ليدز — بانتظار مراجعة الحسابات');
    const internalNote = internalNoteLines.join('\n');

    const wooId = await createWooCommerceOrder({
      billing: {
        first_name: firstName,
        last_name: lastName,
        address_1: order.shippingAddress || undefined,
        phone: order.shippingPhone,
      },
      shipping: {
        first_name: firstName,
        last_name: lastName,
        address_1: order.shippingAddress || undefined,
      },
      line_items: lineItems,
      payment_method: 'cod',
      payment_method_title: order.paymentType === 'full' ? 'دفع كامل' : 'دفع جزئي',
      set_paid: false,
      status: 'processing',
      customer_note: customerNote,
    }, internalNote);
    await prisma.order.update({ where: { id }, data: { wooCommerceId: wooId } });
    const updated = await prisma.order.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        orderItems: { include: { product: { select: { id: true, name: true } } } },
      },
    });
    res.json({ order: updated, wooCommerceId: wooId });
  } catch (err: unknown) {
    console.error('Push to WooCommerce error:', err);
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع';
    res.status(502).json({ error: `فشل رفع الطلب إلى ووكومرس: ${message}` });
  }
});

export default router;
