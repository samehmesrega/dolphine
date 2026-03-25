import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import * as mbService from '../services/media-buying.service';
import * as metaService from '../services/meta-ads.service';
import { prisma } from '../../../db';
import { decryptToken } from '../../../shared/utils/token-encryption';

const router = Router();

// === Ad Accounts ===

// GET /marketing/media-buying/meta-available-accounts
router.get('/meta-available-accounts', async (_req: AuthRequest, res: Response) => {
  try {
    const anyMetaAccount = await prisma.adAccount.findFirst({
      where: { platform: 'meta', isActive: true },
    });
    if (!anyMetaAccount) return res.json({ accounts: [] });

    const token = decryptToken(anyMetaAccount.accessToken);
    const metaAccounts = await metaService.fetchMetaAdAccounts(token);

    const connectedAccounts = await prisma.adAccount.findMany({
      where: { platform: 'meta' },
      select: { id: true, accountId: true, isActive: true, brandId: true, brand: { select: { name: true } } },
    });
    const connectedMap = new Map(connectedAccounts.map((a) => [a.accountId, a]));

    const accounts = metaAccounts.map((acc) => {
      const connected = connectedMap.get(acc.accountId);
      return {
        ...acc,
        isConnected: !!connected,
        connectedId: connected?.id ?? null,
        brandId: connected?.brandId ?? null,
        brandName: connected?.brand?.name ?? null,
      };
    });

    res.json({ accounts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /marketing/media-buying/meta-connect-existing
router.post('/meta-connect-existing', async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, accountName, brandId } = req.body;
    if (!accountId || !accountName || !brandId) {
      return res.status(400).json({ error: 'accountId, accountName, brandId مطلوبين' });
    }

    const anyMetaAccount = await prisma.adAccount.findFirst({
      where: { platform: 'meta', isActive: true },
    });
    if (!anyMetaAccount) {
      return res.status(400).json({ error: 'لا يوجد حساب Meta مربوط للحصول على الـ token' });
    }

    const account = await prisma.adAccount.upsert({
      where: { platform_accountId: { platform: 'meta', accountId } },
      update: { accountName, brandId, isActive: true, accessToken: anyMetaAccount.accessToken, tokenExpiry: anyMetaAccount.tokenExpiry },
      create: { platform: 'meta', accountId, accountName, accessToken: anyMetaAccount.accessToken, tokenExpiry: anyMetaAccount.tokenExpiry, brandId, isActive: true },
      include: { brand: true },
    });

    res.json({ account });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/v1/marketing/ad-accounts
router.get('/ad-accounts', async (_req: AuthRequest, res: Response) => {
  try {
    const accounts = await mbService.listAdAccounts();
    res.json({ accounts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/ad-accounts/connect
router.post('/ad-accounts/connect', async (req: AuthRequest, res: Response) => {
  try {
    const account = await mbService.connectAdAccount(req.body);
    res.status(201).json({ account });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/marketing/ad-accounts/:id
router.delete('/ad-accounts/:id', async (req: AuthRequest, res: Response) => {
  try {
    await mbService.disconnectAdAccount(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/v1/marketing/ad-accounts/:id/sync-logs
router.get('/ad-accounts/:id/sync-logs', async (req: AuthRequest, res: Response) => {
  try {
    const logs = await mbService.getSyncLogs(String(req.params.id));
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// === Dashboard ===

// GET /api/v1/marketing/media-buying/overview
router.get('/overview', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const metrics = await mbService.getOverviewMetrics({
      from: q.from,
      to: q.to,
      platform: q.platform,
      brandId: q.brandId,
      adAccountId: q.adAccountId,
    });
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/media-buying/by-platform
router.get('/by-platform', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const data = await mbService.getMetricsByPlatform({ from: q.from, to: q.to, platform: q.platform, brandId: q.brandId, adAccountId: q.adAccountId });
    res.json({ platforms: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/media-buying/by-brand
router.get('/by-brand', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const data = await mbService.getMetricsByBrand({ from: q.from, to: q.to, platform: q.platform, brandId: q.brandId, adAccountId: q.adAccountId });
    res.json({ brands: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/media-buying/campaigns
router.get('/campaigns', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const data = await mbService.getCampaignsWithMetrics({
      from: q.from,
      to: q.to,
      platform: q.platform,
      brandId: q.brandId,
      adAccountId: q.adAccountId,
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/media-buying/campaigns/:id
router.get('/campaigns/:id', async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await mbService.getCampaignDetail(String(req.params.id));
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ campaign });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/media-buying/adsets
router.get('/adsets', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const data = await mbService.getAdSetsWithMetrics({
      from: q.from, to: q.to, platform: q.platform, brandId: q.brandId, adAccountId: q.adAccountId,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/media-buying/ads
router.get('/ads', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const data = await mbService.getAdsWithMetrics({
      from: q.from, to: q.to, platform: q.platform, brandId: q.brandId, adAccountId: q.adAccountId,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// === Manual Sync ===

// POST /marketing/media-buying/resync — delete all metrics and re-sync from scratch
router.post('/resync', async (req: AuthRequest, res: Response) => {
  try {
    // Delete all metrics
    const deleted = await prisma.adMetric.deleteMany({});
    console.log(`[Resync] Deleted ${deleted.count} metrics`);

    // Reset lastSyncAt on all accounts so fullSync pulls full history
    await prisma.adAccount.updateMany({
      where: { isActive: true },
      data: { lastSyncAt: null },
    });

    // Run full sync for all accounts
    const accounts = await prisma.adAccount.findMany({ where: { isActive: true } });
    const results = [];
    for (const acc of accounts) {
      try {
        const syncResult = await metaService.fullSync(acc.id);
        results.push({ id: acc.id, accountName: acc.accountName, status: 'success', ...syncResult });
      } catch (e: any) {
        results.push({ id: acc.id, accountName: acc.accountName, status: 'error', error: e.message });
      }
    }
    res.json({ deleted: deleted.count, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /marketing/media-buying/sync
router.post('/sync', async (req: AuthRequest, res: Response) => {
  try {
    const { adAccountId } = req.body;
    const accounts = adAccountId
      ? await prisma.adAccount.findMany({ where: { id: adAccountId, isActive: true } })
      : await prisma.adAccount.findMany({ where: { isActive: true } });

    if (accounts.length === 0) return res.status(404).json({ error: 'لا يوجد حسابات للمزامنة' });

    const results = [];
    for (const acc of accounts) {
      try {
        const syncResult = await metaService.quickSync(acc.id);
        results.push({ id: acc.id, accountName: acc.accountName, status: 'success', ...syncResult });
      } catch (e: any) {
        results.push({ id: acc.id, accountName: acc.accountName, status: 'error', error: e.message });
      }
    }

    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// === Sync Schedule ===

// GET /marketing/media-buying/sync-schedule
router.get('/sync-schedule', async (_req: AuthRequest, res: Response) => {
  try {
    const schedule = await mbService.getSyncSchedule();
    res.json({ schedule });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /marketing/media-buying/sync-schedule
router.put('/sync-schedule', async (req: AuthRequest, res: Response) => {
  try {
    const { enabled, unit, value } = req.body;
    await mbService.setSyncSchedule({ enabled, unit, value });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
