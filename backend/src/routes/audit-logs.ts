import { Router, Response } from 'express';
import { prisma } from '../db';
import type { AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/auth';

const router = Router();

router.get('/', requirePermission('audit.view'), async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize), 10) || 20));
    const entity = typeof req.query.entity === 'string' ? req.query.entity : undefined;
    const action = typeof req.query.action === 'string' ? req.query.action : undefined;
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

    const where: { entity?: string; action?: string; userId?: string } = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (userId) where.userId = userId;

    const [total, logs] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    res.json({ total, page, pageSize, logs });
  } catch (err: unknown) {
    console.error('Audit logs error:', err);
    res.status(500).json({ error: 'خطأ في تحميل سجل التدقيق' });
  }
});

export default router;
