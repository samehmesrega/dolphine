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
  try {
    const showHidden = req.query.hidden === '1';
    const products = await prisma.product.findMany({
      where: showHidden ? { isActive: false } : { isActive: true },
      select: productSelect,
      orderBy: { name: 'asc' },
    });
    res.json({ products });
  } catch (err: unknown) {
    console.error('Products list error:', err);
    res.status(500).json({ error: 'خطأ في تحميل المنتجات' });
  }
});

// قائمة المنتجات المخفية فقط
router.get('/hidden', async (_req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: false },
      select: productSelect,
      orderBy: { name: 'asc' },
    });
    res.json({ products });
  } catch (err: unknown) {
    console.error('Hidden products error:', err);
    res.status(500).json({ error: 'خطأ في تحميل المنتجات المخفية' });
  }
});

/** تغيير حالة المنتج — مشترك بين hide وrestore لتجنب تكرار الكود */
async function setProductActive(id: string, isActive: boolean, res: Response): Promise<void> {
  try {
    await prisma.product.update({ where: { id }, data: { isActive } });
    res.json({ success: true });
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : '';
    if (code === 'P2025') {
      res.status(404).json({ error: 'المنتج غير موجود' });
      return;
    }
    console.error('Product setActive error:', err);
    res.status(500).json({ error: 'خطأ في تحديث حالة المنتج' });
  }
}

// إخفاء منتج — POST و PATCH للتوافق
router.post('/:id/hide', (req: Request, res: Response) => setProductActive(String(req.params.id), false, res));
router.patch('/:id/hide', (req: Request, res: Response) => setProductActive(String(req.params.id), false, res));

// استعادة منتج — POST و PATCH للتوافق
router.post('/:id/restore', (req: Request, res: Response) => setProductActive(String(req.params.id), true, res));
router.patch('/:id/restore', (req: Request, res: Response) => setProductActive(String(req.params.id), true, res));

export default router;
