import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { prisma } from '../../../db';

const router = Router();

// GET /api/v1/marketing/projects
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.mktProject.findMany({
      where: { isActive: true },
      include: { _count: { select: { creatives: true, products: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ projects });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/projects
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, language, isActive } = req.body;
    const project = await prisma.mktProject.create({ data: { name, slug, language, isActive } });
    res.status(201).json({ project });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/projects/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, language, isActive } = req.body;
    const project = await prisma.mktProject.update({
      where: { id: String(req.params.id) },
      data: { name, slug, language, isActive },
    });
    res.json({ project });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/v1/marketing/projects/:id/products
router.get('/:id/products', async (req: AuthRequest, res: Response) => {
  try {
    const products = await prisma.mktProduct.findMany({
      where: { projectId: String(req.params.id), isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/projects/:id/products
router.post('/:id/products', async (req: AuthRequest, res: Response) => {
  try {
    const product = await prisma.mktProduct.create({
      data: { ...req.body, projectId: String(req.params.id) },
    });
    res.status(201).json({ product });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
