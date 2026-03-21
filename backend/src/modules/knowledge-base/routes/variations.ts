import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { requirePermission } from '../../../shared/middleware/auth';
import * as variationService from '../services/kb-variation.service';

const router = Router({ mergeParams: true });

// GET /api/v1/knowledge-base/products/:productId/variations
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const variations = await variationService.listVariations(String(req.params.productId));
    res.json({ variations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/knowledge-base/products/:productId/variations/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const variation = await variationService.getVariationById(String(req.params.id));
    if (!variation) return res.status(404).json({ error: 'Variation not found' });
    res.json({ variation });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/knowledge-base/products/:productId/variations
router.post('/', requirePermission('kb.pricing.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const variation = await variationService.createVariation({
      ...req.body,
      productId: String(req.params.productId),
    });
    res.status(201).json({ variation });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:productId/variations/:id
router.put('/:id', requirePermission('kb.pricing.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const variation = await variationService.updateVariation(String(req.params.id), req.body);
    res.json({ variation });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/knowledge-base/products/:productId/variations/:id
router.delete('/:id', requirePermission('kb.pricing.edit'), async (req: AuthRequest, res: Response) => {
  try {
    await variationService.deleteVariation(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
