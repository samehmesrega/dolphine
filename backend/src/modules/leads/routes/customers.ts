import { Router, Request, Response } from 'express';
import { prisma } from '../../../db';
import { AuthRequest } from '../../../shared/middleware/auth';

const router = Router();

/**
 * قائمة العملاء - بحث برقم الفون أو الاسم مع ترقيم
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize), 10) || 20));

    const where = {
      leads: { some: { status: { slug: 'confirmed' } } },
      ...(search ? {
        OR: [
          { phone: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [total, customers] = await prisma.$transaction([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          number: true,
          name: true,
          phone: true,
          whatsapp: true,
          email: true,
          address: true,
          createdAt: true,
          _count: { select: { leads: true, orders: true } },
        },
      }),
    ]);

    res.json({ total, page, pageSize, customers });
  } catch (err: unknown) {
    console.error('Customers list error:', err);
    res.status(500).json({ error: 'خطأ في تحميل قائمة العملاء' });
  }
});

// حذف مجمّع للعملاء
router.post('/bulk-delete', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({ error: 'غير مصرح' });
      return;
    }
    const perms = authReq.user.permissions;
    if (!perms.includes('*') && !perms.includes('customers.delete')) {
      res.status(403).json({ error: 'ليس لديك صلاحية حذف العملاء' });
      return;
    }
    const { customerIds } = req.body as { customerIds?: string[] };
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      res.status(400).json({ error: 'يجب تحديد عميل واحد على الأقل' });
      return;
    }
    // التحقق من عدم وجود ليدز أو طلبات مرتبطة
    const customersWithRelations = await prisma.customer.findMany({
      where: { id: { in: customerIds }, OR: [{ leads: { some: {} } }, { orders: { some: {} } }] },
      select: { id: true, name: true, number: true },
    });
    if (customersWithRelations.length > 0) {
      const names = customersWithRelations.map(c => `#${c.number} ${c.name}`).join('، ');
      res.status(400).json({ error: `لا يمكن حذف عملاء لهم ليدز أو طلبات: ${names}` });
      return;
    }
    const result = await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    res.json({ deleted: result.count });
  } catch (err: unknown) {
    console.error('Bulk delete customers error:', err);
    res.status(500).json({ error: 'خطأ في حذف العملاء' });
  }
});

// حذف عميل واحد
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({ error: 'غير مصرح' });
      return;
    }
    const perms = authReq.user.permissions;
    if (!perms.includes('*') && !perms.includes('customers.delete')) {
      res.status(403).json({ error: 'ليس لديك صلاحية حذف العملاء' });
      return;
    }
    const id = String(req.params.id);
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { leads: { take: 1 }, orders: { take: 1 } },
    });
    if (!customer) { res.status(404).json({ error: 'العميل غير موجود' }); return; }
    if (customer.leads.length > 0 || customer.orders.length > 0) {
      res.status(400).json({ error: 'لا يمكن حذف عميل له ليدز أو طلبات مرتبطة' });
      return;
    }
    await prisma.customer.delete({ where: { id } });
    res.status(204).send();
  } catch (err: unknown) {
    console.error('Delete customer error:', err);
    res.status(500).json({ error: 'خطأ في حذف العميل' });
  }
});

// حد أعلى لليدز والطلبات في تفاصيل العميل (تحميل أسرع)
const CUSTOMER_DETAIL_LEADS_LIMIT = 30;
const CUSTOMER_DETAIL_ORDERS_LIMIT = 30;

/**
 * تفاصيل عميل مع ليدزه وطلباته (محدودة العدد)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        leads: {
          orderBy: { createdAt: 'desc' },
          take: CUSTOMER_DETAIL_LEADS_LIMIT,
          include: {
            status: true,
            assignedTo: { select: { id: true, name: true } },
          },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: CUSTOMER_DETAIL_ORDERS_LIMIT,
          include: {
            lead: { select: { id: true, name: true } },
            orderItems: { include: { product: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    if (!customer) {
      res.status(404).json({ error: 'العميل غير موجود' });
      return;
    }
    res.json({ customer });
  } catch (err: unknown) {
    console.error('Customer detail error:', err);
    res.status(500).json({ error: 'خطأ في تحميل بيانات العميل' });
  }
});

export default router;
