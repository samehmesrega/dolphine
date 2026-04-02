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

/**
 * GET /api/v1/marketing/media-buying/breakdown
 * ?by=sales|shift|status
 * &level=campaign|adset|ad
 * &parentId=UUID
 * &from=YYYY-MM-DD&to=YYYY-MM-DD
 */
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

      // Get adSet names linked to this parent
      let utmValues: string[] = [];

      if (level === 'campaign') {
        const adSets = await prisma.adSet.findMany({
          where: { campaignId: parentId },
          select: { name: true },
        });
        utmValues = adSets.map(a => a.name).filter(Boolean);
      } else if (level === 'adset') {
        const adSet = await prisma.adSet.findUnique({
          where: { id: parentId },
          select: { name: true },
        });
        if (adSet?.name) utmValues = [adSet.name];
      } else if (level === 'ad') {
        const ad = await prisma.ad.findUnique({
          where: { id: parentId },
          select: { creativeCode: true, adSet: { select: { name: true } } },
        });
        // For ads, match by adSet name (same as parent adset)
        if (ad?.adSet?.name) utmValues = [ad.adSet.name];
      }

      if (utmValues.length === 0) {
        res.json({ breakdown: [] });
        return;
      }

      // Base where clause for leads
      const leadWhere = {
        utmCampaign: { in: utmValues },
        createdAt: { gte: dateFrom, lte: dateTo },
        deletedAt: null as null,
      };

      const confirmedStatus = await prisma.leadStatus.findUnique({ where: { slug: 'confirmed' } });
      let breakdown: BreakdownRow[] = [];

      if (by === 'sales') {
        // Group by assigned sales agent
        const groups = await prisma.lead.groupBy({
          by: ['assignedToId'],
          where: leadWhere,
          _count: true,
        });

        // Get confirmed counts per agent
        const confirmedGroups = confirmedStatus ? await prisma.lead.groupBy({
          by: ['assignedToId'],
          where: { ...leadWhere, statusId: confirmedStatus.id },
          _count: true,
        }) : [];
        const confirmedMap = new Map(confirmedGroups.map(g => [g.assignedToId, g._count]));

        // Get order counts per agent
        const agentIds = groups.map(g => g.assignedToId).filter(Boolean) as string[];
        const orderCounts = agentIds.length > 0 ? await prisma.order.groupBy({
          by: ['leadId'],
          where: {
            lead: { assignedToId: { in: agentIds }, ...leadWhere },
            deletedAt: null,
          },
          _count: true,
        }) : [];

        // Map leadId → assignedToId for order counting
        const leadAssignments = agentIds.length > 0 ? await prisma.lead.findMany({
          where: { id: { in: orderCounts.map(o => o.leadId) } },
          select: { id: true, assignedToId: true },
        }) : [];
        const ordersByAgent = new Map<string, number>();
        for (const la of leadAssignments) {
          if (la.assignedToId) {
            ordersByAgent.set(la.assignedToId, (ordersByAgent.get(la.assignedToId) || 0) + 1);
          }
        }

        // Get user names
        const users = agentIds.length > 0 ? await prisma.user.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, name: true },
        }) : [];
        const userMap = new Map(users.map(u => [u.id, u.name]));

        breakdown = groups.map(g => ({
          id: g.assignedToId || 'unassigned',
          name: g.assignedToId ? (userMap.get(g.assignedToId) || 'غير معروف') : 'غير معيّن',
          leadCount: g._count,
          confirmedCount: confirmedMap.get(g.assignedToId) || 0,
          orderCount: g.assignedToId ? (ordersByAgent.get(g.assignedToId) || 0) : 0,
        }));
      } else if (by === 'shift') {
        // Group by shift (via shift_members)
        const leads = await prisma.lead.findMany({
          where: leadWhere,
          select: { id: true, assignedToId: true, statusId: true },
        });

        // Get all shift memberships
        const assignedIds = [...new Set(leads.map(l => l.assignedToId).filter(Boolean))] as string[];
        const shiftMembers = assignedIds.length > 0 ? await prisma.shiftMember.findMany({
          where: { userId: { in: assignedIds } },
          include: { shift: { select: { id: true, name: true } } },
        }) : [];

        // Map userId → shiftId + shiftName
        const userShiftMap = new Map<string, { id: string; name: string }>();
        for (const sm of shiftMembers) {
          // Take first shift if user is in multiple
          if (!userShiftMap.has(sm.userId)) {
            userShiftMap.set(sm.userId, { id: sm.shift.id, name: sm.shift.name });
          }
        }

        // Aggregate by shift
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

        breakdown = Array.from(shiftAgg.entries()).map(([id, data]) => ({
          id,
          name: data.name,
          leadCount: data.leads,
          confirmedCount: data.confirmed,
          orderCount: 0, // simplified for shifts
        }));
      } else if (by === 'status') {
        // Group by lead status
        const groups = await prisma.lead.groupBy({
          by: ['statusId'],
          where: leadWhere,
          _count: true,
        });

        const statusIds = groups.map(g => g.statusId).filter(Boolean);
        const statuses = statusIds.length > 0 ? await prisma.leadStatus.findMany({
          where: { id: { in: statusIds } },
          select: { id: true, name: true, slug: true },
        }) : [];
        const statusMap = new Map(statuses.map(s => [s.id, s]));

        breakdown = groups.map(g => {
          const status = statusMap.get(g.statusId);
          return {
            id: g.statusId,
            name: status?.name || 'غير محدد',
            leadCount: g._count,
            confirmedCount: status?.slug === 'confirmed' ? g._count : 0,
            orderCount: 0,
          };
        });
      }

      // Sort by leadCount descending
      breakdown.sort((a, b) => b.leadCount - a.leadCount);

      res.json({ breakdown });
    } catch (err: any) {
      console.error('[Breakdown]', err);
      res.status(500).json({ error: 'خطأ في تحميل التقسيم' });
    }
  },
);

export default router;
