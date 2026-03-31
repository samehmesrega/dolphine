import { prisma } from '../../../db';

// === Exchange Rate (EGP → USD) ===

let rateCache: { rate: number; time: number } | null = null;
const RATE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function getEgpToUsd(): Promise<number> {
  if (rateCache && Date.now() - rateCache.time < RATE_CACHE_TTL) return rateCache.rate;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EGP');
    const data = await res.json() as { result: string; rates?: { USD?: number } };
    if (data.result === 'success' && data.rates?.USD) {
      rateCache = { rate: data.rates.USD, time: Date.now() };
      return data.rates.USD;
    }
  } catch (err) {
    console.warn('[ExchangeRate] Failed to fetch EGP→USD rate:', err);
  }
  // Fallback
  return rateCache?.rate || 0.02; // ~1 USD = 50 EGP
}

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

  // Use account-level insights from Meta API directly for accurate totals
  const accounts = await prisma.adAccount.findMany({
    where: {
      isActive: true,
      ...(accountIds ? { id: { in: accountIds } } : {}),
    },
  });

  let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalPurchases = 0, totalLeads = 0, totalRevenue = 0;

  if (accounts.length > 0 && filters.from && filters.to) {
    const { decryptToken } = await import('../../../shared/utils/token-encryption');
    const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

    for (const acc of accounts) {
      try {
        const token = decryptToken(acc.accessToken);
        const actId = `act_${acc.accountId}`;
        const fields = 'impressions,reach,clicks,spend,actions,action_values,outbound_clicks';
        const params = new URLSearchParams({
          fields,
          access_token: token,
          time_range: JSON.stringify({ since: filters.from, until: filters.to }),
        });
        const res = await fetch(`${GRAPH_BASE}/${actId}/insights?${params}`);
        const data = await res.json() as any;
        if (data.data && data.data[0]) {
          const row = data.data[0];
          totalSpend += parseFloat(row.spend || '0');
          totalImpressions += parseInt(row.impressions || '0', 10);
          totalClicks += parseInt(row.clicks || '0', 10);
          const actions = row.actions || [];
          const actionValues = row.action_values || [];
          totalPurchases += parseInt(actions.find((a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')?.value || '0', 10);
          totalLeads += parseInt(actions.find((a: any) => a.action_type === 'lead')?.value || '0', 10);
          totalRevenue += parseFloat(actionValues.find((a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')?.value || '0');
        }
      } catch (err: any) {
        console.warn(`[Overview] Failed to fetch insights for ${acc.accountName}: ${err.message}`);
      }
    }
  }

  const spend = totalSpend;
  const metaLeads = totalPurchases;  // Meta "purchase" = form submissions on landing page
  const revenue = totalRevenue;
  const impressions = totalImpressions;
  const clicks = totalClicks;

  // Date range for Dolphin queries
  const dateFrom = filters.from ? new Date(`${filters.from.split('T')[0]}T00:00:00.000Z`) : undefined;
  const dateTo = filters.to ? new Date(`${filters.to.split('T')[0]}T23:59:59.999Z`) : undefined;
  const dateWhere = dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {};

  // Dolphin leads count (actual leads in CRM)
  const dolphinLeads = await prisma.lead.count({
    where: { ...dateWhere, deletedAt: null },
  });

  // Dolphin confirmed orders (leads with accounts_confirmed status)
  const confirmedStatus = await prisma.leadStatus.findUnique({ where: { slug: 'confirmed' } });
  const confirmedOrders = confirmedStatus ? await prisma.lead.count({
    where: { ...dateWhere, statusId: confirmedStatus.id, deletedAt: null },
  }) : 0;

  // Order values for confirmed orders — صافي الطلب = (إجمالي المنتجات - الخصم)
  let confirmedOrderCount = 0;
  let confirmedOrderValue = 0;
  if (confirmedStatus) {
    const orders = await prisma.order.findMany({
      where: {
        ...dateWhere,
        deletedAt: null,
        lead: { statusId: confirmedStatus.id },
      },
      select: {
        discount: true,
        orderItems: { select: { price: true, quantity: true } },
      },
    });
    confirmedOrderCount = orders.length;
    for (const o of orders) {
      const itemsTotal = o.orderItems.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
      const discount = Number(o.discount || 0);
      confirmedOrderValue += itemsTotal - discount;
    }
  }

  // Convert order values from EGP to USD
  const egpToUsd = await getEgpToUsd();
  const confirmedValueUsd = confirmedOrderValue * egpToUsd;

  return {
    totalSpend: spend,
    dolphinLeads,                    // Actual leads in Dolphin CRM
    metaLeads,                       // Meta purchases (shown as sub-text)
    totalConfirmedOrders: confirmedOrders,
    totalRevenue: revenue,
    totalImpressions: impressions,
    totalClicks: clicks,
    cpl: dolphinLeads > 0 ? spend / dolphinLeads : 0,             // CPL = spend / Dolphin leads
    confirmedCost: confirmedOrders > 0 ? spend / confirmedOrders : 0,  // Cost per confirmed
    estAov: confirmedOrderCount > 0 ? confirmedValueUsd / confirmedOrderCount : 0,  // Est. AOV (USD)
    estAovEgp: confirmedOrderCount > 0 ? confirmedOrderValue / confirmedOrderCount : 0,  // Est. AOV (EGP)
    estRoas: spend > 0 ? confirmedValueUsd / spend : 0,            // Est. ROAS = confirmed value USD / spend USD
    confirmedRate: dolphinLeads > 0 ? (confirmedOrders / dolphinLeads) * 100 : 0,  // Conversion %
    egpToUsdRate: egpToUsd,
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
      where: { ...dateWhere, adAccountId: { in: ids }, adSetId: null, adId: null },
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
      where: { ...dateWhere, adAccountId: { in: ids }, adSetId: null, adId: null },
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
          where: { ...metricWhere, adSetId: null, adId: null },  // Campaign-level only
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
  const confirmedStatus = await prisma.leadStatus.findUnique({ where: { slug: 'confirmed' } });
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

// === Ad Set Reports ===

export async function getAdSetsWithMetrics(filters: DashboardFilters & { page?: number; pageSize?: number }) {
  const { page = 1, pageSize = 500 } = filters;
  const accountIds = await resolveAccountIds(filters);
  const dateFrom = filters.from ? new Date(`${filters.from.split('T')[0]}T00:00:00.000Z`) : undefined;
  const dateTo = filters.to ? new Date(`${filters.to.split('T')[0]}T23:59:59.999Z`) : undefined;

  const adSetWhere: any = {};
  if (accountIds && accountIds.length > 0) {
    adSetWhere.campaign = { adAccountId: { in: accountIds } };
  }

  const adSets = await prisma.adSet.findMany({
    where: adSetWhere,
    include: {
      campaign: { select: { name: true, adAccount: { select: { platform: true, brand: true } } } },
      metrics: {
        where: {
          ...(dateFrom || dateTo ? { date: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
        },
        select: { spend: true, impressions: true, reach: true, clicks: true, outboundClicks: true, leads: true, purchases: true, revenue: true, cpm: true },
      },
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const result = adSets.map((as) => {
    const t = as.metrics.reduce(
      (acc, m) => ({
        spend: acc.spend + m.spend, impressions: acc.impressions + m.impressions, reach: acc.reach + m.reach,
        clicks: acc.clicks + m.clicks, outboundClicks: acc.outboundClicks + m.outboundClicks,
        leads: acc.leads + m.purchases, revenue: acc.revenue + m.revenue,
      }),
      { spend: 0, impressions: 0, reach: 0, clicks: 0, outboundClicks: 0, leads: 0, revenue: 0 }
    );
    return {
      id: as.id, name: as.name, status: as.status, campaignId: as.campaignId, campaignName: as.campaign.name,
      platform: as.campaign.adAccount.platform, brand: as.campaign.adAccount.brand?.name,
      spend: t.spend, impressions: t.impressions, reach: t.reach, clicks: t.clicks, outboundClicks: t.outboundClicks,
      leads: t.leads, revenue: t.revenue,
      frequency: t.reach > 0 ? +(t.impressions / t.reach).toFixed(2) : 0,
      cpm: t.impressions > 0 ? +((t.spend / t.impressions) * 1000).toFixed(2) : 0,
      outboundCtr: t.impressions > 0 ? +((t.outboundClicks / t.impressions) * 100).toFixed(2) : 0,
      cpl: t.leads > 0 ? +(t.spend / t.leads).toFixed(2) : 0,
      roas: t.spend > 0 ? +(t.revenue / t.spend).toFixed(2) : 0,
    };
  });

  return { adSets: result, total: result.length };
}

// === Ad Reports ===

export async function getAdsWithMetrics(filters: DashboardFilters & { page?: number; pageSize?: number }) {
  const { page = 1, pageSize = 500 } = filters;
  const accountIds = await resolveAccountIds(filters);
  const dateFrom = filters.from ? new Date(`${filters.from.split('T')[0]}T00:00:00.000Z`) : undefined;
  const dateTo = filters.to ? new Date(`${filters.to.split('T')[0]}T23:59:59.999Z`) : undefined;

  const adWhere: any = {};
  if (accountIds && accountIds.length > 0) {
    adWhere.adSet = { campaign: { adAccountId: { in: accountIds } } };
  }

  const ads = await prisma.ad.findMany({
    where: adWhere,
    include: {
      adSet: { select: { name: true, campaignId: true, campaign: { select: { name: true, adAccount: { select: { platform: true, brand: true } } } } } },
      metrics: {
        where: {
          ...(dateFrom || dateTo ? { date: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
        },
        select: { spend: true, impressions: true, reach: true, clicks: true, outboundClicks: true, leads: true, purchases: true, revenue: true, cpm: true },
      },
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const result = ads.map((ad) => {
    const t = ad.metrics.reduce(
      (acc, m) => ({
        spend: acc.spend + m.spend, impressions: acc.impressions + m.impressions, reach: acc.reach + m.reach,
        clicks: acc.clicks + m.clicks, outboundClicks: acc.outboundClicks + m.outboundClicks,
        leads: acc.leads + m.purchases, revenue: acc.revenue + m.revenue,
      }),
      { spend: 0, impressions: 0, reach: 0, clicks: 0, outboundClicks: 0, leads: 0, revenue: 0 }
    );
    return {
      id: ad.id, name: ad.name, status: ad.status, adSetId: ad.adSetId, campaignId: ad.adSet.campaignId, adSetName: ad.adSet.name, campaignName: ad.adSet.campaign.name,
      platform: ad.adSet.campaign.adAccount.platform, brand: ad.adSet.campaign.adAccount.brand?.name,
      spend: t.spend, impressions: t.impressions, reach: t.reach, clicks: t.clicks, outboundClicks: t.outboundClicks,
      leads: t.leads, revenue: t.revenue,
      frequency: t.reach > 0 ? +(t.impressions / t.reach).toFixed(2) : 0,
      cpm: t.impressions > 0 ? +((t.spend / t.impressions) * 1000).toFixed(2) : 0,
      outboundCtr: t.impressions > 0 ? +((t.outboundClicks / t.impressions) * 100).toFixed(2) : 0,
      cpl: t.leads > 0 ? +(t.spend / t.leads).toFixed(2) : 0,
      roas: t.spend > 0 ? +(t.revenue / t.spend).toFixed(2) : 0,
    };
  });

  return { ads: result, total: result.length };
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
