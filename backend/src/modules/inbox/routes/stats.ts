import { Router, Request, Response } from 'express';
import * as statsService from '../services/inbox-stats.service';

const router = Router();

/**
 * GET /api/v1/inbox/stats/overview — General overview (same as team but just overview)
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const { brandId, channelId, from, to } = req.query;
    const result = await statsService.getTeamStats({
      brandId: brandId as string,
      channelId: channelId as string,
      from: from as string,
      to: to as string,
    });
    res.json(result.overview);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats overview' });
  }
});

/**
 * GET /api/v1/inbox/stats/team — Team stats with per-agent breakdown
 */
router.get('/team', async (req: Request, res: Response) => {
  try {
    const { brandId, channelId, from, to } = req.query;
    const result = await statsService.getTeamStats({
      brandId: brandId as string,
      channelId: channelId as string,
      from: from as string,
      to: to as string,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team stats' });
  }
});

/**
 * GET /api/v1/inbox/stats/agent/:userId — Detailed stats for a single agent
 */
router.get('/agent/:userId', async (req: Request, res: Response) => {
  try {
    const { brandId, channelId, from, to } = req.query;
    const result = await statsService.getAgentDetail(String(req.params.userId), {
      brandId: brandId as string,
      channelId: channelId as string,
      from: from as string,
      to: to as string,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agent stats' });
  }
});

export default router;
