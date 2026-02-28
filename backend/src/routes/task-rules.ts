import { Router, Response } from 'express';
import { prisma } from '../db';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';

const router = Router();

function hasTasksManage(req: AuthRequest): boolean {
  const perms = req.user?.permissions ?? [];
  return perms.includes('*') || perms.includes('tasks.manage');
}

const ruleSchema = z.object({
  action: z.string().min(1),
  statusSlug: z.string().min(1),
  afterHours: z.number().int().min(1),
  isActive: z.boolean().optional().default(true),
});

// GET /api/task-rules
router.get('/', async (req: AuthRequest, res: Response) => {
  if (!hasTasksManage(req)) {
    res.status(403).json({ error: 'غير مسموح' });
    return;
  }
  try {
    const rules = await prisma.taskRule.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json({ rules });
  } catch (err) {
    console.error('[task-rules] GET error:', err);
    res.status(500).json({ error: 'خطأ داخلي' });
  }
});

// POST /api/task-rules
router.post('/', async (req: AuthRequest, res: Response) => {
  if (!hasTasksManage(req)) {
    res.status(403).json({ error: 'غير مسموح' });
    return;
  }
  try {
    const body = ruleSchema.parse(req.body);
    const rule = await prisma.taskRule.create({ data: body as any });
    res.status(201).json({ rule });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'بيانات غير صالحة', details: err.flatten() });
      return;
    }
    console.error('[task-rules] POST error:', err);
    res.status(500).json({ error: 'خطأ داخلي' });
  }
});

// PATCH /api/task-rules/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  if (!hasTasksManage(req)) {
    res.status(403).json({ error: 'غير مسموح' });
    return;
  }
  try {
    const id = String(req.params.id);
    const body = ruleSchema.partial().parse(req.body);
    const rule = await prisma.taskRule.update({
      where: { id },
      data: body as any,
    });
    res.json({ rule });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'بيانات غير صالحة', details: err.flatten() });
      return;
    }
    console.error('[task-rules] PATCH error:', err);
    res.status(500).json({ error: 'خطأ داخلي' });
  }
});

// DELETE /api/task-rules/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  if (!hasTasksManage(req)) {
    res.status(403).json({ error: 'غير مسموح' });
    return;
  }
  try {
    const id = String(req.params.id);
    await prisma.taskRule.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error('[task-rules] DELETE error:', err);
    res.status(500).json({ error: 'خطأ داخلي' });
  }
});

export default router;
