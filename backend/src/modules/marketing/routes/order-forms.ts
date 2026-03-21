import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import * as orderFormService from '../services/order-form.service';

const router = Router();

// GET /api/v1/marketing/order-forms
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const templates = await orderFormService.listTemplates();
    res.json({ templates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/order-forms/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const template = await orderFormService.getTemplateById(String(req.params.id));
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ template });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/order-forms
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const template = await orderFormService.createTemplate(req.body);
    res.status(201).json({ template });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/order-forms/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const template = await orderFormService.updateTemplate(String(req.params.id), req.body);
    res.json({ template });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/marketing/order-forms/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await orderFormService.deleteTemplate(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
