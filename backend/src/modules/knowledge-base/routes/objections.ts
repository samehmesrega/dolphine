import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { requirePermission } from '../../../shared/middleware/auth';
import * as objectionService from '../services/kb-objection.service';

const router = Router({ mergeParams: true });

// GET /api/v1/knowledge-base/products/:productId/objections
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const objections = await objectionService.listObjections(String(req.params.productId));
    res.json({ objections });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/knowledge-base/products/:productId/objections/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const objection = await objectionService.getObjectionById(String(req.params.id));
    if (!objection) return res.status(404).json({ error: 'Objection not found' });
    res.json({ objection });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/knowledge-base/products/:productId/objections
router.post('/', requirePermission('kb.sales.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const objection = await objectionService.createObjection({
      ...req.body,
      productId: String(req.params.productId),
    });
    res.status(201).json({ objection });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:productId/objections/:id
router.put('/:id', requirePermission('kb.sales.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const objection = await objectionService.updateObjection(String(req.params.id), req.body);
    res.json({ objection });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/knowledge-base/products/:productId/objections/:id
router.delete('/:id', requirePermission('kb.sales.edit'), async (req: AuthRequest, res: Response) => {
  try {
    await objectionService.deleteObjection(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:productId/objections/reorder
router.put('/reorder', requirePermission('kb.sales.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const objections = await objectionService.reorderObjections(
      String(req.params.productId),
      req.body.orderedIds
    );
    res.json({ objections });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
