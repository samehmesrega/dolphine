import { Router, Request, Response } from 'express';
import {
  getTotalLeads,
  getTotalOrders,
  getPendingOrders,
  getLeadsOverTime,
  getOrdersByStatus,
  parseDateRangeCairo,
} from '../../../shared/services/metrics.service';

const router = Router();

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [totalLeads, totalOrders, pendingOrders] = await Promise.all([
      getTotalLeads(...parseDateRangeCairo()), // last 30 days default
      getTotalOrders(...parseDateRangeCairo()),
      getPendingOrders(),
    ]);
    res.json({ totalLeads, totalOrders, pendingOrders });
  } catch (err: unknown) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'خطأ في تحميل إحصائيات الداشبورد' });
  }
});

router.get('/leads-over-time', async (req: Request, res: Response) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(String(req.query.days), 10) || 30));
    const groupBy = req.query.groupBy === 'week' ? 'week' : 'day';

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - days);

    const [from, to] = parseDateRangeCairo(fmt(start), fmt(now));
    const data = await getLeadsOverTime(from, to, groupBy);
    res.json({ data });
  } catch (err: unknown) {
    console.error('Leads over time error:', err);
    res.status(500).json({ error: 'خطأ في تحميل بيانات الليدز' });
  }
});

router.get('/orders-by-status', async (_req: Request, res: Response) => {
  try {
    const data = await getOrdersByStatus();
    res.json({ data });
  } catch (err: unknown) {
    console.error('Orders by status error:', err);
    res.status(500).json({ error: 'خطأ في تحميل بيانات الطلبات' });
  }
});

export default router;
