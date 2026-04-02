/**
 * Media Buying Breakdown — تقسيم الليدز بالسيلز / الشيفت / حالة الليد
 * On-demand: يتجاب لما اليوزر يفتح صف معين
 */

import { Router, Response } from 'express';
import { prisma } from '../../../db';
import { requirePermission, AuthRequest } from '../../../shared/middleware/auth';
import { parseDateRangeCairo } from '../../../shared/services/metrics.service';

const router = Router();

type BreakdownRow = {
  id: string;
  name: string;
  leadCount: number;
  confirmedCount: number;
  orderCount: number;
};

// ── Shared breakdown builders ──

async function buildSalesBreakdown(leadWhere: any, confirmedStatus: any): Promise<BreakdownRow[]> {
  const groups = await prisma.lead.groupBy({ by: ['assignedToId'], where: leadWhere, _count: true });
  const confirmedGroups = confirmedStatus
    ? await prisma.lead.groupBy({ by: ['assignedToId'], where: { ...leadWhere, statusId: confirmedStatus.id }, _count: true })
    : [];
  const confirmedMap = new Map(confirmedGroups.map(g => [g.assignedToId, g._count]));
  const agentIds = groups.map(g => g.assignedToId).filter(Boolean) as string[];
  const users = agentIds.length > 0 ? await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } }) : [];
  const userMap = new Map(users.map(u => [u.id, u.name]));

  return groups.map(g => ({
    id: g.assignedToId || 'unassigned',
    name: g.assignedToId ? (userMap.get(g.assignedToId) || 'غير معروف') : 'غير معيّن',
    leadCount: g._count,
    confirmedCount: confirmedMap.get(g.assignedToId) || 0,
    orderCount: 0,
  }));
}

async function buildShiftBreakdown(leadWhere: any, confirmedStatus: any): Promise<BreakdownRow[]> {
  const leads = await prisma.lead.findMany({ where: leadWhere, select: { id: true, assignedToId: true, statusId: true } });
  const assignedIds = [...new Set(leads.map(l => l.assignedToId).filter(Boolean))] as string[];
  const shiftMembers = assignedIds.length > 0
    ? await prisma.shiftMember.findMany({ where: { userId: { in: assignedIds } }, include: { shift: { select: { id: true, name: true } } } })
    : [];
  const userShiftMap = new Map<string, { id: string; name: string }>();
  for (const sm of shiftMembers) {
    if (!userShiftMap.has(sm.userId)) userShiftMap.set(sm.userId, { id: sm.shift.id, name: sm.shift.name });
  }
  const shiftAgg = new Map<string, { name: string; leads: number; confirmed: number }>();
  for (const lead of leads) {
    const shift = lead.assignedToId ? userShiftMap.get(lead.assignedToId) : null;
    const key = shift?.id || 'no-shift';
    const name = shift?.name || 'بدون شيفت';
    const entry = shiftAgg.get(key) || { name, leads: 0, confirmed: 0 };
    entry.leads++;
    if (confirmedStatus && lead.statusId === confirmedStatus.id) entry.confirmed++;
    shiftAgg.set(key, entry);
  }
  return Array.from(shiftAgg.entries()).map(([id, data]) => ({
    id, name: data.name, leadCount: data.leads, confirmedCount: data.confirmed, orderCount: 0,
  }));
}

async function buildStatusBreakdown(leadWhere: any): Promise<BreakdownRow[]> {
  const groups = await prisma.lead.groupBy({ by: ['statusId'], where: leadWhere, _count: true });
  const statusIds = groups.map(g => g.statusId).filter(Boolean);
  const statuses = statusIds.length > 0 ? await prisma.leadStatus.findMany({ where: { id: { in: statusIds } }, select: { id: true, name: true, slug: true } }) : [];
  const statusMap = new Map(statuses.map(s => [s.id, s]));
  return groups.map(g => {
    const status = statusMap.get(g.statusId);
    return { id: g.statusId, name: status?.name || 'غير محدد', leadCount: g._count, confirmedCount: status?.slug === 'confirmed' ? g._count : 0, orderCount: 0 };
  });
}

async function getBreakdown(by: string, leadWhere: any): Promise<BreakdownRow[]> {
  const confirmedStatus = await prisma.leadStatus.findUnique({ where: { slug: 'confirmed' } });
  if (by === 'sales') return buildSalesBreakdown(leadWhere, confirmedStatus);
  if (by === 'shift') return buildShiftBreakdown(leadWhere, confirmedStatus);
  if (by === 'status') return buildStatusBreakdown(leadWhere);
  return [];
}

// ── Route ──

router.get(
  '/',
  requirePermission('marketing.media-buying.view'),
  async (req: AuthRequest, res: Response) => {
    try {
      const by = req.query.by as string;
      const level = req.query.level as string;
      const parentId = req.query.parentId as string;

      if (!by || !['sales', 'shift', 'status'].includes(by)) {
        res.status(400).json({ error: 'by must be: sales, shift, or status' });
        return;
      }
      if (!level || !['campaign', 'adset', 'ad'].includes(level)) {
        res.status(400).json({ error: 'level must be: campaign, adset, or ad' });
        return;
      }
      if (!parentId) {
        res.status(400).json({ error: 'parentId required' });
        return;
      }

      const [dateFrom, dateTo] = parseDateRangeCairo(
        (req.query.from as string)?.split('T')[0],
        (req.query.to as string)?.split('T')[0],
      );

      const dateFilter = { createdAt: { gte: dateFrom, lte: dateTo }, deletedAt: null as null };

      let leadWhere: any;

      if (level === 'campaign') {
        const adSets = await prisma.adSet.findMany({ where: { campaignId: parentId }, select: { name: true } });
        const names = adSets.map(a => a.name).filter(Boolean);
        if (names.length === 0) { res.json({ breakdown: [] }); return; }
        leadWhere = { utmCampaign: { in: names }, ...dateFilter };

      } else if (level === 'adset') {
        const adSet = await prisma.adSet.findUnique({ where: { id: parentId }, select: { name: true } });
        if (!adSet?.name) { res.json({ breakdown: [] }); return; }
        leadWhere = { utmCampaign: adSet.name, ...dateFilter };

      } else if (level === 'ad') {
        const ad = await prisma.ad.findUnique({
          where: { id: parentId },
          select: { creativeCode: true, adSet: { select: { name: true } } },
        });
        if (!ad) { res.json({ breakdown: [] }); return; }
        // Prefer creativeCode for exact match, fallback to adSet.name
        if (ad.creativeCode) {
          leadWhere = { creativeCode: ad.creativeCode, ...dateFilter };
        } else if (ad.adSet?.name) {
          leadWhere = { utmCampaign: ad.adSet.name, ...dateFilter };
        } else {
          res.json({ breakdown: [] }); return;
        }
      }

      const breakdown = await getBreakdown(by, leadWhere);
      breakdown.sort((a, b) => b.leadCount - a.leadCount);
      res.json({ breakdown });
    } catch (err: any) {
      console.error('[Breakdown]', err);
      res.status(500).json({ error: 'خطأ في تحميل التقسيم' });
    }
  },
);

export default router;
