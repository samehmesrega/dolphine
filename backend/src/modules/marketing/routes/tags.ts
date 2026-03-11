import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { prisma } from '../../../db';

const router = Router();

// GET /api/v1/marketing/tags - All tags grouped by category
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.tagCategory.findMany({
      include: { tags: true },
      orderBy: { name: 'asc' },
    });
    res.json({ categories });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/tags
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, categoryId } = req.body;
    const tag = await prisma.tag.create({
      data: { name, categoryId },
      include: { category: true },
    });
    res.status(201).json({ tag });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/marketing/tags/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.tag.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/v1/marketing/tag-categories
router.get('/categories', async (_req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.tagCategory.findMany({ orderBy: { name: 'asc' } });
    res.json({ categories });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/tag-categories
router.post('/categories', async (req: AuthRequest, res: Response) => {
  try {
    const category = await prisma.tagCategory.create({
      data: { name: req.body.name, isFixed: false },
    });
    res.status(201).json({ category });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
