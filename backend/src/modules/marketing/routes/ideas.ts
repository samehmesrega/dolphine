import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import * as ideaService from '../services/idea.service';
import type { IdeaStatus } from '@prisma/client';

const router = Router();

// GET /api/v1/marketing/ideas
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const result = await ideaService.listIdeas({
      status: q.status as IdeaStatus | undefined,
      projectId: q.projectId,
      platform: q.platform,
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/ideas/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const idea = await ideaService.getIdeaById(String(req.params.id));
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    res.json({ idea });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/ideas
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const idea = await ideaService.createIdea({
      ...req.body,
      submittedBy: req.user!.userId,
    });
    res.status(201).json({ idea });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/ideas/:id/status
router.put('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const idea = await ideaService.updateIdeaStatus(String(req.params.id), req.body.status);
    res.json({ idea });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/v1/marketing/ideas/:id/comments
router.post('/:id/comments', async (req: AuthRequest, res: Response) => {
  try {
    const comment = await ideaService.addIdeaComment(String(req.params.id), req.user!.userId, req.body.text);
    res.status(201).json({ comment });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
