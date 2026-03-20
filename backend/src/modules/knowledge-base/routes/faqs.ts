import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { requirePermission } from '../../../shared/middleware/auth';
import * as faqService from '../services/kb-faq.service';

const router = Router({ mergeParams: true });

// GET /api/v1/knowledge-base/products/:productId/faqs
router.get('/', requirePermission('kb.view'), async (req: AuthRequest, res: Response) => {
  try {
    const faqs = await faqService.listFaqs(String(req.params.productId));
    res.json({ faqs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/knowledge-base/products/:productId/faqs/:id
router.get('/:id', requirePermission('kb.view'), async (req: AuthRequest, res: Response) => {
  try {
    const faq = await faqService.getFaqById(String(req.params.id));
    if (!faq) return res.status(404).json({ error: 'FAQ not found' });
    res.json({ faq });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/knowledge-base/products/:productId/faqs
router.post('/', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const faq = await faqService.createFaq({
      ...req.body,
      productId: String(req.params.productId),
    });
    res.status(201).json({ faq });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:productId/faqs/:id
router.put('/:id', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const faq = await faqService.updateFaq(String(req.params.id), req.body);
    res.json({ faq });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/knowledge-base/products/:productId/faqs/:id
router.delete('/:id', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    await faqService.deleteFaq(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/knowledge-base/products/:productId/faqs/reorder
router.put('/reorder', requirePermission('kb.product.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const faqs = await faqService.reorderFaqs(
      String(req.params.productId),
      req.body.orderedIds
    );
    res.json({ faqs });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
