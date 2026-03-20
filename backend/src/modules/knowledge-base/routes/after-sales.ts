import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { requirePermission } from '../../../shared/middleware/auth';
import * as afterSalesService from '../services/kb-after-sales.service';

const router = Router({ mergeParams: true });

// GET /api/v1/knowledge-base/products/:productId/after-sales
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const afterSales = await afterSalesService.getAfterSales(String(req.params.productId));
    res.json({ afterSales });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:productId/after-sales
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const afterSales = await afterSalesService.upsertAfterSales(
      String(req.params.productId),
      req.body
    );
    res.json({ afterSales });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/knowledge-base/products/:productId/after-sales
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    await afterSalesService.deleteAfterSales(String(req.params.productId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
