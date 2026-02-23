import { Router, Response } from 'express';
import { prisma } from '../db';
import type { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize), 10) || 20));
    const unreadOnly = req.query.unread === '1';

    const where: { userId: string; isRead?: boolean } = { userId };
    if (unreadOnly) where.isRead = false;

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
  } catch (err: unknown) {
    console.error('Notifications list error:', err);
    res.status(500).json({ error: 'خطأ في تحميل الإشعارات' });
  }
});

router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.userId, isRead: false },
    });
    res.json({ count });
  } catch (err: unknown) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'خطأ في تحميل عدد الإشعارات' });
  }
});

router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
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
  } catch (err: unknown) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'خطأ في تحديث الإشعار' });
  }
});

router.post('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ success: true });
  } catch (err: unknown) {
    console.error('Mark all notifications read error:', err);
    res.status(500).json({ error: 'خطأ في تحديث الإشعارات' });
  }
});

export default router;
