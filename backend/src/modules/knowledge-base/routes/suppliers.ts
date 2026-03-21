import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { requirePermission } from '../../../shared/middleware/auth';
import * as supplierService from '../services/kb-supplier.service';

const router = Router({ mergeParams: true });

// GET /api/v1/knowledge-base/products/:productId/suppliers
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const suppliers = await supplierService.listSuppliers(String(req.params.productId));
    res.json({ suppliers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/knowledge-base/products/:productId/suppliers/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const supplier = await supplierService.getSupplierById(String(req.params.id));
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ supplier });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/knowledge-base/products/:productId/suppliers
router.post('/', requirePermission('kb.manufacturing.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const supplier = await supplierService.createSupplier({
      ...req.body,
      productId: String(req.params.productId),
    });
    res.status(201).json({ supplier });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:productId/suppliers/:id
router.put('/:id', requirePermission('kb.manufacturing.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const supplier = await supplierService.updateSupplier(String(req.params.id), req.body);
    res.json({ supplier });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/knowledge-base/products/:productId/suppliers/:id
router.delete('/:id', requirePermission('kb.manufacturing.edit'), async (req: AuthRequest, res: Response) => {
  try {
    await supplierService.deleteSupplier(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
