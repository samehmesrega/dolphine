import { prisma } from '../../../db';

// === Ad Accounts ===

export async function listAdAccounts() {
  return prisma.adAccount.findMany({
    where: { isActive: true },
    include: { brand: true, _count: { select: { campaigns: true, syncLogs: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function connectAdAccount(data: {
  platform: string;
  accountId: string;
  accountName: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: string;
  brandId: string;
}) {
  const { encryptToken } = await import('../../../shared/utils/token-encryption');
  return prisma.adAccount.create({
    data: {
      platform: data.platform,
      accountId: data.accountId,
      accountName: data.accountName,
      accessToken: encryptToken(data.accessToken),
      refreshToken: data.refreshToken ? encryptToken(data.refreshToken) : null,
      tokenExpiry: data.tokenExpiry ? new Date(data.tokenExpiry) : null,
      brandId: data.brandId,
    },
    include: { brand: true },
  });
}

export async function disconnectAdAccount(id: string) {
  return prisma.adAccount.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function getSyncLogs(adAccountId: string, limit = 20) {
  return prisma.syncLog.findMany({
    where: { adAccountId },
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
}

// === Dashboard Queries ===

export interface DashboardFilters {
  from?: string;
  to?: string;
  platform?: string;
  brandId?: string;
  adAccountId?: string;
}

async function resolveAccountIds(filters: DashboardFilters): Promise<string[] | undefined> {
  if (filters.adAccountId) return [filters.adAccountId];
  if (!filters.platform && !filters.brandId) return undefined;
  const accounts = await prisma.adAccount.findMany({
    where: {
      isActive: true,
      ...(filters.platform && { platform: filters.platform }),
      ...(filters.brandId && { brandId: filters.brandId }),
    },
    select: { id: true },
  });
  return accounts.map((a) => a.id);
}

function buildMetricWhere(filters: DashboardFilters, accountIds?: string[]) {
  const where: Record<string, unknown> = {};
  if (filters.from || filters.to) {
    where.date = {};
    if (filters.from) {
      // "2026-03-17" → start of day UTC
      (where.date as Record<string, unknown>).gte = new Date(`${filters.from.split('T')[0]}T00:00:00.000Z`);
    }
    if (filters.to) {
      // "2026-03-24" → end of day UTC (include the full day)
      (where.date as Record<string, unknown>).lte = new Date(`${filters.to.split('T')[0]}T23:59:59.999Z`);
    }
  }
  if (accountIds && accountIds.length > 0) {
    where.adAccountId = { in: accountIds };
  }
  return where;
}

export async function getOverviewMetrics(filters: DashboardFilters) {
  const accountIds = await resolveAccountIds(filters);
  const where = buildMetricWhere(filters, accountIds);

  const metrics = await prisma.adMetric.aggregate({
    where,
    _sum: {
      impressions: true,
      clicks: true,
      spend: true,
      conversions: true,
      leads: true,
      purchases: true,
      revenue: true,
    },
  });

  const s = metrics._sum;
  const spend = s.spend || 0;
  const metaLeads = s.leads || 0;
  const purchases = s.purchases || 0;  // Meta "purchase" = Digitics "lead"
  const revenue = s.revenue || 0;
  const clicks = s.clicks || 0;
  const impressions = s.impressions || 0;

  // Dolphin confirmed orders (leads with accounts_confirmed status)
  const dateFrom = filters.from ? new Date(`${filters.from.split('T')[0]}T00:00:00.000Z`) : undefined;
  const dateTo = filters.to ? new Date(`${filters.to.split('T')[0]}T23:59:59.999Z`) : undefined;

  const confirmedStatus = await prisma.leadStatus.findUnique({ where: { slug: 'accounts_confirmed' } });
  const confirmedOrders = confirmedStatus ? await prisma.lead.count({
    where: {
      ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
      statusId: confirmedStatus.id,
      deletedAt: null,
    },
  }) : 0;

  // Order values for AOVL (all leads) and AOVP (confirmed only)
  const orderDateWhere = {
    ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
    deletedAt: null,
  };

  const allOrderAgg = await prisma.order.aggregate({
    where: orderDateWhere,
    _sum: { partialAmount: true },
    _count: true,
  });

  const confirmedOrderAgg = confirmedStatus ? await prisma.order.aggregate({
    where: {
      ...orderDateWhere,
      lead: { statusId: confirmedStatus.id },
    },
    _sum: { partialAmount: true },
    _count: true,
  }) : { _sum: { partialAmount: null }, _count: 0 };

  const allOrderCount = allOrderAgg._count || 0;
  const allOrderValue = Number(allOrderAgg._sum.partialAmount || 0);
  const confirmedOrderCount = confirmedOrderAgg._count || 0;
  const confirmedOrderValue = Number(confirmedOrderAgg._sum.partialAmount || 0);

  return {
    totalSpend: spend,
    totalLeads: purchases,         // Digitics "leads" = Meta purchases
    totalConfirmedOrders: confirmedOrders,
    totalRevenue: revenue,
    totalImpressions: impressions,
    totalClicks: clicks,
    overallROAS: spend > 0 ? revenue / spend : 0,
    overallCPL: purchases > 0 ? spend / purchases : 0,  // CPL = spend / Meta purchases
    overallCPP: confirmedOrders > 0 ? spend / confirmedOrders : 0,  // CPP = spend / confirmed
    aovl: allOrderCount > 0 ? allOrderValue / allOrderCount : 0,
    aovp: confirmedOrderCount > 0 ? confirmedOrderValue / confirmedOrderCount : 0,
    overallCTR: impressions > 0 ? (clicks / impressions) * 100 : 0,
  };
}

export async function getMetricsByPlatform(filters: DashboardFilters) {
  const accountIds = await resolveAccountIds(filters);
  const dateWhere = buildMetricWhere(filters);

  const accounts = await prisma.adAccount.findMany({
    where: {
      isActive: true,
      ...(accountIds && { id: { in: accountIds } }),
    },
    select: { id: true, platform: true },
  });

  const platformMap: Record<string, string[]> = {};
  for (const acc of accounts) {
    if (!platformMap[acc.platform]) platformMap[acc.platform] = [];
    platformMap[acc.platform].push(acc.id);
  }

  const results = [];
  for (const [platform, ids] of Object.entries(platformMap)) {
    const metrics = await prisma.adMetric.aggregate({
      where: { ...dateWhere, adAccountId: { in: ids } },
      _sum: { spend: true, leads: true, purchases: true, revenue: true, impressions: true, clicks: true },
    });
    const s = metrics._sum;
    results.push({
      platform,
      spend: s.spend || 0,
      leads: s.leads || 0,
      orders: s.purchases || 0,
      revenue: s.revenue || 0,
      roas: (s.spend || 0) > 0 ? (s.revenue || 0) / (s.spend || 1) : 0,
    });
  }

  return results;
}

export async function getMetricsByBrand(filters: DashboardFilters) {
  const accountIds = await resolveAccountIds(filters);
  const dateWhere = buildMetricWhere(filters);

  const brands = await prisma.brand.findMany({
    include: {
      adAccounts: {
        where: { isActive: true, ...(accountIds && { id: { in: accountIds } }) },
        select: { id: true },
      },
    },
  });

  const results = [];
  for (const brand of brands) {
    const ids = brand.adAccounts.map((a) => a.id);
    if (ids.length === 0) continue;

    const metrics = await prisma.adMetric.aggregate({
      where: { ...dateWhere, adAccountId: { in: ids } },
      _sum: { spend: true, leads: true, purchases: true, revenue: true },
    });
    const s = metrics._sum;
    results.push({
      brandId: brand.id,
      brandName: brand.name,
      spend: s.spend || 0,
      leads: s.leads || 0,
      orders: s.purchases || 0,
      revenue: s.revenue || 0,
      roas: (s.spend || 0) > 0 ? (s.revenue || 0) / (s.spend || 1) : 0,
    });
  }

  return results;
}

export async function getCampaignsWithMetrics(filters: DashboardFilters & { page?: number; pageSize?: number }) {
  const { page = 1, pageSize = 20 } = filters;
  const accountIds = await resolveAccountIds(filters);
  const metricWhere = buildMetricWhere(filters, accountIds);

  const campaignWhere: Record<string, unknown> = {};
  if (accountIds && accountIds.length > 0) {
    campaignWhere.adAccountId = { in: accountIds };
  }

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where: campaignWhere,
      include: {
        adAccount: { select: { platform: true, accountName: true, brand: true } },
        metrics: {
          where: metricWhere,
          select: {
            spend: true, leads: true, purchases: true, revenue: true,
            impressions: true, reach: true, clicks: true, outboundClicks: true,
            frequency: true, cpm: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.campaign.count({ where: campaignWhere }),
  ]);

  // Get confirmed orders per campaign from Dolphin Leads (via utm_campaign = ad set name)
  const confirmedStatus = await prisma.leadStatus.findUnique({ where: { slug: 'accounts_confirmed' } });
  const dateFrom = filters.from ? new Date(`${filters.from.split('T')[0]}T00:00:00.000Z`) : undefined;
  const dateTo = filters.to ? new Date(`${filters.to.split('T')[0]}T23:59:59.999Z`) : undefined;

  const result = await Promise.all(campaigns.map(async (c) => {
    const totals = c.metrics.reduce(
      (acc, m) => ({
        spend: acc.spend + m.spend,
        impressions: acc.impressions + m.impressions,
        reach: acc.reach + m.reach,
        clicks: acc.clicks + m.clicks,
        outboundClicks: acc.outboundClicks + m.outboundClicks,
        leads: acc.leads + m.purchases,       // Digitics "leads" = Meta purchases
        metaLeads: acc.metaLeads + m.leads,    // Actual Meta lead actions
        revenue: acc.revenue + m.revenue,
      }),
      { spend: 0, impressions: 0, reach: 0, clicks: 0, outboundClicks: 0, leads: 0, metaLeads: 0, revenue: 0 }
    );

    const frequency = totals.reach > 0 ? totals.impressions / totals.reach : 0;
    const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
    const outboundCtr = totals.impressions > 0 ? (totals.outboundClicks / totals.impressions) * 100 : 0;
    const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;

    // Get confirmed orders from Dolphin via ad set names
    let confirmedOrders = 0;
    if (confirmedStatus) {
      const adSets = await prisma.adSet.findMany({
        where: { campaignId: c.id },
        select: { name: true },
      });
      const adSetNames = adSets.map((a) => a.name);
      if (adSetNames.length > 0) {
        confirmedOrders = await prisma.lead.count({
          where: {
            utmCampaign: { in: adSetNames },
            ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
            statusId: confirmedStatus.id,
            deletedAt: null,
          },
        });
      }
    }
    const cpp = confirmedOrders > 0 ? totals.spend / confirmedOrders : 0;

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective,
      budget: c.budget,
      platform: c.adAccount.platform,
      brand: c.adAccount.brand?.name,
      accountName: c.adAccount.accountName,
      spend: totals.spend,
      impressions: totals.impressions,
      reach: totals.reach,
      clicks: totals.clicks,
      outboundClicks: totals.outboundClicks,
      leads: totals.leads,           // Digitics leads (= Meta purchases)
      confirmedOrders,               // Dolphin confirmed orders
      revenue: totals.revenue,
      frequency: +frequency.toFixed(2),
      cpm: +cpm.toFixed(2),
      outboundCtr: +outboundCtr.toFixed(2),
      cpl: +cpl.toFixed(2),
      cpp: +cpp.toFixed(2),
      roas: totals.spend > 0 ? +(totals.revenue / totals.spend).toFixed(2) : 0,
    };
  }));

  return { campaigns: result, total, page, pageSize };
}

export async function getCampaignDetail(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
    include: {
      adAccount: { select: { platform: true, accountName: true, brand: true } },
      adSets: {
        include: {
          ads: true,
          metrics: true,
        },
      },
      metrics: { orderBy: { date: 'desc' }, take: 30 },
    },
  });
}

// === Sync Schedule ===

export async function getSyncSchedule() {
  const setting = await prisma.integrationSetting.findUnique({
    where: { key: 'sync_schedule' },
  });
  if (!setting) return { enabled: false, unit: 'hours', value: 6 };
  return JSON.parse(setting.value);
}

export async function setSyncSchedule(schedule: { enabled: boolean; unit: string; value: number }) {
  return prisma.integrationSetting.upsert({
    where: { key: 'sync_schedule' },
    update: { value: JSON.stringify(schedule) },
    create: { key: 'sync_schedule', value: JSON.stringify(schedule) },
  });
}
