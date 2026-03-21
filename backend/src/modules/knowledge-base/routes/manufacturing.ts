import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { requirePermission } from '../../../shared/middleware/auth';
import * as manufacturingService from '../services/kb-manufacturing.service';

const router = Router({ mergeParams: true });

// GET /api/v1/knowledge-base/products/:productId/manufacturing
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const manufacturing = await manufacturingService.getManufacturing(String(req.params.productId));
    res.json({ manufacturing });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:productId/manufacturing
router.put('/', requirePermission('kb.manufacturing.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const manufacturing = await manufacturingService.upsertManufacturing(
      String(req.params.productId),
      req.body
    );
    res.json({ manufacturing });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/knowledge-base/products/:productId/manufacturing
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    await manufacturingService.deleteManufacturing(String(req.params.productId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
