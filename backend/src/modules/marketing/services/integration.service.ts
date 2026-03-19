import { prisma } from '../../../db';

interface DateRange {
  from?: string;
  to?: string;
}

// === Creative ROI (cross-module: Marketing + Leads) ===

export async function getCreativeROI(creativeCode: string, dateRange: DateRange) {
  const dateFilter: any = {};
  if (dateRange.from) dateFilter.gte = new Date(dateRange.from);
  if (dateRange.to) dateFilter.lte = new Date(dateRange.to);

  // 1. Ad spend from metrics
  const adMetrics = await prisma.adMetric.aggregate({
    where: {
      ad: { creativeCode },
      ...(dateRange.from || dateRange.to ? { date: dateFilter } : {}),
    },
    _sum: { spend: true, impressions: true, clicks: true },
  });

  // 2. Leads from Dolphin Leads (cross-module)
  const leadCount = await prisma.lead.count({
    where: {
      creativeCode,
      ...(dateRange.from || dateRange.to ? { createdAt: dateFilter } : {}),
    },
  });

  // 3. Orders from leads with this creative
  const ordersData = await prisma.order.findMany({
    where: {
      lead: { creativeCode },
      ...(dateRange.from || dateRange.to ? { createdAt: dateFilter } : {}),
    },
    include: { orderItems: true },
  });

  const totalRevenue = ordersData.reduce((sum, o) => {
    const itemsTotal = o.orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
    return sum + itemsTotal - (o.discount || 0);
  }, 0);

  const spend = adMetrics._sum.spend || 0;
  const impressions = adMetrics._sum.impressions || 0;
  const clicks = adMetrics._sum.clicks || 0;

  return {
    creativeCode,
    spend,
    impressions,
    clicks,
    leads: leadCount,
    orders: ordersData.length,
    revenue: totalRevenue,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpl: leadCount > 0 ? spend / leadCount : 0,
    cpa: ordersData.length > 0 ? spend / ordersData.length : 0,
    roas: spend > 0 ? totalRevenue / spend : 0,
  };
}

// === Marketing Dashboard Stats (cross-module) ===

export async function getDashboardStats(dateRange: DateRange) {
  const dateFilter: any = {};
  if (dateRange.from) dateFilter.gte = new Date(dateRange.from);
  if (dateRange.to) dateFilter.lte = new Date(dateRange.to);

  const createdAtFilter = dateRange.from || dateRange.to ? { createdAt: dateFilter } : {};

  // Parallel queries for speed
  const [
    totalCreatives,
    pendingRequests,
    newIdeas,
    totalScripts,
    totalLandingPages,
    publishedLPs,
    leadsFromMarketing,
    ordersFromMarketing,
    adSpend,
    topCreatives,
    recentLeads,
  ] = await Promise.all([
    // Content stats
    prisma.creative.count({ where: createdAtFilter }),
    prisma.creativeRequest.count({ where: { status: 'NEW' } }),
    prisma.idea.count({ where: { status: 'NEW' } }),
    prisma.script.count({ where: createdAtFilter }),
    prisma.landingPage.count(),
    prisma.landingPage.count({ where: { status: 'PUBLISHED' } }),

    // Cross-module: Leads from marketing sources
    prisma.lead.count({
      where: {
        ...createdAtFilter,
        OR: [
          { source: 'landing_page' },
          { creativeCode: { not: null } },
          { utmSource: { not: null } },
        ],
      },
    }),

    // Cross-module: Orders from marketing leads
    prisma.order.count({
      where: {
        ...createdAtFilter,
        lead: {
          OR: [
            { source: 'landing_page' },
            { creativeCode: { not: null } },
            { utmSource: { not: null } },
          ],
        },
      },
    }),

    // Ad spend
    prisma.adMetric.aggregate({
      where: dateRange.from || dateRange.to ? { date: dateFilter } : {},
      _sum: { spend: true, leads: true, revenue: true },
    }),

    // Top creatives by lead count (cross-module)
    prisma.lead.groupBy({
      by: ['creativeCode'],
      where: {
        creativeCode: { not: null },
        ...createdAtFilter,
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),

    // Recent leads from marketing
    prisma.lead.findMany({
      where: {
        ...createdAtFilter,
        OR: [
          { source: 'landing_page' },
          { creativeCode: { not: null } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        source: true,
        creativeCode: true,
        utmSource: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const totalAdSpend = adSpend._sum.spend || 0;
  const totalAdLeads = adSpend._sum.leads || 0;
  const totalAdRevenue = adSpend._sum.revenue || 0;

  return {
    content: {
      totalCreatives,
      pendingRequests,
      newIdeas,
      totalScripts,
      totalLandingPages,
      publishedLPs,
    },
    performance: {
      leadsFromMarketing,
      ordersFromMarketing,
      totalAdSpend,
      totalAdLeads,
      totalAdRevenue,
      overallROAS: totalAdSpend > 0 ? totalAdRevenue / totalAdSpend : 0,
      overallCPL: totalAdLeads > 0 ? totalAdSpend / totalAdLeads : 0,
    },
    topCreatives: topCreatives.map((tc) => ({
      creativeCode: tc.creativeCode,
      leadCount: tc._count.id,
    })),
    recentLeads,
  };
}

// === Leads by Source Breakdown ===

export async function getLeadsBySource(dateRange: DateRange) {
  const dateFilter: any = {};
  if (dateRange.from) dateFilter.gte = new Date(dateRange.from);
  if (dateRange.to) dateFilter.lte = new Date(dateRange.to);

  const createdAtFilter = dateRange.from || dateRange.to ? { createdAt: dateFilter } : {};

  const bySource = await prisma.lead.groupBy({
    by: ['source'],
    where: createdAtFilter,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  const byUtmSource = await prisma.lead.groupBy({
    by: ['utmSource'],
    where: {
      ...createdAtFilter,
      utmSource: { not: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  return {
    bySource: bySource.map((s) => ({ source: s.source, count: s._count.id })),
    byUtmSource: byUtmSource.map((s) => ({ utmSource: s.utmSource, count: s._count.id })),
  };
}
