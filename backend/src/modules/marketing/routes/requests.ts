import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import * as requestService from '../services/request.service';
import type { RequestStatus } from '@prisma/client';

const router = Router();

// GET /api/v1/marketing/requests
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const result = await requestService.listRequests({
      status: q.status as RequestStatus | undefined,
      projectId: q.projectId,
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/requests/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const request = await requestService.getRequestById(String(req.params.id));
    if (!request) return res.status(404).json({ error: 'Request not found' });
    res.json({ request });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/requests
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const request = await requestService.createRequest({
      ...req.body,
      requestedBy: req.user!.userId,
    });
    res.status(201).json({ request });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/requests/:id/status
router.put('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const request = await requestService.updateRequestStatus(String(req.params.id), req.body.status);
    res.json({ request });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/requests/:id/assign
router.put('/:id/assign', async (req: AuthRequest, res: Response) => {
  try {
    const request = await requestService.assignRequest(String(req.params.id), req.body.assignedTo);
    res.json({ request });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
