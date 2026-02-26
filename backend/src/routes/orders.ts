import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { uploadSingle } from '../middleware/upload';
import { normalizePhone } from '../utils/phone';
import { AuthRequest } from '../middleware/auth';
import { createWooCommerceOrder, isConfigured as isWooConfigured } from '../services/woocommerce';
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
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize), 10) || 20));

    const where = status ? { status } : {};
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

    const order = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.create({
        data: {
          leadId,
          customerId: leadCustomerId!,
          status: 'pending_accounts',
          paymentType,
          transferImage,
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
          lead: true,
          customer: true,
          orderItems: { include: { product: true } },
        },
      });
    });

    if (!order) {
      res.status(500).json({ error: 'فشل إنشاء الطلب' });
      return;
    }

    // إشعار موظفي الحسابات بطلب جديد بانتظار التأكيد
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
            title: 'طلب بانتظار الحسابات',
            body: `طلب جديد من الليد: ${leadName}`,
            type: 'order_pending_accounts',
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
    const parsed = confirmRejectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
      return;
    }
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      res.status(404).json({ error: 'الطلب غير موجود' });
      return;
    }
    if (order.status !== 'pending_accounts') {
      res.status(400).json({ error: 'الطلب ليس بانتظار تأكيد الحسابات' });
      return;
    }
    const { action, rejectedReason } = parsed.data;
    if (action === 'reject' && !rejectedReason?.trim()) {
      res.status(400).json({ error: 'أدخل سبب الرفض' });
      return;
    }
    const updated = await prisma.order.update({
      where: { id },
      data:
        action === 'confirm'
          ? {
              status: 'accounts_confirmed',
              accountsConfirmed: true,
              accountsConfirmedAt: new Date(),
              accountsConfirmedBy: userId,
              rejectedReason: undefined,
            }
          : {
              status: 'rejected',
              rejectedReason: rejectedReason?.trim(),
              accountsConfirmed: false,
            },
      include: {
        lead: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        orderItems: { include: { product: { select: { id: true, name: true } } } },
      },
    });
    await auditLog(prisma, {
      userId,
      action: action === 'confirm' ? 'order_confirm' : 'order_reject',
      entity: 'order',
      entityId: id,
      oldData: { status: order.status },
      newData: { status: updated.status, ...(action === 'reject' ? { rejectedReason: rejectedReason?.trim() } : {}) },
    });
    res.json({ order: updated });
  } catch (err: unknown) {
    console.error('Order confirm/reject error:', err);
    res.status(500).json({ error: 'خطأ في تحديث الطلب' });
  }
});

/**
 * رفع الطلب إلى ووكومرس (للطلبات المؤكدة من الحسابات فقط)
 */
router.post('/:id/push-to-woocommerce', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: { orderItems: { include: { product: true } } },
    });
    if (!order) {
      res.status(404).json({ error: 'الطلب غير موجود' });
      return;
    }
    if (order.wooCommerceId) {
      res.status(400).json({ error: 'الطلب مرفوع مسبقاً إلى ووكومرس' });
      return;
    }
    if (order.status !== 'accounts_confirmed') {
      res.status(400).json({ error: 'يجب تأكيد الطلب من الحسابات قبل الرفع إلى ووكومرس' });
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
      if (wcId) {
        return { product_id: wcId, quantity: item.quantity };
      }
      return {
        name: item.productName || 'منتج',
        quantity: item.quantity,
        price: String(item.price),
      } as { name: string; quantity: number; price: string };
    });
    if (lineItems.length === 0) {
      res.status(400).json({ error: 'الطلب لا يحتوي عناصر' });
      return;
    }
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
    });
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
