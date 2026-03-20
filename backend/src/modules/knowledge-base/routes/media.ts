import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { requirePermission } from '../../../shared/middleware/auth';
import * as mediaService from '../services/kb-media.service';

const router = Router({ mergeParams: true });

// GET /api/v1/knowledge-base/products/:productId/media
router.get('/', requirePermission('kb.view'), async (req: AuthRequest, res: Response) => {
  try {
    const media = await mediaService.listMedia(String(req.params.productId));
    res.json({ media });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/knowledge-base/products/:productId/media/:id
router.get('/:id', requirePermission('kb.view'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await mediaService.getMediaById(String(req.params.id));
    if (!item) return res.status(404).json({ error: 'Media not found' });
    res.json({ media: item });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/knowledge-base/products/:productId/media
router.post('/', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await mediaService.createMedia({
      ...req.body,
      productId: String(req.params.productId),
    });
    res.status(201).json({ media: item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:productId/media/:id
router.put('/:id', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await mediaService.updateMedia(String(req.params.id), req.body);
    res.json({ media: item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/knowledge-base/products/:productId/media/:id
router.delete('/:id', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    await mediaService.deleteMedia(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:productId/media/reorder
router.put('/reorder', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const media = await mediaService.reorderMedia(
      String(req.params.productId),
      req.body.orderedIds
    );
    res.json({ media });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
