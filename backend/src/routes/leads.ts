import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { normalizePhone } from '../utils/phone';
import { AuthRequest } from '../middleware/auth';
import { getNextAssignedUserId } from '../services/roundRobin';
import { auditLog } from '../services/audit';

const router = Router();

const COMMUNICATION_TYPES = ['whatsapp', 'call', 'physical', 'email'] as const;

const listQuerySchema = z.object({
  search: z.string().optional(),
  statusId: z.preprocess((v) => (v === '' || v === undefined ? undefined : v), z.string().uuid().optional()),
  assignedToId: z.preprocess((v) => (v === '' || v === undefined ? undefined : v), z.string().uuid().optional().nullable()),
  sortBy: z.enum(['createdAt', 'name', 'statusId']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

type LeadWhere = {
  statusId?: string;
  assignedToId?: string | null;
  OR?: Array<
    | { name: { contains: string; mode: 'insensitive' } }
    | { phone: { contains: string } }
    | { email: { contains: string; mode: 'insensitive' } }
    | { phoneNormalized: { equals: string } }
  >;
};

router.get('/', async (req: Request, res: Response) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'باراميترز غير صحيحة' });
      return;
    }

    const { search, statusId, assignedToId, sortBy, order, page, pageSize } = parsed.data;
    const skip = (page - 1) * pageSize;

    const where: LeadWhere = {};
    if (statusId) where.statusId = statusId;
    if (assignedToId !== undefined) where.assignedToId = assignedToId;
    if (search && search.trim()) {
      const s = search.trim();
      const normalized = normalizePhone(s) || undefined;
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
        { email: { contains: s, mode: 'insensitive' } },
        ...(normalized ? [{ phoneNormalized: { equals: normalized } }] : []),
      ];
    }

    const orderBy =
      sortBy === 'name' ? { name: order } :
      sortBy === 'statusId' ? { statusId: order } :
      { createdAt: order };

    const [total, leads] = await prisma.$transaction([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          status: true,
          assignedTo: { select: { id: true, name: true } },
          customer: { select: { id: true, phone: true, name: true } },
        },
      }),
    ]);

    res.json({ total, page, pageSize, leads });
  } catch (err: unknown) {
    console.error('Leads list error:', err);
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : '';
    const msg =
      code === 'P1001' || code === 'P1002'
        ? 'لا يمكن الاتصال بقاعدة البيانات. تحقق من تشغيل PostgreSQL وملف .env'
        : code === 'P2021'
          ? 'جدول غير موجود. شغّل من مجلد backend: npx prisma db push ثم npx tsx prisma/seed.ts'
          : 'خطأ في تحميل قائمة الليدز. راجع ترمينال الـ Backend للتفاصيل.';
    res.status(500).json({ error: msg });
  }
});

const createLeadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  whatsapp: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
  source: z.string().optional().default('manual'),
  sourceDetail: z.string().optional(),
  statusSlug: z.string().optional().default('new'),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
      return;
    }

    const data = parsed.data;
    const phoneNormalized = normalizePhone(data.phone);
    if (!phoneNormalized) {
      res.status(400).json({ error: 'رقم فون غير صالح' });
      return;
    }

    const status = await prisma.leadStatus.findUnique({ where: { slug: data.statusSlug } });
    if (!status) {
      res.status(400).json({ error: 'حالة ليد غير موجودة' });
      return;
    }

    // عميل حسب رقم الفون: ينشأ تلقائياً أول مرة يظهر الرقم
    // ملاحظة: لا نغيّر الاسم تلقائياً عند تكرار الرقم لتجنب استبداله باسم مختلف من فورم آخر.
    const customer = await prisma.customer.upsert({
      where: { phone: phoneNormalized },
      update: {
        whatsapp: data.whatsapp ?? undefined,
        email: data.email ?? undefined,
        address: data.address ?? undefined,
      },
      create: {
        phone: phoneNormalized,
        name: data.name,
        whatsapp: data.whatsapp,
        email: data.email,
        address: data.address,
        customFields: (data.customFields as Prisma.InputJsonValue) ?? undefined,
      },
    });

    const assignedToId = await getNextAssignedUserId();

    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        phone: data.phone,
        phoneNormalized,
        whatsapp: data.whatsapp,
        email: data.email,
        address: data.address,
        customFields: (data.customFields as Prisma.InputJsonValue) ?? undefined,
        source: data.source,
        sourceDetail: data.sourceDetail,
        statusId: status.id,
        customerId: customer.id,
        ...(assignedToId ? { assignedToId } : {}),
      },
      include: { status: true, customer: true, assignedTo: { select: { id: true, name: true } } },
    });

    // أنشئ task "ليد جديد" للموظف المعين
    if (assignedToId) {
      await prisma.task.create({
        data: {
          type: 'new_lead',
          title: `تواصل مع ليد جديد: ${lead.name}`,
          leadId: lead.id,
          assignedToId,
          status: 'pending',
        },
      });
    }

    res.status(201).json({ lead });
  } catch (err: unknown) {
    console.error('Create lead error:', err);
    res.status(500).json({ error: 'خطأ في إنشاء الليد' });
  }
});

const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(6).optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional(),
  statusId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional().nullable(),
});

type LeadUpdateData = {
  name?: string;
  whatsapp?: string;
  email?: string | null;
  address?: string;
  statusId?: string;
  assignedToId?: string | null;
  phone?: string;
  phoneNormalized?: string;
  customerId?: string;
};

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const authReq = req as AuthRequest;
    const parsed = updateLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
      return;
    }

    const lead = await prisma.lead.findUnique({ where: { id }, include: { customer: true } });
    if (!lead) {
      res.status(404).json({ error: 'ليد غير موجود' });
      return;
    }

    const data = parsed.data;
    const updateData: LeadUpdateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.whatsapp !== undefined) updateData.whatsapp = data.whatsapp;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.statusId !== undefined) updateData.statusId = data.statusId;
    if (data.assignedToId !== undefined) {
      const callerId = (req as AuthRequest).user?.userId;
      if (callerId) {
        const callerUser = await prisma.user.findUnique({
          where: { id: callerId },
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        });
        const perms = callerUser?.role?.rolePermissions?.map((rp) => rp.permission.slug) ?? [];
        if (!perms.includes('leads.assign')) {
          res.status(403).json({ error: 'ليس لديك صلاحية تعيين الليدز' });
          return;
        }
      }
      updateData.assignedToId = data.assignedToId;
    }

    if (data.phone !== undefined) {
      const phoneNormalized = normalizePhone(data.phone);
      if (!phoneNormalized) {
        res.status(400).json({ error: 'رقم فون غير صالح' });
        return;
      }
      updateData.phone = data.phone;
      updateData.phoneNormalized = phoneNormalized;
      const customer = await prisma.customer.upsert({
        where: { phone: phoneNormalized },
        update: {
          name: data.name ?? lead.name,
          whatsapp: data.whatsapp ?? undefined,
          email: data.email ?? undefined,
          address: data.address ?? undefined,
        },
        create: {
          phone: phoneNormalized,
          name: data.name ?? lead.name,
          whatsapp: data.whatsapp ?? lead.whatsapp,
          email: data.email ?? lead.email,
          address: data.address ?? lead.address,
        },
      });
      updateData.customerId = customer.id;
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        status: true,
        assignedTo: { select: { id: true, name: true } },
        customer: true,
      },
    });
    await auditLog(prisma, {
      userId: authReq.user?.userId ?? null,
      action: 'update',
      entity: 'lead',
      entityId: id,
      oldData: { name: lead.name, statusId: lead.statusId, assignedToId: lead.assignedToId },
      newData: { name: updated.name, statusId: updated.statusId, assignedToId: updated.assignedToId },
    });

    // لو اتغير التعيين → أنشئ task "ليد جديد" للموظف الجديد (لو مافيش pending بالفعل)
    if (updateData.assignedToId && updateData.assignedToId !== lead.assignedToId) {
      const exists = await prisma.task.findFirst({
        where: { leadId: id, type: 'new_lead', status: 'pending' },
      });
      if (!exists) {
        await prisma.task.create({
          data: {
            type: 'new_lead',
            title: `تواصل مع: ${updated.name}`,
            leadId: id,
            assignedToId: updateData.assignedToId,
            status: 'pending',
          },
        });
      }
    }

    res.json({ lead: updated });
  } catch (err: unknown) {
    console.error('Update lead error:', err);
    res.status(500).json({ error: 'خطأ في تحديث الليد' });
  }
});

// حد أعلى لسجل التواصُل وطلبات الرد في تفاصيل الليد (تحميل أسرع)
const LEAD_DETAIL_COMMS_LIMIT = 50;
const LEAD_DETAIL_RESPONSE_REQUESTS_LIMIT = 30;

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        status: true,
        assignedTo: { select: { id: true, name: true } },
        customer: true,
        communications: {
          orderBy: { createdAt: 'desc' },
          take: LEAD_DETAIL_COMMS_LIMIT,
          include: { user: { select: { id: true, name: true } } },
        },
        responseRequests: {
          orderBy: { createdAt: 'desc' },
          take: LEAD_DETAIL_RESPONSE_REQUESTS_LIMIT,
          include: {
            requestedFrom: { select: { id: true, name: true } },
            requestedBy: { select: { id: true, name: true } },
          },
        },
        productInterests: {
          orderBy: { createdAt: 'desc' },
          include: { product: { select: { id: true, name: true } } },
        },
      },
    });
    if (!lead) {
      res.status(404).json({ error: 'ليد غير موجود' });
      return;
    }
    res.json({ lead });
  } catch (err: unknown) {
    console.error('Lead detail error:', err);
    res.status(500).json({ error: 'خطأ في تحميل الليد' });
  }
});

const addCommunicationSchema = z.object({
  type: z.enum(COMMUNICATION_TYPES),
  notes: z.string().optional(),
  statusId: z.string().uuid().optional(),
  requestResponseFromIds: z.array(z.string().uuid()).optional(),
});

router.post('/:id/communications', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'مطلوب تسجيل الدخول' });
      return;
    }

    const parsed = addCommunicationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
      return;
    }

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      res.status(404).json({ error: 'ليد غير موجود' });
      return;
    }

    const { type, notes, statusId, requestResponseFromIds } = parsed.data;

    const communication = await prisma.$transaction(async (tx) => {
      const comm = await tx.communication.create({
        data: {
          leadId: id,
          userId,
          type,
          notes: notes ?? null,
          statusId: statusId ?? null,
        },
        include: { user: { select: { id: true, name: true } } },
      });
      if (statusId) {
        await tx.lead.update({ where: { id }, data: { statusId } });
      }
      for (const requestedFromId of requestResponseFromIds ?? []) {
        await tx.responseRequest.create({ data: { leadId: id, requestedFromId } });
        await tx.notification.create({
          data: {
            userId: requestedFromId,
            title: 'طلب رد على ليد',
            body: `تم طلب رد منك على ليد: ${lead.name}`,
            type: 'response_request',
            entity: 'lead',
            entityId: id,
          },
        });
      }
      return comm;
    });

    // أعلم pending tasks للموظف ده على الليد ده كمكتملة
    await prisma.task.updateMany({
      where: {
        leadId: id,
        assignedToId: userId,
        status: 'pending',
        type: { in: ['new_lead', 're_contact', 'callback_replied'] },
      },
      data: { status: 'done', completedAt: new Date(), completedById: userId },
    });

    const updatedLead = await prisma.lead.findUnique({
      where: { id },
      include: {
        status: true,
        communications: { orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true } } } },
        responseRequests: { include: { requestedFrom: { select: { id: true, name: true } } } },
      },
    });

    res.status(201).json({ communication, lead: updatedLead });
  } catch (err: unknown) {
    console.error('Add communication error:', err);
    res.status(500).json({ error: 'خطأ في إضافة سجل التواصل' });
  }
});

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
        res.status(403).json({ error: 'ليس لديك صلاحية حذف الليدز' });
        return;
      }
    }
    const id = String(req.params.id);
    const lead = await prisma.lead.findUnique({ where: { id }, include: { orders: { take: 1 } } });
    if (!lead) {
      res.status(404).json({ error: 'ليد غير موجود' });
      return;
    }
    if (lead.orders.length > 0) {
      res.status(400).json({ error: 'لا يمكن حذف ليد له طلبات مرتبطة. ألغِ أو انقل الطلبات أولاً.' });
      return;
    }
    await prisma.lead.delete({ where: { id } });
    res.status(204).send();
  } catch (err: unknown) {
    console.error('Delete lead error:', err);
    res.status(500).json({ error: 'خطأ في حذف الليد' });
  }
});

// ============ اهتمامات المنتجات ============
const addProductInterestSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  quantity: z.number().int().min(1).optional().default(1),
  notes: z.string().optional(),
});

router.get('/:id/product-interests', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      res.status(404).json({ error: 'ليد غير موجود' });
      return;
    }
    const list = await prisma.productInterest.findMany({
      where: { leadId: id },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { id: true, name: true } } },
    });
    res.json({ productInterests: list });
  } catch (err: unknown) {
    console.error('Product interests error:', err);
    res.status(500).json({ error: 'خطأ في تحميل اهتمامات المنتجات' });
  }
});

router.post('/:id/product-interests', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const parsed = addProductInterestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
      return;
    }
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      res.status(404).json({ error: 'ليد غير موجود' });
      return;
    }
    const { productId, quantity, notes } = parsed.data;
    if (productId) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        res.status(400).json({ error: 'المنتج غير موجود' });
        return;
      }
    }
    const interest = await prisma.productInterest.create({
      data: {
        leadId: id,
        productId: productId ?? undefined,
        quantity: quantity ?? 1,
        notes: notes ?? undefined,
      },
      include: { product: { select: { id: true, name: true } } },
    });
    res.status(201).json({ productInterest: interest });
  } catch (err: unknown) {
    console.error('Add product interest error:', err);
    res.status(500).json({ error: 'خطأ في إضافة اهتمام المنتج' });
  }
});

router.delete('/:id/product-interests/:interestId', async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.id);
    const interestId = String(req.params.interestId);
    const interest = await prisma.productInterest.findFirst({
      where: { id: interestId, leadId },
    });
    if (!interest) {
      res.status(404).json({ error: 'اهتمام المنتج غير موجود' });
      return;
    }
    await prisma.productInterest.delete({ where: { id: interestId } });
    res.status(204).send();
  } catch (err: unknown) {
    console.error('Delete product interest error:', err);
    res.status(500).json({ error: 'خطأ في حذف اهتمام المنتج' });
  }
});

// POST /api/leads/:id/response-requests - إضافة طلب رد مستقل
router.post('/:id/response-requests', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const requestedById = authReq.user?.userId;
    if (!requestedById) { res.status(401).json({ error: 'مطلوب تسجيل الدخول' }); return; }
    const leadId = String(req.params.id);
    const { targetUserId, note } = req.body as { targetUserId?: string; note?: string };
    if (!targetUserId) { res.status(400).json({ error: 'targetUserId مطلوب' }); return; }
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) { res.status(404).json({ error: 'ليد غير موجود' }); return; }
    const rr = await prisma.responseRequest.create({
      data: { leadId, requestedFromId: targetUserId, requestedById, note: note || null },
      include: {
        requestedFrom: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
      },
    });
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        title: 'طلب رد على ليد',
        body: `تم طلب رد منك على ليد: ${lead.name}${note ? ' - ' + note : ''}`,
        type: 'response_request',
        entity: 'lead',
        entityId: leadId,
      },
    });
    res.status(201).json({ responseRequest: rr });
  } catch (err) {
    console.error('Add response-request error:', err);
    res.status(500).json({ error: 'خطأ في إضافة طلب الرد' });
  }
});

// DELETE /api/leads/:id/response-requests/:requestId
router.delete('/:id/response-requests/:requestId', async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.id);
    const requestId = String(req.params.requestId);
    const rr = await prisma.responseRequest.findFirst({ where: { id: requestId, leadId } });
    if (!rr) { res.status(404).json({ error: 'طلب الرد غير موجود' }); return; }
    if (rr.response) { res.status(400).json({ error: 'لا يمكن حذف طلب رد تمت الإجابة عليه' }); return; }
    await prisma.responseRequest.delete({ where: { id: requestId } });
    res.status(204).send();
  } catch (err) {
    console.error('Delete response-request error:', err);
    res.status(500).json({ error: 'خطأ في حذف طلب الرد' });
  }
});

// POST /api/leads/:id/response-requests/:requestId/reply
router.post('/:id/response-requests/:requestId/reply', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const callerId = authReq.user?.userId;
    if (!callerId) { res.status(401).json({ error: 'مطلوب تسجيل الدخول' }); return; }
    const requestId = String(req.params.requestId);
    const { response } = req.body as { response?: string };
    if (!response?.trim()) { res.status(400).json({ error: 'نص الرد مطلوب' }); return; }
    const rr = await prisma.responseRequest.findUnique({ where: { id: requestId } });
    if (!rr) { res.status(404).json({ error: 'طلب الرد غير موجود' }); return; }
    // فقط المطلوب منه الرد يستطيع الرد
    if (rr.requestedFromId !== callerId) {
      res.status(403).json({ error: 'يمكن فقط للمطلوب منه الرد إضافة الرد' });
      return;
    }
    const leadId = String(req.params.id);
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { name: true } });
    const updated = await prisma.responseRequest.update({
      where: { id: requestId },
      data: { response: response.trim(), respondedAt: new Date() },
      include: {
        requestedFrom: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
      },
    });

    // أنشئ task لصاحب الطلب الأصلي إنه يتابع
    if (rr.requestedById) {
      await prisma.task.create({
        data: {
          type: 'callback_replied',
          title: `تم الرد على طلبك — تابع مع: ${lead?.name ?? ''}`,
          leadId: leadId,
          assignedToId: rr.requestedById,
          status: 'pending',
        },
      });
    }

    res.json({ responseRequest: updated });
  } catch (err) {
    console.error('Reply response-request error:', err);
    res.status(500).json({ error: 'خطأ في إضافة الرد' });
  }
});

export default router;
