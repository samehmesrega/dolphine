import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import * as lpService from '../services/landing-page.service';
import * as aiLpService from '../services/ai-landing-page.service';

const router = Router();

// ===== Landing Pages CRUD =====

// GET /api/v1/marketing/landing-pages
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const pages = await lpService.listLandingPages({
      brandId: q.brandId,
      status: q.status,
    });
    res.json({ landingPages: pages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/landing-pages/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const page = await lpService.getLandingPageById(String(req.params.id));
    if (!page) return res.status(404).json({ error: 'Landing page not found' });
    res.json({ landingPage: page });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/landing-pages/generate
router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const {
      title, slug, brandId, productId,
      productName, productDescription, productPrice, productImages,
      storeName, language, instructions, formFields,
    } = req.body;

    // Generate HTML with AI
    const html = await aiLpService.generateLandingPage({
      productName: productName || title,
      productDescription,
      productPrice,
      productImages,
      storeName: storeName || '',
      language: language || 'ar',
      instructions,
      formFields: formFields || ['name', 'phone'],
    });

    // Create landing page record
    const page = await lpService.createLandingPage({
      title,
      slug,
      brandId,
      productId,
      html,
      createdBy: req.user!.userId,
    });

    // Auto-create field mappings for common fields
    const commonMappings = (formFields || ['name', 'phone']).map((f: string) => ({
      formFieldName: f,
      leadField: f === 'phone' ? 'phone' : f,
    }));
    await lpService.updateFieldMappings(page.id, commonMappings);

    res.status(201).json({ landingPage: page });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/landing-pages (manual create with HTML)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, slug, brandId, productId, html, css } = req.body;
    const page = await lpService.createLandingPage({
      title,
      slug,
      brandId,
      productId,
      html: html || '<html><body><h1>New Landing Page</h1></body></html>',
      css,
      createdBy: req.user!.userId,
    });
    res.status(201).json({ landingPage: page });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/landing-pages/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const page = await lpService.updateLandingPage(String(req.params.id), req.body);
    res.json({ landingPage: page });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/marketing/landing-pages/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await lpService.deleteLandingPage(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ===== AI Edit =====

// POST /api/v1/marketing/landing-pages/:id/edit
router.post('/:id/edit', async (req: AuthRequest, res: Response) => {
  try {
    const { editRequest } = req.body;
    const existing = await lpService.getLandingPageById(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Landing page not found' });

    // Generate edited HTML
    const newHtml = await aiLpService.editLandingPage({
      currentHtml: existing.html,
      editRequest,
    });

    // Save new version
    const result = await lpService.updateLandingPageHtml(
      existing.id,
      newHtml,
      undefined,
      editRequest
    );

    res.json({ html: newHtml, versionNumber: result.versionNumber });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Publish / Unpublish =====

// POST /api/v1/marketing/landing-pages/:id/publish
router.post('/:id/publish', async (req: AuthRequest, res: Response) => {
  try {
    const page = await lpService.publishLandingPage(String(req.params.id));
    res.json({ landingPage: page });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/v1/marketing/landing-pages/:id/unpublish
router.post('/:id/unpublish', async (req: AuthRequest, res: Response) => {
  try {
    const page = await lpService.unpublishLandingPage(String(req.params.id));
    res.json({ landingPage: page });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ===== Versions =====

// GET /api/v1/marketing/landing-pages/:id/versions
router.get('/:id/versions', async (req: AuthRequest, res: Response) => {
  try {
    const versions = await lpService.getVersions(String(req.params.id));
    res.json({ versions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/landing-pages/:id/rollback/:versionId
router.post('/:id/rollback/:versionId', async (req: AuthRequest, res: Response) => {
  try {
    const page = await lpService.rollbackToVersion(
      String(req.params.id),
      String(req.params.versionId)
    );
    res.json({ landingPage: page });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ===== Field Mappings =====

// GET /api/v1/marketing/landing-pages/:id/field-mappings
router.get('/:id/field-mappings', async (req: AuthRequest, res: Response) => {
  try {
    const mappings = await lpService.getFieldMappings(String(req.params.id));
    res.json({ mappings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/landing-pages/:id/field-mappings
router.put('/:id/field-mappings', async (req: AuthRequest, res: Response) => {
  try {
    const mappings = await lpService.updateFieldMappings(
      String(req.params.id),
      req.body.mappings || []
    );
    res.json({ mappings });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ===== A/B Tests =====

// GET /api/v1/marketing/landing-pages/ab-tests
router.get('/ab-tests/list', async (_req: AuthRequest, res: Response) => {
  try {
    const tests = await lpService.listABTests();
    res.json({ abTests: tests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/landing-pages/:id/ab-test
router.post('/:id/ab-test', async (req: AuthRequest, res: Response) => {
  try {
    const { landingPageBId, trafficSplit } = req.body;
    const test = await lpService.createABTest({
      landingPageAId: String(req.params.id),
      landingPageBId,
      trafficSplit,
    });
    res.status(201).json({ abTest: test });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/landing-pages/ab-tests/:testId/end
router.put('/ab-tests/:testId/end', async (req: AuthRequest, res: Response) => {
  try {
    const { winnerId } = req.body;
    const test = await lpService.endABTest(String(req.params.testId), winnerId);
    res.json({ abTest: test });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
