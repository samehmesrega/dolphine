import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { requirePermission } from '../../../shared/middleware/auth';
import * as pricingService from '../services/kb-pricing.service';

const router = Router({ mergeParams: true });

// GET /api/v1/knowledge-base/products/:productId/pricing
router.get('/', requirePermission('kb.view'), async (req: AuthRequest, res: Response) => {
  try {
    const pricing = await pricingService.listPricing(String(req.params.productId));
    res.json({ pricing });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/knowledge-base/products/:productId/pricing/:id
router.get('/:id', requirePermission('kb.view'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await pricingService.getPricingById(String(req.params.id));
    if (!item) return res.status(404).json({ error: 'Pricing not found' });
    res.json({ pricing: item });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/knowledge-base/products/:productId/pricing
router.post('/', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await pricingService.createPricing({
      ...req.body,
      productId: String(req.params.productId),
    });
    res.status(201).json({ pricing: item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:productId/pricing/:id
router.put('/:id', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await pricingService.updatePricing(String(req.params.id), req.body);
    res.json({ pricing: item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/knowledge-base/products/:productId/pricing/:id
router.delete('/:id', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    await pricingService.deletePricing(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
