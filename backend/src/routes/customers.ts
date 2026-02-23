import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

/**
 * قائمة العملاء - بحث برقم الفون أو الاسم مع ترقيم
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize), 10) || 20));

    const where: { OR?: Array<{ phone?: { contains: string; mode: 'insensitive' }; name?: { contains: string; mode: 'insensitive' } }> } = {};
    if (search) {
      where.OR = [
        { phone: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, customers] = await prisma.$transaction([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
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
