/**
 * تقارير دولفين - موظفين / شيفتات / مصادر UTM
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

function parseDateRange(from?: string, to?: string): [Date, Date] {
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const toDate = to ? new Date(to) : new Date();
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(23, 59, 59, 999);
  return [fromDate, toDate];
}

// Prisma returns bigint for COUNT(*) — normalize everything to number
function toN(v: unknown): number {
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
}

type AgentRow = {
  user_id: string;
  user_name: string;
  total_leads: bigint;
  confirmed_leads: bigint;
  order_count: bigint;
  total_value: unknown;
  avg_order_value: unknown;
  avg_items_per_order: unknown;
};

type ShiftRow = {
  shift_id: string;
  shift_name: string;
  total_leads: bigint;
  confirmed_leads: bigint;
  order_count: bigint;
  total_value: unknown;
  avg_order_value: unknown;
  avg_items_per_order: unknown;
};

type SourceRow = {
  label: string;
  total_leads: bigint;
  confirmed_leads: bigint;
  order_count: bigint;
  total_order_value: unknown;
  avg_order_value: unknown;
};

type GeneralRow = {
  total_leads: bigint;
  total_orders: bigint;
  total_order_value: unknown;
  leads_over_time: unknown;
};

// بناء query المصادر بتعبير label متغيّر
function sourceQuery(labelExpr: string): string {
  return `
    WITH period_leads AS (
      SELECT
        l.id AS lead_id,
        ${labelExpr} AS label,
        ls.slug AS status_slug
      FROM leads l
      JOIN lead_statuses ls ON ls.id = l.status_id
      WHERE l.created_at >= $1 AND l.created_at <= $2
    ),
    period_orders AS (
      SELECT
        pl.label,
        o.id AS order_id,
        COALESCE(SUM(oi.price * oi.quantity), 0) AS order_value
      FROM period_leads pl
      JOIN orders o ON o.lead_id = pl.lead_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY pl.label, o.id
    ),
    lead_agg AS (
      SELECT
        label,
        COUNT(DISTINCT lead_id) AS total_leads,
        COUNT(DISTINCT CASE WHEN status_slug = 'confirmed' THEN lead_id END) AS confirmed_leads
      FROM period_leads
      GROUP BY label
    ),
    order_agg AS (
      SELECT
        label,
        COUNT(*) AS order_count,
        COALESCE(SUM(order_value), 0) AS total_order_value,
        COALESCE(AVG(order_value), 0) AS avg_order_value
      FROM period_orders
      GROUP BY label
    )
    SELECT
      la.label,
      la.total_leads,
      la.confirmed_leads,
      COALESCE(oa.order_count, 0) AS order_count,
      COALESCE(oa.total_order_value, 0) AS total_order_value,
      COALESCE(oa.avg_order_value, 0) AS avg_order_value
    FROM lead_agg la
    LEFT JOIN order_agg oa ON oa.label = la.label
    ORDER BY la.total_leads DESC
  `;
}

// GET /api/reports/agents?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const [from, to] = parseDateRange(
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    );

    const rows = await prisma.$queryRawUnsafe<AgentRow[]>(`
      WITH period_leads AS (
        SELECT l.id AS lead_id, l.assigned_to_id, ls.slug AS status_slug
        FROM leads l
        JOIN lead_statuses ls ON ls.id = l.status_id
        WHERE l.assigned_to_id IS NOT NULL
          AND l.created_at >= $1 AND l.created_at <= $2
      ),
      period_orders AS (
        SELECT
          o.id AS order_id,
          pl.assigned_to_id,
          COALESCE(SUM(oi.price * oi.quantity), 0) AS order_value,
          COALESCE(SUM(oi.quantity), 0) AS item_count
        FROM period_leads pl
        JOIN orders o ON o.lead_id = pl.lead_id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        GROUP BY o.id, pl.assigned_to_id
      ),
      lead_stats AS (
        SELECT
          assigned_to_id,
          COUNT(DISTINCT lead_id) AS total_leads,
          COUNT(DISTINCT CASE WHEN status_slug = 'confirmed' THEN lead_id END) AS confirmed_leads
        FROM period_leads
        GROUP BY assigned_to_id
      ),
      order_agg AS (
        SELECT
          assigned_to_id,
          COUNT(*) AS order_count,
          COALESCE(SUM(order_value), 0) AS total_value,
          COALESCE(AVG(order_value), 0) AS avg_order_value,
          COALESCE(AVG(item_count), 0) AS avg_items_per_order
        FROM period_orders
        GROUP BY assigned_to_id
      )
      SELECT
        u.id AS user_id,
        u.name AS user_name,
        COALESCE(ls.total_leads, 0) AS total_leads,
        COALESCE(ls.confirmed_leads, 0) AS confirmed_leads,
        COALESCE(oa.order_count, 0) AS order_count,
        COALESCE(oa.total_value, 0) AS total_value,
        COALESCE(oa.avg_order_value, 0) AS avg_order_value,
        COALESCE(oa.avg_items_per_order, 0) AS avg_items_per_order
      FROM users u
      LEFT JOIN lead_stats ls ON ls.assigned_to_id = u.id
      LEFT JOIN order_agg oa ON oa.assigned_to_id = u.id
      WHERE u.is_active = true AND ls.assigned_to_id IS NOT NULL
      ORDER BY COALESCE(ls.total_leads, 0) DESC
    `, from, to);

    res.json({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      agents: rows.map((r) => {
        const totalLeads = toN(r.total_leads);
        const confirmedLeads = toN(r.confirmed_leads);
        return {
          userId: r.user_id,
          userName: r.user_name,
          totalLeads,
          confirmedLeads,
          confirmationRate: totalLeads > 0 ? Math.round((confirmedLeads / totalLeads) * 100) : 0,
          orderCount: toN(r.order_count),
          totalOrderValue: Math.round(toN(r.total_value) * 100) / 100,
          avgOrderValue: Math.round(toN(r.avg_order_value) * 100) / 100,
          avgItemsPerOrder: Math.round(toN(r.avg_items_per_order) * 10) / 10,
        };
      }),
    });
  } catch (err) {
    console.error('[reports/agents]', err);
    res.status(500).json({ error: 'خطأ في تحميل تقرير الموظفين' });
  }
});

// GET /api/reports/shifts?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/shifts', async (req: Request, res: Response) => {
  try {
    const [from, to] = parseDateRange(
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    );

    const rows = await prisma.$queryRawUnsafe<ShiftRow[]>(`
      WITH shift_map AS (
        SELECT sm.shift_id, sm.user_id
        FROM shift_members sm
      ),
      period_leads AS (
        SELECT l.id AS lead_id, m.shift_id, ls.slug AS status_slug
        FROM leads l
        JOIN lead_statuses ls ON ls.id = l.status_id
        JOIN shift_map m ON m.user_id = l.assigned_to_id
        WHERE l.assigned_to_id IS NOT NULL
          AND l.created_at >= $1 AND l.created_at <= $2
      ),
      period_orders AS (
        SELECT
          o.id AS order_id,
          pl.shift_id,
          COALESCE(SUM(oi.price * oi.quantity), 0) AS order_value,
          COALESCE(SUM(oi.quantity), 0) AS item_count
        FROM period_leads pl
        JOIN orders o ON o.lead_id = pl.lead_id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        GROUP BY o.id, pl.shift_id
      ),
      lead_stats AS (
        SELECT
          shift_id,
          COUNT(DISTINCT lead_id) AS total_leads,
          COUNT(DISTINCT CASE WHEN status_slug = 'confirmed' THEN lead_id END) AS confirmed_leads
        FROM period_leads
        GROUP BY shift_id
      ),
      order_agg AS (
        SELECT
          shift_id,
          COUNT(*) AS order_count,
          COALESCE(SUM(order_value), 0) AS total_value,
          COALESCE(AVG(order_value), 0) AS avg_order_value,
          COALESCE(AVG(item_count), 0) AS avg_items_per_order
        FROM period_orders
        GROUP BY shift_id
      )
      SELECT
        s.id AS shift_id,
        s.name AS shift_name,
        COALESCE(ls.total_leads, 0) AS total_leads,
        COALESCE(ls.confirmed_leads, 0) AS confirmed_leads,
        COALESCE(oa.order_count, 0) AS order_count,
        COALESCE(oa.total_value, 0) AS total_value,
        COALESCE(oa.avg_order_value, 0) AS avg_order_value,
        COALESCE(oa.avg_items_per_order, 0) AS avg_items_per_order
      FROM shifts s
      LEFT JOIN lead_stats ls ON ls.shift_id = s.id
      LEFT JOIN order_agg oa ON oa.shift_id = s.id
      WHERE s.is_active = true
      ORDER BY COALESCE(ls.total_leads, 0) DESC
    `, from, to);

    res.json({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      shifts: rows.map((r) => {
        const totalLeads = toN(r.total_leads);
        const confirmedLeads = toN(r.confirmed_leads);
        return {
          shiftId: r.shift_id,
          shiftName: r.shift_name,
          totalLeads,
          confirmedLeads,
          confirmationRate: totalLeads > 0 ? Math.round((confirmedLeads / totalLeads) * 100) : 0,
          orderCount: toN(r.order_count),
          totalOrderValue: Math.round(toN(r.total_value) * 100) / 100,
          avgOrderValue: Math.round(toN(r.avg_order_value) * 100) / 100,
          avgItemsPerOrder: Math.round(toN(r.avg_items_per_order) * 10) / 10,
        };
      }),
    });
  } catch (err) {
    console.error('[reports/shifts]', err);
    res.status(500).json({ error: 'خطأ في تحميل تقرير الشيفتات' });
  }
});

// GET /api/reports/sources?from=YYYY-MM-DD&to=YYYY-MM-DD
// يرجع 3 تقسيمات: بـ utm_source / بـ utm_campaign / بـ مصدر النموذج
router.get('/sources', async (req: Request, res: Response) => {
  try {
    const [from, to] = parseDateRange(
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    );

    const [byUtmSource, byUtmCampaign, byForm] = await Promise.all([
      prisma.$queryRawUnsafe<SourceRow[]>(
        sourceQuery(`COALESCE(NULLIF(TRIM(l.custom_fields->>'مصدر الزيارة'), ''), '(غير محدد)')`),
        from, to,
      ),
      prisma.$queryRawUnsafe<SourceRow[]>(
        sourceQuery(`COALESCE(NULLIF(TRIM(l.custom_fields->>'الحملة الإعلانية'), ''), '(غير محدد)')`),
        from, to,
      ),
      prisma.$queryRawUnsafe<SourceRow[]>(
        sourceQuery(`COALESCE(NULLIF(TRIM(l.source_detail), ''), NULLIF(TRIM(l.source), ''), '(غير محدد)')`),
        from, to,
      ),
    ]);

    const mapRow = (r: SourceRow) => {
      const totalLeads = toN(r.total_leads);
      const confirmedLeads = toN(r.confirmed_leads);
      return {
        label: r.label,
        totalLeads,
        confirmedLeads,
        confirmationRate: totalLeads > 0 ? Math.round((confirmedLeads / totalLeads) * 100) : 0,
        orderCount: toN(r.order_count),
        totalOrderValue: Math.round(toN(r.total_order_value) * 100) / 100,
        avgOrderValue: Math.round(toN(r.avg_order_value) * 100) / 100,
      };
    };

    res.json({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      byUtmSource: byUtmSource.map(mapRow),
      byUtmCampaign: byUtmCampaign.map(mapRow),
      byForm: byForm.map(mapRow),
    });
  } catch (err) {
    console.error('[reports/sources]', err);
    res.status(500).json({ error: 'خطأ في تحميل تقرير المصادر' });
  }
});

// GET /api/reports/general?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/general', async (req: Request, res: Response) => {
  try {
    const [from, to] = parseDateRange(
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    );

    const rows = await prisma.$queryRawUnsafe<GeneralRow[]>(`
      WITH period_leads AS (
        SELECT l.id AS lead_id, DATE(l.created_at) AS lead_date
        FROM leads l
        WHERE l.created_at >= $1 AND l.created_at <= $2
      ),
      period_orders AS (
        SELECT o.id AS order_id, COALESCE(SUM(oi.price * oi.quantity), 0) AS order_value
        FROM orders o
        JOIN period_leads pl ON pl.lead_id = o.lead_id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        GROUP BY o.id
      ),
      daily AS (
        SELECT lead_date, COUNT(*) AS cnt
        FROM period_leads
        GROUP BY lead_date
        ORDER BY lead_date
      )
      SELECT
        (SELECT COUNT(*) FROM period_leads) AS total_leads,
        (SELECT COUNT(*) FROM period_orders) AS total_orders,
        (SELECT COALESCE(SUM(order_value), 0) FROM period_orders) AS total_order_value,
        (SELECT COALESCE(json_agg(json_build_object('date', lead_date::text, 'count', cnt::int) ORDER BY lead_date), '[]'::json) FROM daily) AS leads_over_time
    `, from, to);

    const r = rows[0];
    const totalLeads = toN(r?.total_leads);
    const totalOrders = toN(r?.total_orders);
    const totalOrderValue = Math.round(toN(r?.total_order_value) * 100) / 100;
    const leadsOverTime = (r?.leads_over_time as { date: string; count: number }[] | null) ?? [];

    res.json({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
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
