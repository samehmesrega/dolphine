/**
 * Meta (Facebook) Ads Integration Service
 * Handles OAuth flow, ad account discovery, and data sync
 */

import { prisma } from '../../../db';
import { encryptToken, decryptToken } from '../../../shared/utils/token-encryption';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function fetchWithTimeout(url: string, options?: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// === OAuth Flow ===

export function getMetaOAuthUrl(state: string): string {
  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;

  if (!appId || !redirectUri) {
    throw new Error('META_APP_ID and META_REDIRECT_URI must be set in environment variables');
  }

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: 'ads_read,ads_management,business_management',
    response_type: 'code',
    state,
  });

  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params}`;
}

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    code,
  });

  console.log('[Meta OAuth] Exchanging code for token...');
  const res = await fetchWithTimeout(`${GRAPH_BASE}/oauth/access_token?${params}`);
  const data = await res.json() as any;
  console.log('[Meta OAuth] Response:', data.error ? data.error.message : 'OK');

  if (data.error) {
    throw new Error(`Meta OAuth error: ${data.error.message}`);
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

export async function getLongLivedToken(shortToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortToken,
  });

  const res = await fetchWithTimeout(`${GRAPH_BASE}/oauth/access_token?${params}`);
  const data = await res.json() as any;

  if (data.error) {
    throw new Error(`Meta token exchange error: ${data.error.message}`);
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 5184000, // ~60 days
  };
}

// === Ad Account Discovery ===

export async function fetchMetaAdAccounts(accessToken: string): Promise<Array<{
  id: string;
  accountId: string;
  name: string;
  currency: string;
  timezone: string;
  status: number;
}>> {
  const fields = 'id,account_id,name,currency,timezone_name,account_status';
  console.log('[Meta OAuth] Fetching ad accounts...');
  const res = await fetchWithTimeout(
    `${GRAPH_BASE}/me/adaccounts?fields=${fields}&access_token=${accessToken}&limit=100`
  );
  const data = await res.json() as any;

  if (data.error) {
    throw new Error(`Meta API error: ${data.error.message}`);
  }

  return (data.data || []).map((acc: any) => ({
    id: acc.id, // format: act_123456
    accountId: acc.account_id, // format: 123456
    name: acc.name,
    currency: acc.currency,
    timezone: acc.timezone_name,
    status: acc.account_status,
  }));
}

export async function connectMetaAdAccount(data: {
  accountId: string;
  accountName: string;
  accessToken: string;
  brandId: string;
}): Promise<any> {
  // Get long-lived token first
  const longLived = await getLongLivedToken(data.accessToken);
  const expiry = new Date(Date.now() + longLived.expiresIn * 1000);

  return prisma.adAccount.upsert({
    where: {
      platform_accountId: {
        platform: 'meta',
        accountId: data.accountId,
      },
    },
    update: {
      accountName: data.accountName,
      accessToken: encryptToken(longLived.accessToken),
      tokenExpiry: expiry,
      brandId: data.brandId,
      isActive: true,
    },
    create: {
      platform: 'meta',
      accountId: data.accountId,
      accountName: data.accountName,
      accessToken: encryptToken(longLived.accessToken),
      tokenExpiry: expiry,
      brandId: data.brandId,
      isActive: true,
    },
    include: { brand: true },
  });
}

// === Data Sync ===

export async function syncCampaigns(adAccountId: string): Promise<number> {
  const account = await prisma.adAccount.findUnique({ where: { id: adAccountId } });
  if (!account) throw new Error('Ad account not found');

  const token = decryptToken(account.accessToken);
  const actId = `act_${account.accountId}`;

  const fields = 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time';
  const res = await fetchWithTimeout(
    `${GRAPH_BASE}/${actId}/campaigns?fields=${fields}&access_token=${token}&limit=500`
  );
  const data = await res.json() as any;

  if (data.error) {
    throw new Error(`Meta API error: ${data.error.message}`);
  }

  const campaigns = data.data || [];
  console.log(`[Sync] Found ${campaigns.length} campaigns, upserting...`);

  // Process in batches of 10 for parallel upserts
  const batchSize = 10;
  let count = 0;
  for (let i = 0; i < campaigns.length; i += batchSize) {
    const batch = campaigns.slice(i, i + batchSize);
    await Promise.all(batch.map((c: any) => {
      const budget = c.daily_budget
        ? parseFloat(c.daily_budget) / 100
        : c.lifetime_budget
          ? parseFloat(c.lifetime_budget) / 100
          : null;

      return prisma.campaign.upsert({
        where: {
          adAccountId_platformId: {
            adAccountId: adAccountId,
            platformId: c.id,
          },
        },
        update: {
          name: c.name,
          status: c.status,
          objective: c.objective,
          budget,
        },
        create: {
          adAccountId: adAccountId,
          platformId: c.id,
          name: c.name,
          status: c.status,
          objective: c.objective,
          budget,
          startDate: c.start_time ? new Date(c.start_time) : null,
          endDate: c.stop_time ? new Date(c.stop_time) : null,
        },
      });
    }));
    count += batch.length;
    console.log(`[Sync] Campaigns: ${count}/${campaigns.length}`);
  }

  // Sync Ad Sets for each campaign
  console.log(`[Sync] Syncing ad sets...`);
  const dbCampaigns = await prisma.campaign.findMany({
    where: { adAccountId },
    select: { id: true, platformId: true },
  });

  let adSetCount = 0;
  for (const dbCamp of dbCampaigns) {
    try {
      const asFields = 'id,name,status,targeting,daily_budget';
      const asRes = await fetchWithTimeout(
        `${GRAPH_BASE}/${dbCamp.platformId}/adsets?fields=${asFields}&access_token=${token}&limit=500`
      );
      const asData = await asRes.json() as any;
      if (asData.error) continue;

      for (const as of (asData.data || [])) {
        const asBudget = as.daily_budget ? parseFloat(as.daily_budget) / 100 : null;
        await prisma.adSet.upsert({
          where: { campaignId_platformId: { campaignId: dbCamp.id, platformId: as.id } },
          update: { name: as.name, status: as.status, budget: asBudget },
          create: {
            campaignId: dbCamp.id,
            platformId: as.id,
            name: as.name,
            status: as.status,
            targeting: as.targeting || null,
            budget: asBudget,
          },
        });
        adSetCount++;
      }
    } catch {
      // Skip failed campaigns
    }
  }
  console.log(`[Sync] Ad sets: ${adSetCount}`);

  // Sync Ads for each ad set
  console.log(`[Sync] Syncing ads...`);
  const dbAdSets = await prisma.adSet.findMany({
    where: { campaign: { adAccountId } },
    select: { id: true, platformId: true },
  });

  let adCount = 0;
  for (const dbAs of dbAdSets) {
    try {
      const adFields = 'id,name,status,creative{id,name}';
      const adRes = await fetchWithTimeout(
        `${GRAPH_BASE}/${dbAs.platformId}/ads?fields=${adFields}&access_token=${token}&limit=500`
      );
      const adData = await adRes.json() as any;
      if (adData.error) continue;

      for (const ad of (adData.data || [])) {
        await prisma.ad.upsert({
          where: { adSetId_platformId: { adSetId: dbAs.id, platformId: ad.id } },
          update: { name: ad.name, status: ad.status },
          create: {
            adSetId: dbAs.id,
            platformId: ad.id,
            name: ad.name,
            status: ad.status,
          },
        });
        adCount++;
      }
    } catch {
      // Skip failed ad sets
    }
  }
  console.log(`[Sync] Ads: ${adCount}`);

  return count;
}

export async function syncInsights(
  adAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<number> {
  const account = await prisma.adAccount.findUnique({ where: { id: adAccountId } });
  if (!account) throw new Error('Ad account not found');

  const token = decryptToken(account.accessToken);
  const actId = `act_${account.accountId}`;

  const insightFields = 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,reach,clicks,spend,actions,action_values,outbound_clicks,frequency,cpm';

  // Pull insights at all 3 levels
  const levels = ['campaign', 'adset', 'ad'] as const;
  let allRows: any[] = [];

  for (const level of levels) {
    const params = new URLSearchParams({
      fields: insightFields,
      access_token: token,
      time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
      time_increment: '1',
      level,
      limit: '1000',
    });

    try {
      const res = await fetchWithTimeout(`${GRAPH_BASE}/${actId}/insights?${params}`, undefined, 30000);
      const data = await res.json() as any;
      if (data.error) {
        console.warn(`[Sync] ${level} insights error: ${data.error.message}`);
        continue;
      }
      const rows = data.data || [];
      rows.forEach((r: any) => r._level = level);
      allRows = allRows.concat(rows);
      console.log(`[Sync] ${level} insights: ${rows.length} rows`);
    } catch (err: any) {
      console.warn(`[Sync] ${level} insights fetch failed: ${err.message}`);
    }
  }

  let count = 0;
  for (const row of allRows) {
    // Find campaign
    const campaign = await prisma.campaign.findFirst({
      where: { adAccountId, platformId: row.campaign_id },
    });
    if (!campaign) continue;

    // Find ad set and ad if applicable
    let adSetId: string | null = null;
    let adId: string | null = null;

    if (row._level === 'adset' || row._level === 'ad') {
      const adSet = row.adset_id ? await prisma.adSet.findFirst({
        where: { campaignId: campaign.id, platformId: row.adset_id },
      }) : null;
      adSetId = adSet?.id || null;
    }

    if (row._level === 'ad') {
      const ad = row.ad_id && adSetId ? await prisma.ad.findFirst({
        where: { adSetId, platformId: row.ad_id },
      }) : null;
      adId = ad?.id || null;
    }

    // Parse actions (leads, purchases)
    const actions = row.actions || [];
    const actionValues = row.action_values || [];

    const leads = actions.find((a: any) => a.action_type === 'lead')?.value || 0;
    const purchases = actions.find((a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')?.value || 0;
    const conversions = actions.find((a: any) => a.action_type === 'offsite_conversion')?.value || 0;
    const revenue = actionValues.find((a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')?.value || 0;

    const spend = parseFloat(row.spend || '0');
    const impressions = parseInt(row.impressions || '0', 10);
    const reach = parseInt(row.reach || '0', 10);
    const clicks = parseInt(row.clicks || '0', 10);
    const outboundClicksArr = row.outbound_clicks || [];
    const outboundClicks = outboundClicksArr.reduce?.((sum: number, o: any) => sum + parseInt(o.value || '0', 10), 0) || 0;
    const purchaseCount = parseInt(String(purchases), 10);
    const cpmValue = parseFloat(row.cpm || '0');

    // Normalize date to midnight UTC to avoid timezone duplicates
    const dateStr = String(row.date_start).split('T')[0]; // "2026-03-24"
    const date = new Date(`${dateStr}T00:00:00.000Z`);

    // Find existing metric for same account + campaign + adset + ad + date
    const existingMetric = await prisma.adMetric.findFirst({
      where: {
        date,
        adAccountId,
        campaignId: campaign.id,
        adSetId: row._level === 'campaign' ? null : adSetId,
        adId: row._level !== 'ad' ? null : adId,
      },
    });

    const metricData = {
      impressions,
      reach,
      clicks,
      outboundClicks,
      spend,
      conversions: parseInt(String(conversions), 10),
      leads: parseInt(String(leads), 10),
      purchases: purchaseCount,
      revenue: parseFloat(String(revenue)),
      frequency: reach > 0 ? impressions / reach : null,
      cpm: cpmValue || (impressions > 0 ? (spend / impressions) * 1000 : null),
      ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
      outboundCtr: impressions > 0 ? (outboundClicks / impressions) * 100 : null,
      cpc: clicks > 0 ? spend / clicks : null,
      cpl: purchaseCount > 0 ? spend / purchaseCount : null,  // CPL = spend / Meta purchases (= Digitics leads)
      cpa: null,  // CPP calculated later from Dolphin Leads confirmed orders
      roas: spend > 0 ? parseFloat(String(revenue)) / spend : null,
    };

    if (existingMetric) {
      await prisma.adMetric.update({
        where: { id: existingMetric.id },
        data: metricData,
      });
    } else {
      await prisma.adMetric.create({
        data: {
          date,
          adAccountId,
          campaignId: campaign.id,
          ...(adSetId ? { adSetId } : {}),
          ...(adId ? { adId } : {}),
          ...metricData,
        },
      });
    }
    count++;
  }

  return count;
}

export async function fullSync(adAccountId: string): Promise<{
  campaigns: number;
  metrics: number;
  duration: number;
}> {
  const startTime = Date.now();

  // Create sync log
  const syncLog = await prisma.syncLog.create({
    data: {
      adAccountId,
      syncType: 'full',
      status: 'in_progress',
    },
  });

  try {
    // Normalize all dates to midnight UTC (fix timezone drift from previous syncs)
    await prisma.$executeRaw`
      UPDATE ad_metrics SET date = DATE(date)::timestamp AT TIME ZONE 'UTC'
      WHERE date != DATE(date)::timestamp AT TIME ZONE 'UTC'
    `.catch((e: any) => { console.warn('[Sync] Date normalize skipped:', e.message); });

    // Clean up duplicate metrics (from previous timezone bugs — same day stored with different times)
    await prisma.$executeRaw`
      DELETE FROM ad_metrics WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY ad_account_id, campaign_id, DATE(date),
              COALESCE(ad_set_id, ''), COALESCE(ad_id, '')
            ORDER BY id
          ) AS rn
          FROM ad_metrics
        ) sub WHERE rn > 1
      )
    `.catch((e: any) => { console.warn('[Sync] Dedup skipped:', e.message); });

    // Sync campaigns
    const campaignCount = await syncCampaigns(adAccountId);

    // Determine sync range: if first sync → full history (37 months), otherwise last 7 days
    const account = await prisma.adAccount.findUnique({ where: { id: adAccountId } });
    const lastSync = account?.lastSyncAt;
    const dateTo = new Date().toISOString().split('T')[0];

    let dateFromStr: string;
    if (!lastSync) {
      // First sync — pull max available (37 months)
      const dateFromMax = new Date();
      dateFromMax.setMonth(dateFromMax.getMonth() - 37);
      dateFromStr = dateFromMax.toISOString().split('T')[0];
      console.log(`[Sync] First sync — pulling full history from ${dateFromStr}`);
    } else {
      // Subsequent sync — pull last 7 days (covers delays + corrections)
      const d = new Date();
      d.setDate(d.getDate() - 7);
      dateFromStr = d.toISOString().split('T')[0];
      console.log(`[Sync] Incremental sync — last 7 days from ${dateFromStr}`);
    }

    let metricCount = 0;
    const chunkDays = 90;
    let chunkEnd = new Date(dateTo);
    const absoluteStart = new Date(dateFromStr);

    while (chunkEnd > absoluteStart) {
      const chunkStart = new Date(chunkEnd);
      chunkStart.setDate(chunkStart.getDate() - chunkDays);
      if (chunkStart < absoluteStart) chunkStart.setTime(absoluteStart.getTime());

      const from = chunkStart.toISOString().split('T')[0];
      const to = chunkEnd.toISOString().split('T')[0];
      console.log(`[Sync] Insights chunk: ${from} → ${to}`);

      try {
        metricCount += await syncInsights(adAccountId, from, to);
      } catch (err: any) {
        console.warn(`[Sync] Chunk ${from}→${to} failed: ${err.message}`);
      }

      chunkEnd = new Date(chunkStart);
      chunkEnd.setDate(chunkEnd.getDate() - 1);
    }

    // Update lastSyncAt
    await prisma.adAccount.update({
      where: { id: adAccountId },
      data: { lastSyncAt: new Date() },
    });

    const duration = Date.now() - startTime;

    // Update sync log
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'success',
        recordsUpdated: campaignCount + metricCount,
        duration,
        completedAt: new Date(),
      },
    });

    // Update last sync time
    await prisma.adAccount.update({
      where: { id: adAccountId },
      data: { lastSyncAt: new Date() },
    });

    return { campaigns: campaignCount, metrics: metricCount, duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        error: error.message,
        duration,
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

// Quick sync — today + yesterday only (for manual refresh)
export async function quickSync(adAccountId: string): Promise<{
  campaigns: number;
  metrics: number;
  duration: number;
}> {
  const startTime = Date.now();
  const campaignCount = await syncCampaigns(adAccountId);

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const metricCount = await syncInsights(adAccountId, yesterday, today);

  await prisma.adAccount.update({
    where: { id: adAccountId },
    data: { lastSyncAt: new Date() },
  });

  return { campaigns: campaignCount, metrics: metricCount, duration: Date.now() - startTime };
}

// Auto-sync all active accounts (called by scheduler)
export async function autoSyncAll(): Promise<void> {
  const accounts = await prisma.adAccount.findMany({ where: { isActive: true } });
  if (accounts.length === 0) return;

  console.log(`[AutoSync] Starting sync for ${accounts.length} accounts...`);
  for (const acc of accounts) {
    try {
      const result = await fullSync(acc.id);
      console.log(`[AutoSync] ${acc.accountName}: ${result.campaigns} campaigns, ${result.metrics} metrics (${result.duration}ms)`);
    } catch (err: any) {
      console.error(`[AutoSync] ${acc.accountName} failed: ${err.message}`);
    }
  }
  console.log('[AutoSync] Done.');
}

// Start auto-sync scheduler (call once from index.ts)
export function startAutoSyncScheduler(intervalHours = 2): void {
  const ms = intervalHours * 60 * 60 * 1000;
  console.log(`[AutoSync] Scheduler started — every ${intervalHours} hours`);

  // Run first sync after 30 seconds (let server finish starting)
  setTimeout(() => {
    autoSyncAll().catch((e) => console.error('[AutoSync] Error:', e));
  }, 30000);

  // Then every N hours
  setInterval(() => {
    autoSyncAll().catch((e) => console.error('[AutoSync] Error:', e));
  }, ms);
}
