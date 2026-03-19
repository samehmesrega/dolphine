import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import * as metaAds from '../services/meta-ads.service';
import crypto from 'crypto';

const router = Router();

// ==============================
// Meta (Facebook) OAuth
// ==============================

// GET /api/v1/marketing/oauth/meta — returns the OAuth URL to redirect the user to
router.get('/meta', (req: AuthRequest, res: Response) => {
  try {
    // Generate a random state parameter for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');
    const url = metaAds.getMetaOAuthUrl(state);
    res.json({ url, state });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/oauth/meta/callback — exchange code for token
router.post('/meta/callback', async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Authorization code is required' });

    // Exchange code for short-lived token
    const tokenData = await metaAds.exchangeCodeForToken(code);

    // Fetch available ad accounts
    const adAccounts = await metaAds.fetchMetaAdAccounts(tokenData.accessToken);

    res.json({
      accessToken: tokenData.accessToken, // short-lived, will be exchanged for long-lived on connect
      adAccounts,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/v1/marketing/oauth/meta/connect — connect a specific ad account
router.post('/meta/connect', async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, accountName, accessToken, brandId } = req.body;

    if (!accountId || !accountName || !accessToken || !brandId) {
      return res.status(400).json({ error: 'accountId, accountName, accessToken, and brandId are required' });
    }

    const account = await metaAds.connectMetaAdAccount({
      accountId,
      accountName,
      accessToken,
      brandId,
    });

    res.status(201).json({ account });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/v1/marketing/oauth/meta/sync/:adAccountId — trigger a full sync
router.post('/meta/sync/:adAccountId', async (req: AuthRequest, res: Response) => {
  try {
    const result = await metaAds.fullSync(String(req.params.adAccountId));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
