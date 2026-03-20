import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { requirePermission } from '../../../shared/middleware/auth';
import * as salesScriptService from '../services/kb-sales-script.service';

const router = Router({ mergeParams: true });

// GET /api/v1/knowledge-base/products/:productId/sales-scripts
router.get('/', requirePermission('kb.view'), async (req: AuthRequest, res: Response) => {
  try {
    const salesScripts = await salesScriptService.listSalesScripts(String(req.params.productId));
    res.json({ salesScripts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/knowledge-base/products/:productId/sales-scripts/:id
router.get('/:id', requirePermission('kb.view'), async (req: AuthRequest, res: Response) => {
  try {
    const salesScript = await salesScriptService.getSalesScriptById(String(req.params.id));
    if (!salesScript) return res.status(404).json({ error: 'Sales script not found' });
    res.json({ salesScript });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/knowledge-base/products/:productId/sales-scripts
router.post('/', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const salesScript = await salesScriptService.createSalesScript({
      ...req.body,
      productId: String(req.params.productId),
    });
    res.status(201).json({ salesScript });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:productId/sales-scripts/:id
router.put('/:id', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const salesScript = await salesScriptService.updateSalesScript(String(req.params.id), req.body);
    res.json({ salesScript });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/knowledge-base/products/:productId/sales-scripts/:id
router.delete('/:id', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    await salesScriptService.deleteSalesScript(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:productId/sales-scripts/reorder
router.put('/reorder', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const salesScripts = await salesScriptService.reorderSalesScripts(
      String(req.params.productId),
      req.body.orderedIds
    );
    res.json({ salesScripts });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
