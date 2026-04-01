/**
 * Shared Metrics Service — مصدر موحد لكل الأرقام في دولفين
 *
 * القواعد الثابتة:
 * - Timezone: Africa/Cairo (مع دعم التوقيت الصيفي)
 * - Soft deletes: دايماً WHERE deleted_at IS NULL
 * - Order value: SUM(price * quantity) - COALESCE(discount, 0)
 * - Confirmed: lead_statuses.slug = 'confirmed'
 */

import { prisma } from '../../db';

// ──────────────── Timezone Helper ────────────────

/**
 * يحول تاريخ YYYY-MM-DD لـ Date object بتوقيت القاهرة
 * بيدعم التوقيت الصيفي (DST) عن طريق Intl.DateTimeFormat
 */
function cairoToUTC(dateStr: string, endOfDay = false): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  // نحسب الـ UTC offset لتوقيت القاهرة في التاريخ ده
  const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const cairoFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = cairoFormatter.formatToParts(testDate);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  const cairoHour = get('hour');
  const utcHour = testDate.getUTCHours();
  const offset = cairoHour - utcHour; // +2 or +3 depending on DST

  if (endOfDay) {
    // 23:59:59.999 بتوقيت القاهرة
    return new Date(Date.UTC(year, month - 1, day, 23 - offset, 59, 59, 999));
  }
  // 00:00:00.000 بتوقيت القاهرة
  return new Date(Date.UTC(year, month - 1, day, 0 - offset, 0, 0, 0));
}

/**
 * Helper موحد لتحويل from/to → Date objects بتوقيت القاهرة
 * Default: آخر 30 يوم
 */
export function parseDateRangeCairo(from?: string, to?: string): [Date, Date] {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  if (!to) {
    // today in Cairo
    const now = new Date();
    const cairoNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    to = fmt(cairoNow);
  }
  if (!from) {
    const d = new Date(to);
    d.setDate(d.getDate() - 29);
    from = fmt(d);
  }
  return [cairoToUTC(from, false), cairoToUTC(to, true)];
}

// SQL timezone expression for Africa/Cairo
const CAIRO_TZ = `'Africa/Cairo'`;
const TRUNC_DAY = `date_trunc('day', l.created_at AT TIME ZONE ${CAIRO_TZ})`;
const TRUNC_WEEK = `date_trunc('week', l.created_at AT TIME ZONE ${CAIRO_TZ})`;

// ──────────────── Normalize bigint ────────────────

function toN(v: unknown): number {
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
}

// ──────────────── Core Metrics ────────────────

export async function getTotalLeads(from: Date, to: Date): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) AS count FROM leads WHERE created_at >= $1 AND created_at <= $2 AND deleted_at IS NULL`,
    from, to,
  );
  return toN(rows[0]?.count);
}

export async function getTotalOrders(from: Date, to: Date): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) AS count FROM orders o
     JOIN leads l ON l.id = o.lead_id
     WHERE l.created_at >= $1 AND l.created_at <= $2
       AND o.deleted_at IS NULL AND l.deleted_at IS NULL`,
    from, to,
  );
  return toN(rows[0]?.count);
}

export async function getConfirmedOrders(from: Date, to: Date): Promise<{ count: number; totalValue: number }> {
  const rows = await prisma.$queryRawUnsafe<[{ count: bigint; total_value: unknown }]>(
    `SELECT
       COUNT(DISTINCT o.id) AS count,
       COALESCE(SUM(sub.order_value), 0) AS total_value
     FROM leads l
     JOIN lead_statuses ls ON ls.id = l.status_id
     JOIN orders o ON o.lead_id = l.id
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(oi.price * oi.quantity), 0) - COALESCE(o2.discount, 0) AS order_value
       FROM order_items oi, orders o2
       WHERE oi.order_id = o.id AND o2.id = o.id
     ) sub ON true
     WHERE ls.slug = 'confirmed'
       AND l.created_at >= $1 AND l.created_at <= $2
       AND l.deleted_at IS NULL AND o.deleted_at IS NULL`,
    from, to,
  );
  return {
    count: toN(rows[0]?.count),
    totalValue: Math.round(toN(rows[0]?.total_value) * 100) / 100,
  };
}

export async function getPendingOrders(): Promise<number> {
  return prisma.order.count({ where: { accountsStatus: 'pending', deletedAt: null } });
}

export async function getConversionRate(from: Date, to: Date): Promise<number> {
  const total = await getTotalLeads(from, to);
  if (total === 0) return 0;
  const confirmed = await getConfirmedOrders(from, to);
  return Math.round((confirmed.count / total) * 100);
}

export async function getTotalOrderValue(from: Date, to: Date): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<[{ total: unknown }]>(
    `SELECT COALESCE(SUM(sub.val), 0) AS total FROM (
       SELECT COALESCE(SUM(oi.price * oi.quantity), 0) - COALESCE(o.discount, 0) AS val
       FROM orders o
       JOIN leads l ON l.id = o.lead_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE l.created_at >= $1 AND l.created_at <= $2
         AND o.deleted_at IS NULL AND l.deleted_at IS NULL
       GROUP BY o.id, o.discount
     ) sub`,
    from, to,
  );
  return Math.round(toN(rows[0]?.total) * 100) / 100;
}

// ──────────────── Time Series ────────────────

export async function getLeadsOverTime(
  from: Date, to: Date, groupBy: 'day' | 'week' = 'day',
): Promise<{ date: string; count: number }[]> {
  const trunc = groupBy === 'week' ? TRUNC_WEEK : TRUNC_DAY;
  const rows = await prisma.$queryRawUnsafe<{ period: Date; count: number }[]>(
    `SELECT ${trunc} AS period, COUNT(*)::int AS count
     FROM leads l
     WHERE l.created_at >= $1 AND l.created_at <= $2 AND l.deleted_at IS NULL
     GROUP BY 1 ORDER BY 1`,
    from, to,
  );
  return rows.map(r => ({ date: r.period.toISOString().slice(0, 10), count: Number(r.count) }));
}

export async function getOrdersByStatus(from?: Date, to?: Date): Promise<{ status: string; count: number }[]> {
  let whereClause = 'WHERE o.deleted_at IS NULL';
  const params: Date[] = [];
  if (from && to) {
    whereClause += ' AND o.created_at >= $1 AND o.created_at <= $2';
    params.push(from, to);
  }
  const rows = await prisma.$queryRawUnsafe<{ status: string; count: bigint }[]>(
    `SELECT o.status, COUNT(*) AS count FROM orders o ${whereClause} GROUP BY o.status ORDER BY count DESC`,
    ...params,
  );
  return rows.map(r => ({ status: r.status, count: toN(r.count) }));
}

// ──────────────── Agent & Shift Performance ────────────────

// القيمة = SUM(items) - discount لكل أوردر
const ORDER_VALUE_EXPR = `COALESCE(SUM(oi.price * oi.quantity), 0) - COALESCE(o.discount, 0)`;

export type PerformanceRow = {
  id: string;
  name: string;
  totalLeads: number;
  confirmedLeads: number;
  confirmationRate: number;
  orderCount: number;
  totalOrderValue: number;
  avgOrderValue: number;
  avgItemsPerOrder: number;
};

export async function getAgentPerformance(from: Date, to: Date): Promise<PerformanceRow[]> {
  type Row = {
    user_id: string; user_name: string;
    total_leads: bigint; confirmed_leads: bigint; order_count: bigint;
    total_value: unknown; avg_order_value: unknown; avg_items_per_order: unknown;
  };
  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    WITH period_leads AS (
      SELECT l.id AS lead_id, l.assigned_to_id, ls.slug AS status_slug
      FROM leads l
      JOIN lead_statuses ls ON ls.id = l.status_id
      WHERE l.assigned_to_id IS NOT NULL
        AND l.created_at >= $1 AND l.created_at <= $2
        AND l.deleted_at IS NULL
    ),
    period_orders AS (
      SELECT
        o.id AS order_id, pl.assigned_to_id,
        ${ORDER_VALUE_EXPR} AS order_value,
        COALESCE(SUM(oi.quantity), 0) AS item_count
      FROM period_leads pl
      JOIN orders o ON o.lead_id = pl.lead_id AND o.deleted_at IS NULL
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id, o.discount, pl.assigned_to_id
    ),
    lead_stats AS (
      SELECT assigned_to_id,
        COUNT(DISTINCT lead_id) AS total_leads,
        COUNT(DISTINCT CASE WHEN status_slug = 'confirmed' THEN lead_id END) AS confirmed_leads
      FROM period_leads GROUP BY assigned_to_id
    ),
    order_agg AS (
      SELECT assigned_to_id,
        COUNT(*) AS order_count,
        COALESCE(SUM(order_value), 0) AS total_value,
        COALESCE(AVG(order_value), 0) AS avg_order_value,
        COALESCE(AVG(item_count), 0) AS avg_items_per_order
      FROM period_orders GROUP BY assigned_to_id
    )
    SELECT u.id AS user_id, u.name AS user_name,
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

  return rows.map(r => {
    const totalLeads = toN(r.total_leads);
    const confirmedLeads = toN(r.confirmed_leads);
    return {
      id: r.user_id, name: r.user_name, totalLeads, confirmedLeads,
      confirmationRate: totalLeads > 0 ? Math.round((confirmedLeads / totalLeads) * 100) : 0,
      orderCount: toN(r.order_count),
      totalOrderValue: Math.round(toN(r.total_value) * 100) / 100,
      avgOrderValue: Math.round(toN(r.avg_order_value) * 100) / 100,
      avgItemsPerOrder: Math.round(toN(r.avg_items_per_order) * 10) / 10,
    };
  });
}

export async function getShiftPerformance(from: Date, to: Date): Promise<PerformanceRow[]> {
  type Row = {
    shift_id: string; shift_name: string;
    total_leads: bigint; confirmed_leads: bigint; order_count: bigint;
    total_value: unknown; avg_order_value: unknown; avg_items_per_order: unknown;
  };
  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    WITH shift_map AS (
      SELECT sm.shift_id, sm.user_id FROM shift_members sm
    ),
    period_leads AS (
      SELECT l.id AS lead_id, m.shift_id, ls.slug AS status_slug
      FROM leads l
      JOIN lead_statuses ls ON ls.id = l.status_id
      JOIN shift_map m ON m.user_id = l.assigned_to_id
      WHERE l.assigned_to_id IS NOT NULL
        AND l.created_at >= $1 AND l.created_at <= $2
        AND l.deleted_at IS NULL
    ),
    period_orders AS (
      SELECT o.id AS order_id, pl.shift_id,
        ${ORDER_VALUE_EXPR} AS order_value,
        COALESCE(SUM(oi.quantity), 0) AS item_count
      FROM period_leads pl
      JOIN orders o ON o.lead_id = pl.lead_id AND o.deleted_at IS NULL
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id, o.discount, pl.shift_id
    ),
    lead_stats AS (
      SELECT shift_id,
        COUNT(DISTINCT lead_id) AS total_leads,
        COUNT(DISTINCT CASE WHEN status_slug = 'confirmed' THEN lead_id END) AS confirmed_leads
      FROM period_leads GROUP BY shift_id
    ),
    order_agg AS (
      SELECT shift_id,
        COUNT(*) AS order_count,
        COALESCE(SUM(order_value), 0) AS total_value,
        COALESCE(AVG(order_value), 0) AS avg_order_value,
        COALESCE(AVG(item_count), 0) AS avg_items_per_order
      FROM period_orders GROUP BY shift_id
    )
    SELECT s.id AS shift_id, s.name AS shift_name,
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

  return rows.map(r => {
    const totalLeads = toN(r.total_leads);
    const confirmedLeads = toN(r.confirmed_leads);
    return {
      id: r.shift_id, name: r.shift_name, totalLeads, confirmedLeads,
      confirmationRate: totalLeads > 0 ? Math.round((confirmedLeads / totalLeads) * 100) : 0,
      orderCount: toN(r.order_count),
      totalOrderValue: Math.round(toN(r.total_value) * 100) / 100,
      avgOrderValue: Math.round(toN(r.avg_order_value) * 100) / 100,
      avgItemsPerOrder: Math.round(toN(r.avg_items_per_order) * 10) / 10,
    };
  });
}

// ──────────────── Source Performance ────────────────

const ALLOWED_LABEL_EXPRS: Record<string, string> = {
  utm_source: `COALESCE(NULLIF(TRIM(l.custom_fields->>'مصدر الزيارة'), ''), '(غير محدد)')`,
  utm_campaign: `COALESCE(NULLIF(TRIM(l.custom_fields->>'الحملة الإعلانية'), ''), '(غير محدد)')`,
  form_source: `COALESCE(NULLIF(TRIM(l.source_detail), ''), NULLIF(TRIM(l.source), ''), '(غير محدد)')`,
};

export type SourceRow = {
  label: string;
  totalLeads: number;
  confirmedLeads: number;
  confirmationRate: number;
  orderCount: number;
  totalOrderValue: number;
  avgOrderValue: number;
};

export async function getSourcePerformance(
  from: Date, to: Date,
): Promise<{ byUtmSource: SourceRow[]; byUtmCampaign: SourceRow[]; byForm: SourceRow[] }> {
  type RawRow = {
    label: string; total_leads: bigint; confirmed_leads: bigint;
    order_count: bigint; total_order_value: unknown; avg_order_value: unknown;
  };

  function buildQuery(labelKey: string): string {
    const labelExpr = ALLOWED_LABEL_EXPRS[labelKey];
    if (!labelExpr) throw new Error(`Invalid label key: ${labelKey}`);
    return `
      WITH period_leads AS (
        SELECT l.id AS lead_id, ${labelExpr} AS label, ls.slug AS status_slug
        FROM leads l
        JOIN lead_statuses ls ON ls.id = l.status_id
        WHERE l.created_at >= $1 AND l.created_at <= $2 AND l.deleted_at IS NULL
      ),
      period_orders AS (
        SELECT pl.label, o.id AS order_id,
          ${ORDER_VALUE_EXPR} AS order_value
        FROM period_leads pl
        JOIN orders o ON o.lead_id = pl.lead_id AND o.deleted_at IS NULL
        LEFT JOIN order_items oi ON oi.order_id = o.id
        GROUP BY pl.label, o.id, o.discount
      ),
      lead_agg AS (
        SELECT label,
          COUNT(DISTINCT lead_id) AS total_leads,
          COUNT(DISTINCT CASE WHEN status_slug = 'confirmed' THEN lead_id END) AS confirmed_leads
        FROM period_leads GROUP BY label
      ),
      order_agg AS (
        SELECT label,
          COUNT(*) AS order_count,
          COALESCE(SUM(order_value), 0) AS total_order_value,
          COALESCE(AVG(order_value), 0) AS avg_order_value
        FROM period_orders GROUP BY label
      )
      SELECT la.label, la.total_leads, la.confirmed_leads,
        COALESCE(oa.order_count, 0) AS order_count,
        COALESCE(oa.total_order_value, 0) AS total_order_value,
        COALESCE(oa.avg_order_value, 0) AS avg_order_value
      FROM lead_agg la
      LEFT JOIN order_agg oa ON oa.label = la.label
      ORDER BY la.total_leads DESC
    `;
  }

  function mapRow(r: RawRow): SourceRow {
    const totalLeads = toN(r.total_leads);
    const confirmedLeads = toN(r.confirmed_leads);
    return {
      label: r.label, totalLeads, confirmedLeads,
      confirmationRate: totalLeads > 0 ? Math.round((confirmedLeads / totalLeads) * 100) : 0,
      orderCount: toN(r.order_count),
      totalOrderValue: Math.round(toN(r.total_order_value) * 100) / 100,
      avgOrderValue: Math.round(toN(r.avg_order_value) * 100) / 100,
    };
  }

  const [byUtmSource, byUtmCampaign, byForm] = await Promise.all([
    prisma.$queryRawUnsafe<RawRow[]>(buildQuery('utm_source'), from, to),
    prisma.$queryRawUnsafe<RawRow[]>(buildQuery('utm_campaign'), from, to),
    prisma.$queryRawUnsafe<RawRow[]>(buildQuery('form_source'), from, to),
  ]);

  return {
    byUtmSource: byUtmSource.map(mapRow),
    byUtmCampaign: byUtmCampaign.map(mapRow),
    byForm: byForm.map(mapRow),
  };
}
