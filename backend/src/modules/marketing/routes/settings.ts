import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { prisma } from '../../../db';

const router = Router();

// GET /api/v1/marketing/settings/creative-code
router.get('/creative-code', async (_req: AuthRequest, res: Response) => {
  try {
    let config = await prisma.creativeCodeConfig.findFirst();
    if (!config) {
      // Create default config
      config = await prisma.creativeCodeConfig.create({
        data: {
          segments: [
            {
              name: 'Language',
              order: 1,
              values: [
                { code: '1', label: 'Arabic' },
                { code: '2', label: 'English' },
              ],
            },
            {
              name: 'Project',
              order: 2,
              values: [
                { code: '1', label: 'Print In' },
                { code: '2', label: 'Picked In' },
                { code: '3', label: 'Choroida' },
              ],
            },
            {
              name: 'Product',
              order: 3,
              values: [
                { code: '1', label: 'Dual Name' },
                { code: '2', label: 'Slipperz' },
                { code: '3', label: 'Decor Lamp' },
              ],
            },
          ],
          separator: '-',
          seqDigits: 3,
        },
      });
    }
    res.json({ config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/settings/creative-code
router.put('/creative-code', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.creativeCodeConfig.findFirst();
    let config;
    const { segments, separator, seqDigits } = req.body;
    const data = { segments, separator, seqDigits };
    if (existing) {
      config = await prisma.creativeCodeConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      config = await prisma.creativeCodeConfig.create({ data });
    }
    res.json({ config });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/v1/marketing/settings/saved-filters
router.get('/saved-filters', async (req: AuthRequest, res: Response) => {
  try {
    const filters = await prisma.savedFilter.findMany({
      where: { userId: req.user!.userId },
    });
    res.json({ filters });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/settings/saved-filters
router.post('/saved-filters', async (req: AuthRequest, res: Response) => {
  try {
    const filter = await prisma.savedFilter.create({
      data: { ...req.body, userId: req.user!.userId },
    });
    res.status(201).json({ filter });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/marketing/settings/saved-filters/:id
router.delete('/saved-filters/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.savedFilter.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
