import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [totalLeads, totalOrders, pendingOrders] = await prisma.$transaction([
      prisma.lead.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'pending_accounts' } }),
    ]);
    res.json({ totalLeads, totalOrders, pendingOrders });
  } catch (err: unknown) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'خطأ في تحميل إحصائيات الداشبورد' });
  }
});

/** ليدز خلال فترة (يومياً أو أسبوعياً) — للرسم الخطي/الأعمدة */
router.get('/leads-over-time', async (req: Request, res: Response) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(String(req.query.days), 10) || 30));
    const groupBy = req.query.groupBy === 'week' ? 'week' : 'day';
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const trunc =
      groupBy === 'week'
        ? "date_trunc('week', created_at AT TIME ZONE 'UTC')"
        : "date_trunc('day', created_at AT TIME ZONE 'UTC')";

    const rawResult = await prisma.$queryRawUnsafe<{ period: Date; count: number }[]>(
      `SELECT ${trunc} AS period, count(*)::int AS count FROM leads WHERE created_at >= $1 GROUP BY 1 ORDER BY 1`,
      start,
    );

    res.json({
      data: rawResult.map((r) => ({ date: r.period.toISOString().slice(0, 10), count: Number(r.count) })),
    });
  } catch (err: unknown) {
    console.error('Leads over time error:', err);
    res.status(500).json({ error: 'خطأ في تحميل بيانات الليدز' });
  }
});

/** توزيع الطلبات حسب الحالة — للرسم الدائري/الأعمدة */
router.get('/orders-by-status', async (_req: Request, res: Response) => {
  try {
    const result = await prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    result.sort((a, b) => b._count.id - a._count.id);
    res.json({
      data: result.map((r) => ({ status: r.status, count: r._count.id })),
    });
  } catch (err: unknown) {
    console.error('Orders by status error:', err);
    res.status(500).json({ error: 'خطأ في تحميل بيانات الطلبات' });
  }
});

export default router;
