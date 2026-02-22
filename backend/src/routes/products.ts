import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

const productSelect = {
  id: true,
  name: true,
  wooCommerceId: true,
  variations: true,
  data: true,
} as const;

router.get('/', async (req: Request, res: Response) => {
  const showHidden = req.query.hidden === '1';
  const products = await prisma.product.findMany({
    where: showHidden ? { isActive: false } : { isActive: true },
    select: productSelect,
    orderBy: { name: 'asc' },
  });
  res.json({ products });
});

// قائمة المنتجات المخفية فقط
router.get('/hidden', async (_req: Request, res: Response) => {
  const products = await prisma.product.findMany({
    where: { isActive: false },
    select: productSelect,
    orderBy: { name: 'asc' },
  });
  res.json({ products });
});

// إخفاء منتج (جعله غير نشط) — POST و PATCH للتوافق
router.post('/:id/hide', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : '';
    if (code === 'P2025') {
      res.status(404).json({ error: 'المنتج غير موجود' });
      return;
    }
    throw err;
  }
});
router.patch('/:id/hide', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : '';
    if (code === 'P2025') {
      res.status(404).json({ error: 'المنتج غير موجود' });
      return;
    }
    throw err;
  }
});

// استعادة منتج (جعله نشطاً) — POST و PATCH للتوافق
router.post('/:id/restore', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    await prisma.product.update({
      where: { id },
      data: { isActive: true },
    });
    res.json({ success: true });
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : '';
    if (code === 'P2025') {
      res.status(404).json({ error: 'المنتج غير موجود' });
      return;
    }
    throw err;
  }
});
router.patch('/:id/restore', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    await prisma.product.update({
      where: { id },
      data: { isActive: true },
    });
    res.json({ success: true });
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : '';
    if (code === 'P2025') {
      res.status(404).json({ error: 'المنتج غير موجود' });
      return;
    }
    throw err;
  }
});

export default router;
