import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/v1/inbox/stats/overview — General overview numbers
 */
router.get('/overview', async (req: Request, res: Response) => {
  // TODO: Implement in Phase 10
  res.status(501).json({ error: 'Not implemented yet' });
});

/**
 * GET /api/v1/inbox/stats/team — Team stats with per-agent breakdown
 */
router.get('/team', async (req: Request, res: Response) => {
  // TODO: Implement in Phase 10
  res.status(501).json({ error: 'Not implemented yet' });
});

/**
 * GET /api/v1/inbox/stats/agent/:userId — Detailed stats for a single agent
 */
router.get('/agent/:userId', async (req: Request, res: Response) => {
  // TODO: Implement in Phase 10
  res.status(501).json({ error: 'Not implemented yet' });
});

export default router;
