/**
 * تقارير دولفين - موظفين / شيفتات / مصادر UTM / عام
 * كل الأرقام من metrics.service (مصدر موحد)
 */

import { Router, Request, Response } from 'express';
import {
  parseDateRangeCairo,
  getTotalLeads,
  getTotalOrders,
  getTotalOrderValue,
  getLeadsOverTime,
  getAgentPerformance,
  getShiftPerformance,
  getSourcePerformance,
} from '../../../shared/services/metrics.service';

const router = Router();

// GET /api/reports/agents?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const [from, to] = parseDateRangeCairo(
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    );
    const agents = await getAgentPerformance(from, to);
    res.json({
      from: (req.query.from as string) || from.toISOString().slice(0, 10),
      to: (req.query.to as string) || to.toISOString().slice(0, 10),
      agents: agents.map(a => ({
        userId: a.id, userName: a.name,
        totalLeads: a.totalLeads, confirmedLeads: a.confirmedLeads,
        confirmationRate: a.confirmationRate, orderCount: a.orderCount,
        totalOrderValue: a.totalOrderValue, avgOrderValue: a.avgOrderValue,
        avgItemsPerOrder: a.avgItemsPerOrder,
      })),
    });
  } catch (err) {
    console.error('[reports/agents]', err);
    res.status(500).json({ error: 'خطأ في تحميل تقرير الموظفين' });
  }
});

// GET /api/reports/shifts?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/shifts', async (req: Request, res: Response) => {
  try {
    const [from, to] = parseDateRangeCairo(
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    );
    const shifts = await getShiftPerformance(from, to);
    res.json({
      from: (req.query.from as string) || from.toISOString().slice(0, 10),
      to: (req.query.to as string) || to.toISOString().slice(0, 10),
      shifts: shifts.map(s => ({
        shiftId: s.id, shiftName: s.name,
        totalLeads: s.totalLeads, confirmedLeads: s.confirmedLeads,
        confirmationRate: s.confirmationRate, orderCount: s.orderCount,
        totalOrderValue: s.totalOrderValue, avgOrderValue: s.avgOrderValue,
        avgItemsPerOrder: s.avgItemsPerOrder,
      })),
    });
  } catch (err) {
    console.error('[reports/shifts]', err);
    res.status(500).json({ error: 'خطأ في تحميل تقرير الشيفتات' });
  }
});

// GET /api/reports/sources?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/sources', async (req: Request, res: Response) => {
  try {
    const [from, to] = parseDateRangeCairo(
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    );
    const sources = await getSourcePerformance(from, to);
    res.json({
      from: (req.query.from as string) || from.toISOString().slice(0, 10),
      to: (req.query.to as string) || to.toISOString().slice(0, 10),
      ...sources,
    });
  } catch (err) {
    console.error('[reports/sources]', err);
    res.status(500).json({ error: 'خطأ في تحميل تقرير المصادر' });
  }
});

// GET /api/reports/general?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/general', async (req: Request, res: Response) => {
  try {
    const [from, to] = parseDateRangeCairo(
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    );
    const [totalLeads, totalOrders, totalOrderValue, leadsOverTime] = await Promise.all([
      getTotalLeads(from, to),
      getTotalOrders(from, to),
      getTotalOrderValue(from, to),
      getLeadsOverTime(from, to, 'day'),
    ]);

    res.json({
      from: (req.query.from as string) || from.toISOString().slice(0, 10),
      to: (req.query.to as string) || to.toISOString().slice(0, 10),
      totalLeads,
      totalOrders,
      conversionRate: totalLeads > 0 ? Math.round((totalOrders / totalLeads) * 100) : 0,
      totalOrderValue,
      leadsOverTime,
    });
  } catch (err) {
    console.error('[reports/general]', err);
    res.status(500).json({ error: 'خطأ في تحميل التقارير العامة' });
  }
});

export default router;
