import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { requirePermission } from '../../../shared/middleware/auth';
import * as marketingService from '../services/kb-marketing.service';

const router = Router({ mergeParams: true });

// GET /api/v1/knowledge-base/products/:productId/marketing
router.get('/', requirePermission('kb.view'), async (req: AuthRequest, res: Response) => {
  try {
    const marketing = await marketingService.getMarketing(String(req.params.productId));
    res.json({ marketing });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:productId/marketing
router.put('/', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const marketing = await marketingService.upsertMarketing(
      String(req.params.productId),
      req.body
    );
    res.json({ marketing });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/knowledge-base/products/:productId/marketing
router.delete('/', requirePermission('kb.admin'), async (req: AuthRequest, res: Response) => {
  try {
    await marketingService.deleteMarketing(String(req.params.productId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
