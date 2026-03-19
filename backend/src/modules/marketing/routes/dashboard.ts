import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import * as integrationService from '../services/integration.service';

const router = Router();

// GET /api/v1/marketing/dashboard/stats
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const stats = await integrationService.getDashboardStats({
      from: q.from,
      to: q.to,
    });
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/dashboard/leads-by-source
router.get('/leads-by-source', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const data = await integrationService.getLeadsBySource({
      from: q.from,
      to: q.to,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/dashboard/creative-roi/:code
router.get('/creative-roi/:code', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const roi = await integrationService.getCreativeROI(
      String(req.params.code),
      { from: q.from, to: q.to }
    );
    res.json(roi);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
