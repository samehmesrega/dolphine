import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { prisma } from '../../../db';

const router = Router();

// GET /api/v1/marketing/competitors
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const where = q.platform ? { platform: q.platform } : {};
    const page = q.page ?? '1';
    const pageSize = q.pageSize ?? '25';

    const [references, total] = await Promise.all([
      prisma.competitorReference.findMany({
        where,
        include: { adder: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
      prisma.competitorReference.count({ where }),
    ]);

    res.json({ references, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/competitors
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, url, platform, notes, screenshotUrl, competitorName, tags } = req.body;
    const ref = await prisma.competitorReference.create({
      data: { title, url, platform, notes, screenshotUrl, competitorName, tags, addedBy: req.user!.userId },
      include: { adder: { select: { id: true, name: true } } },
    });
    res.status(201).json({ reference: ref });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/competitors/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title, url, platform, notes, screenshotUrl, competitorName, tags } = req.body;
    const ref = await prisma.competitorReference.update({
      where: { id: String(req.params.id) },
      data: { title, url, platform, notes, screenshotUrl, competitorName, tags },
    });
    res.json({ reference: ref });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/marketing/competitors/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.competitorReference.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
