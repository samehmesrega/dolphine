import { Router, Response } from 'express';
import { prisma } from '../db';
import type { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize), 10) || 20));
  const unreadOnly = req.query.unread === '1';

  const where = { userId };
  if (unreadOnly) (where as { isRead?: boolean }).isRead = false;

  const [total, notifications] = await prisma.$transaction([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({ total, page, pageSize, notifications });
});

router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  const count = await prisma.notification.count({
    where: { userId: req.user!.userId, isRead: false },
  });
  res.json({ count });
});

router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  const id = req.params.id;
  const userId = req.user!.userId;
  const n = await prisma.notification.findFirst({ where: { id, userId } });
  if (!n) {
    res.status(404).json({ error: 'الإشعار غير موجود' });
    return;
  }
  await prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  });
  res.json({ success: true });
});

router.post('/read-all', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  res.json({ success: true });
});

export default router;
