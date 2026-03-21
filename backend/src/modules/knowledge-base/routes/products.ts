import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { requirePermission } from '../../../shared/middleware/auth';
import * as productService from '../services/kb-product.service';

const router = Router();

// GET /api/v1/knowledge-base/products
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const products = await productService.listProducts({
      q: q.q,
      category: q.category,
      projectId: q.projectId,
    });
    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/knowledge-base/products/search
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q || '');
    if (!q.trim()) {
      return res.json({ products: [] });
    }
    const products = await productService.searchProducts(q);
    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/knowledge-base/products/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const product = await productService.getProductById(String(req.params.id));
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/knowledge-base/products
router.post('/', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const product = await productService.createProduct({
      ...req.body,
      createdBy: (req as any).user.userId,
    });
    res.status(201).json({ product });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:id
router.put('/:id', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const product = await productService.updateProduct(String(req.params.id), req.body);
    res.json({ product });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/knowledge-base/products/:id (soft delete)
router.delete('/:id', requirePermission('kb.admin'), async (req: AuthRequest, res: Response) => {
  try {
    await productService.deleteProduct(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
