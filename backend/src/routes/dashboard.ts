import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';

const router = Router();

router.get('/stats', async (_req: Request, res: Response) => {
  const [totalLeads, totalOrders, pendingOrders] = await prisma.$transaction([
    prisma.lead.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'pending_accounts' } }),
  ]);
  res.json({
    totalLeads,
    totalOrders,
    pendingOrders,
  });
});

/** ليدز خلال فترة (يومياً أو أسبوعياً) — للرسم الخطي/الأعمدة */
router.get('/leads-over-time', async (req: Request, res: Response) => {
  const days = Math.min(365, Math.max(1, parseInt(String(req.query.days), 10) || 30));
  const groupBy = req.query.groupBy === 'week' ? 'week' : 'day';
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  const trunc = groupBy === 'week' ? "date_trunc('week', created_at AT TIME ZONE 'UTC')" : "date_trunc('day', created_at AT TIME ZONE 'UTC')";
  const rows = await prisma.$queryRaw<{ period: Date; count: bigint }[]>(
    Prisma.sql`
      SELECT ${Prisma.raw(trunc)} AS period, count(*)::int as count
      FROM leads
      WHERE created_at >= ${start}
      GROUP BY 1
      ORDER BY 1
    `.values
      ? (Prisma.sql`SELECT ${Prisma.raw(trunc)} AS period, count(*) as count FROM leads WHERE created_at >= ${start} GROUP BY 1 ORDER BY 1` as any)
      : (Prisma.sql`SELECT ${Prisma.raw(trunc)} AS period, count(*) as count FROM leads WHERE created_at >= ${start} GROUP BY 1 ORDER BY 1` as any),
  );
  // Prisma raw query returns count as bigint; normalize to array of { period, count }
  const rawResult = await prisma.$queryRawUnsafe<
    { period: Date; count: number }[]
  >(
    `SELECT ${trunc} AS period, count(*)::int AS count FROM leads WHERE created_at >= $1 GROUP BY 1 ORDER BY 1`,
    start,
  );
  res.json({
    data: rawResult.map((r) => ({ date: r.period.toISOString().slice(0, 10), count: Number(r.count) })),
  });
});

/** توزيع الطلبات حسب الحالة — للرسم الدائري/الأعمدة */
router.get('/orders-by-status', async (_req: Request, res: Response) => {
  const result = await prisma.order.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  result.sort((a, b) => b._count.id - a._count.id);
  res.json({
    data: result.map((r) => ({ status: r.status, count: r._count.id })),
  });
});

export default router;
