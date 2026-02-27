import { Router, Response } from 'express';
import { prisma } from '../db';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// ====== Re-contact check ======
async function runReContactCheck(userId: string, isManager: boolean) {
  const rules = await prisma.taskRule.findMany({ where: { isActive: true } });
  for (const rule of rules) {
    const cutoff = new Date(Date.now() - rule.afterDays * 86400000);

    const leads = await prisma.lead.findMany({
      where: {
        status: { slug: rule.statusSlug },
        assignedToId: isManager ? { not: null } : userId,
        NOT: [
          { communications: { some: { createdAt: { gte: cutoff } } } },
          { tasks: { some: { type: 're_contact', status: 'pending' } } },
        ],
      },
      select: { id: true, name: true, assignedToId: true },
    });

    for (const lead of leads) {
      if (!lead.assignedToId) continue;
      await prisma.task.create({
        data: {
          type: 're_contact',
          title: `إعادة تواصل: ${lead.name} (${rule.afterDays} أيام بدون تواصل)`,
          leadId: lead.id,
          assignedToId: lead.assignedToId,
          status: 'pending',
        },
      });
    }
  }
}

function hasTasksManage(req: AuthRequest): boolean {
  const perms = req.user?.permissions ?? [];
  return perms.includes('*') || perms.includes('tasks.manage');
}

// GET /api/tasks
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const isManager = hasTasksManage(req);

    // شغل re-contact check
    try {
      await runReContactCheck(userId, isManager);
    } catch (e) {
      console.error('[tasks] re-contact check error:', e);
    }

    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const filterUserId =
      isManager && typeof req.query.assignedToId === 'string'
        ? req.query.assignedToId
        : undefined;

    const now = new Date();

    // للـ snoozed: نشيل الـ tasks اللي انتهت مدة تأجيلها ونرجعها pending
    await prisma.task.updateMany({
      where: {
        status: 'snoozed',
        snoozedUntil: { lte: now },
        assignedToId: isManager ? undefined : userId,
      },
      data: { status: 'pending', snoozedUntil: null },
    });

    const where: Record<string, unknown> = {
      status,
      ...(type ? { type } : {}),
    };

    if (isManager) {
      if (filterUserId) where.assignedToId = filterUserId;
    } else {
      where.assignedToId = userId;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, name: true } },
        lead: { select: { id: true, number: true, name: true, phone: true } },
        order: { select: { id: true, number: true, wooCommerceId: true } },
      },
    });

    res.json({ tasks });
  } catch (err) {
    console.error('[tasks] GET error:', err);
    res.status(500).json({ error: 'خطأ داخلي' });
  }
});

// POST /api/tasks — مهمة يدوية (manager فقط)
const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignedToId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
});

router.post('/', async (req: AuthRequest, res: Response) => {
  if (!hasTasksManage(req)) {
    res.status(403).json({ error: 'غير مسموح' });
    return;
  }
  try {
    const body = createTaskSchema.parse(req.body);
    const task = await prisma.task.create({
      data: {
        type: 'manual',
        title: body.title,
        description: body.description,
        assignedToId: body.assignedToId,
        leadId: body.leadId,
        orderId: body.orderId,
        status: 'pending',
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        lead: { select: { id: true, number: true, name: true } },
        order: { select: { id: true, number: true, wooCommerceId: true } },
      },
    });
    res.status(201).json({ task });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'بيانات غير صالحة', details: err.flatten() });
      return;
    }
    console.error('[tasks] POST error:', err);
    res.status(500).json({ error: 'خطأ داخلي' });
  }
});

// PATCH /api/tasks/:id/done
router.patch('/:id/done', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) { res.status(404).json({ error: 'المهمة غير موجودة' }); return; }

    // الموظف يقدر يعلم مهمته بس، المدير يقدر أي مهمة
    if (!hasTasksManage(req) && task.assignedToId !== userId) {
      res.status(403).json({ error: 'غير مسموح' });
      return;
    }

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: { status: 'done', completedAt: new Date(), completedById: userId },
    });
    res.json({ task: updated });
  } catch (err) {
    console.error('[tasks] PATCH done error:', err);
    res.status(500).json({ error: 'خطأ داخلي' });
  }
});

// PATCH /api/tasks/:id/snooze
const snoozeSchema = z.object({
  days: z.number().int().min(1).max(30),
});

router.patch('/:id/snooze', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const body = snoozeSchema.parse(req.body);
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) { res.status(404).json({ error: 'المهمة غير موجودة' }); return; }

    if (!hasTasksManage(req) && task.assignedToId !== userId) {
      res.status(403).json({ error: 'غير مسموح' });
      return;
    }

    const snoozedUntil = new Date(Date.now() + body.days * 86400000);
    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: { status: 'snoozed', snoozedUntil },
    });
    res.json({ task: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'بيانات غير صالحة' });
      return;
    }
    console.error('[tasks] PATCH snooze error:', err);
    res.status(500).json({ error: 'خطأ داخلي' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  if (!hasTasksManage(req)) {
    res.status(403).json({ error: 'غير مسموح' });
    return;
  }
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('[tasks] DELETE error:', err);
    res.status(500).json({ error: 'خطأ داخلي' });
  }
});

export default router;
