import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import * as scriptService from '../services/script.service';
import { generateScript } from '../services/ai-script.service';
import type { ScriptStatus } from '@prisma/client';

const router = Router();

// GET /api/v1/marketing/scripts
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const result = await scriptService.listScripts({
      projectId: q.projectId,
      status: q.status as ScriptStatus | undefined,
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/scripts/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const script = await scriptService.getScriptById(String(req.params.id));
    if (!script) return res.status(404).json({ error: 'Script not found' });
    res.json({ script });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/scripts/generate - AI generate script
router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const script = await generateScript(req.body);
    res.status(201).json({ script });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/v1/marketing/scripts - Create manually
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const script = await scriptService.createScript(req.body);
    res.status(201).json({ script });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/scripts/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const script = await scriptService.updateScript(String(req.params.id), req.body);
    res.json({ script });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/scripts/:id/status
router.put('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const script = await scriptService.updateScriptStatus(String(req.params.id), req.body.status);
    res.json({ script });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/scripts/:id/assign
router.put('/:id/assign', async (req: AuthRequest, res: Response) => {
  try {
    const script = await scriptService.assignScript(String(req.params.id), req.body.assignedTo);
    res.json({ script });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/scripts/:id/scenes/:sceneId
router.put('/:id/scenes/:sceneId', async (req: AuthRequest, res: Response) => {
  try {
    const scene = await scriptService.updateScene(String(req.params.id), String(req.params.sceneId), req.body);
    res.json({ scene });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/v1/marketing/scripts/:id/versions
router.get('/:id/versions', async (req: AuthRequest, res: Response) => {
  try {
    const script = await scriptService.getScriptById(String(req.params.id));
    if (!script) return res.status(404).json({ error: 'Script not found' });
    res.json({ versions: script.versions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/scripts/:id/versions - Save a version snapshot
router.post('/:id/versions', async (req: AuthRequest, res: Response) => {
  try {
    const version = await scriptService.createScriptVersion(String(req.params.id));
    res.status(201).json({ version });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
