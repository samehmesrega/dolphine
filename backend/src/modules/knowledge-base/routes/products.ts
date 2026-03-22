import { Router } from 'express';
import type { Response } from 'express';
import multer from 'multer';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { requirePermission } from '../../../shared/middleware/auth';
import * as productService from '../services/kb-product.service';
import * as wooImportService from '../services/kb-woo-import.service';
import {
  PRODUCT_IMPORT_TEMPLATE,
  importSchema,
  importProduct,
  formatZodErrors,
} from '../services/kb-import.service';

const jsonUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 }, // 1 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('يُسمح فقط بملفات JSON'));
    }
  },
}).single('file');

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

// GET /api/v1/knowledge-base/products/import/template
router.get(
  '/import/template',
  requirePermission('kb.product.edit'),
  async (_req: AuthRequest, res: Response) => {
    res.setHeader('Content-Disposition', 'attachment; filename="product-template.json"');
    res.json(PRODUCT_IMPORT_TEMPLATE);
  }
);

// POST /api/v1/knowledge-base/products/import
router.post(
  '/import',
  requirePermission('kb.product.edit'),
  (req: AuthRequest, res: Response, next) => {
    jsonUpload(req as any, res as any, (err: any) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'خطأ في رفع الملف' });
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    try {
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ error: 'لم يتم رفع ملف' });
      }

      let rawData: any;
      try {
        rawData = JSON.parse(file.buffer.toString('utf-8'));
      } catch {
        return res.status(400).json({ error: 'الملف لا يحتوي على JSON صحيح' });
      }

      // Strip template hint fields
      const { _instructions, _hint, ...cleanData } = rawData;
      if (cleanData.pricing) {
        cleanData.pricing = cleanData.pricing.map(({ _hint, ...rest }: any) => rest);
      }

      const parsed = importSchema.safeParse(cleanData);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'بيانات الملف غير صحيحة',
          details: formatZodErrors(parsed.error),
        });
      }

      const userId = (req as any).user.userId;
      const product = await importProduct(parsed.data, userId);
      res.status(201).json({ product });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'حدث خطأ أثناء الاستيراد' });
    }
  }
);

// GET /api/v1/knowledge-base/products/woo-products — list WC products
router.get('/woo-products', async (req: AuthRequest, res: Response) => {
  try {
    const products = await wooImportService.fetchWooProducts();
    res.json({ products });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/v1/knowledge-base/products/import-woo/:wooProductId — import WC product
router.post('/import-woo/:wooProductId', async (req: AuthRequest, res: Response) => {
  try {
    const product = await wooImportService.importWooProduct(
      Number(req.params.wooProductId),
      req.user!.userId
    );
    res.status(201).json({ product });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
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
