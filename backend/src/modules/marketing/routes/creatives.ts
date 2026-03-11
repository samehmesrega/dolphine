import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import * as creativeService from '../services/creative.service';
import type { CreativeType, CreativeStatus } from '@prisma/client';

const router = Router();

// GET /api/v1/marketing/creatives
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const result = await creativeService.listCreatives({
      projectId: q.projectId,
      productId: q.productId,
      status: q.status as CreativeStatus | undefined,
      type: q.type as CreativeType | undefined,
      creatorId: q.creatorId,
      search: q.search,
      tagIds: q.tagIds ? q.tagIds.split(',') : undefined,
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/creatives/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const creative = await creativeService.getCreativeById(String(req.params.id));
    if (!creative) return res.status(404).json({ error: 'Creative not found' });
    res.json({ creative });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/creatives
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const creative = await creativeService.createCreative({
      ...req.body,
      creatorId: req.user!.userId,
    });
    res.status(201).json({ creative });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/creatives/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const creative = await creativeService.updateCreative(String(req.params.id), req.body);
    res.json({ creative });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/creatives/:id/tags
router.put('/:id/tags', async (req: AuthRequest, res: Response) => {
  try {
    const creative = await creativeService.updateCreativeTags(String(req.params.id), req.body.tagIds);
    res.json({ creative });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/marketing/creatives/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await creativeService.deleteCreative(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
