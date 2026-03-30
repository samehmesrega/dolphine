import { Router, Response } from 'express';
import { prisma } from '../../../db';
import type { AuthRequest } from '../../../shared/middleware/auth';

const router = Router();

// Helper: check if user is admin/super_admin
function isAdmin(user: AuthRequest['user']): boolean {
  if (!user) return false;
  return (
    user.permissions.includes('*') ||
    user.roleSlug === 'admin' ||
    user.roleSlug === 'super_admin'
  );
}

// ===== POST / — Create ticket (any authenticated user) =====
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'غير مصرح' });
      return;
    }

    const { type, description, screenshot, pageUrl, userAgent } = req.body;

    if (!type || !description) {
      res.status(400).json({ error: 'النوع والوصف مطلوبان' });
      return;
    }

    const validTypes = ['bug', 'improvement', 'suggestion'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: 'نوع التذكرة غير صالح' });
      return;
    }

    const ticket = await prisma.ticket.create({
      data: {
        type,
        description,
        screenshot: screenshot || null,
        pageUrl: pageUrl || null,
        userAgent: userAgent || null,
        createdBy: req.user.userId,
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json({ ticket });
  } catch (err: any) {
    console.error('[Tickets] Create error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء التذكرة' });
  }
});

// ===== GET / — List tickets =====
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'غير مصرح' });
      return;
    }

    const { type, status, priority } = req.query;

    const where: any = {};

    // Non-admin users can only see their own tickets
    if (!isAdmin(req.user)) {
      where.createdBy = req.user.userId;
    }

    if (type && typeof type === 'string') where.type = type;
    if (status && typeof status === 'string') where.status = status;
    if (priority && typeof priority === 'string') where.priority = priority;

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, email: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ tickets });
  } catch (err: any) {
    console.error('[Tickets] List error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب التذاكر' });
  }
});

// ===== GET /:id — Ticket detail with comments =====
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'غير مصرح' });
      return;
    }

    const ticketId = String(req.params.id);
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        comments: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      res.status(404).json({ error: 'التذكرة غير موجودة' });
      return;
    }

    // Non-admin can only see their own tickets
    if (!isAdmin(req.user) && ticket.createdBy !== req.user.userId) {
      res.status(403).json({ error: 'غير مسموح' });
      return;
    }

    res.json({ ticket });
  } catch (err: any) {
    console.error('[Tickets] Detail error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب التذكرة' });
  }
});

// ===== PATCH /:id — Update status/priority/assignedTo (admin only) =====
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'غير مصرح' });
      return;
    }

    if (!isAdmin(req.user)) {
      res.status(403).json({ error: 'غير مسموح — للمديرين فقط' });
      return;
    }

    const { status, priority, assignedTo } = req.body;
    const data: any = {};

    const validStatuses = ['new', 'reviewing', 'in_progress', 'resolved', 'closed'];
    const validPriorities = ['critical', 'high', 'medium', 'low'];

    if (status) {
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: 'حالة غير صالحة' });
        return;
      }
      data.status = status;
      if (status === 'resolved') {
        data.resolvedAt = new Date();
      }
    }

    if (priority) {
      if (!validPriorities.includes(priority)) {
        res.status(400).json({ error: 'أولوية غير صالحة' });
        return;
      }
      data.priority = priority;
    }

    if (assignedTo !== undefined) {
      data.assignedTo = assignedTo || null;
    }

    const ticketId = String(req.params.id);
    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data,
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    res.json({ ticket });
  } catch (err: any) {
    console.error('[Tickets] Update error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث التذكرة' });
  }
});

// ===== POST /:id/comments — Add comment =====
router.post('/:id/comments', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'غير مصرح' });
      return;
    }

    const { content } = req.body;
    if (!content || !content.trim()) {
      res.status(400).json({ error: 'التعليق مطلوب' });
      return;
    }

    const ticketId = String(req.params.id);

    // Check ticket exists and user has access
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      res.status(404).json({ error: 'التذكرة غير موجودة' });
      return;
    }

    // Non-admin can only comment on their own tickets
    if (!isAdmin(req.user) && ticket.createdBy !== req.user.userId) {
      res.status(403).json({ error: 'غير مسموح' });
      return;
    }

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId,
        userId: req.user.userId,
        content: content.trim(),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json({ comment });
  } catch (err: any) {
    console.error('[Tickets] Comment error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة التعليق' });
  }
});

export default router;
