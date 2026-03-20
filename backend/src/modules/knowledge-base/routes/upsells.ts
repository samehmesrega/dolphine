import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { requirePermission } from '../../../shared/middleware/auth';
import * as upsellService from '../services/kb-upsell.service';

const router = Router({ mergeParams: true });

// GET /api/v1/knowledge-base/products/:productId/upsells
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const upsells = await upsellService.listUpsells(String(req.params.productId));
    res.json({ upsells });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/knowledge-base/products/:productId/upsells/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const upsell = await upsellService.getUpsellById(String(req.params.id));
    if (!upsell) return res.status(404).json({ error: 'Upsell not found' });
    res.json({ upsell });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/knowledge-base/products/:productId/upsells
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const upsell = await upsellService.createUpsell({
      ...req.body,
      productId: String(req.params.productId),
    });
    res.status(201).json({ upsell });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:productId/upsells/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const upsell = await upsellService.updateUpsell(String(req.params.id), req.body);
    res.json({ upsell });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/knowledge-base/products/:productId/upsells/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await upsellService.deleteUpsell(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
