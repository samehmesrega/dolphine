import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { prisma } from '../../../db';
import * as lpService from '../services/landing-page.service';
import * as aiLpService from '../services/ai-landing-page.service';

const router = Router();

// ===== Helpers =====

function buildProductContext(product: any): string {
  let ctx = `## Product: ${product.name}\n`;
  if (product.description) ctx += `Description: ${product.description}\n`;
  if (product.sku) ctx += `SKU: ${product.sku}\n`;
  if (product.category) ctx += `Category: ${product.category}\n`;
  if (product.dimensions) ctx += `Dimensions: ${product.dimensions}\n`;
  if (product.weight) ctx += `Weight: ${product.weight}\n`;

  // Pricing
  if (product.pricing?.length) {
    ctx += `\n## Pricing\n`;
    for (const p of product.pricing) {
      ctx += `- ${p.priceType}: ${p.price} ${p.currency}`;
      if (p.variation) ctx += ` (${p.variation.name})`;
      ctx += '\n';
    }
  }

  // Variations
  if (product.variations?.length) {
    ctx += `\n## Variations\n`;
    for (const v of product.variations) {
      ctx += `- ${v.name}`;
      if (v.color) ctx += `, Color: ${v.color}`;
      if (v.size) ctx += `, Size: ${v.size}`;
      ctx += '\n';
    }
  }

  // Marketing
  if (product.marketing) {
    const m = product.marketing;
    if (m.usps) ctx += `\n## USPs (Unique Selling Points)\n${m.usps}\n`;
    if (m.targetAudience) ctx += `\n## Target Audience\n${m.targetAudience}\n`;
    if (m.competitorComparison) ctx += `\n## vs Competitors\n${m.competitorComparison}\n`;
    if (m.brandVoice) ctx += `\n## Brand Voice\n${m.brandVoice}\n`;
    if (m.keywords) ctx += `\n## Keywords\n${m.keywords}\n`;
  }

  // FAQs
  if (product.faqs?.length) {
    ctx += `\n## FAQs\n`;
    for (const f of product.faqs) {
      ctx += `Q: ${f.question}\nA: ${f.answer}\n\n`;
    }
  }

  // Objections
  if (product.objections?.length) {
    ctx += `\n## Common Objections & Responses\n`;
    for (const o of product.objections) {
      ctx += `Objection: ${o.objection}\nResponse: ${o.response}\n\n`;
    }
  }

  // Sales Scripts
  if (product.salesScripts?.length) {
    ctx += `\n## Sales Scripts\n`;
    for (const s of product.salesScripts) {
      ctx += `### ${s.title}\n${s.content}\n\n`;
    }
  }

  // After Sales
  if (product.afterSales) {
    const a = product.afterSales;
    if (a.warrantyTerms) ctx += `\n## Warranty\n${a.warrantyTerms}\n`;
    if (a.returnPolicy) ctx += `\n## Return Policy\n${a.returnPolicy}\n`;
    if (a.usageInstructions) ctx += `\n## Usage Instructions\n${a.usageInstructions}\n`;
  }

  // Manufacturing (for quality messaging)
  if (product.manufacturing) {
    const mfg = product.manufacturing;
    if (mfg.materials) ctx += `\n## Materials\n${mfg.materials}\n`;
    if (mfg.productionSteps) ctx += `\n## Production Process\n${mfg.productionSteps}\n`;
  }

  // Media URLs
  if (product.media?.length) {
    ctx += `\n## Product Images\n`;
    for (const m of product.media) {
      if (m.type === 'image') ctx += `- ${m.url}\n`;
    }
  }

  return ctx;
}

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
      kbProductId, formTemplateId, aiProvider, aiModel,
    } = req.body;

    // Resolve brandId — if it's a project ID, find or create matching brand
    let resolvedBrandId = brandId;
    if (brandId) {
      const brandExists = await prisma.brand.findUnique({ where: { id: brandId } });
      if (!brandExists) {
        // brandId might be a project ID, try to find the project
        const project = await prisma.mktProject.findUnique({ where: { id: brandId } });
        if (project) {
          // Find or create a brand with the same slug
          const brand = await prisma.brand.upsert({
            where: { slug: project.slug },
            update: {},
            create: { name: project.name, slug: project.slug, language: project.language },
          });
          resolvedBrandId = brand.id;
        }
      }
    }

    // Resolve KB product context if provided
    let productContext: string | undefined;
    let resolvedProductImages = productImages || [];
    let resolvedProductName = productName || title;
    let resolvedProductDescription = productDescription;
    let resolvedProductPrice = productPrice;

    if (kbProductId) {
      const kbProduct = await prisma.kbProduct.findUnique({
        where: { id: kbProductId, isActive: true },
        include: {
          media: { orderBy: { orderNum: 'asc' } },
          pricing: { include: { variation: true }, orderBy: { updatedAt: 'desc' } },
          variations: { include: { pricing: true }, orderBy: { createdAt: 'desc' } },
          marketing: true,
          faqs: { orderBy: { orderNum: 'asc' } },
          objections: { orderBy: { orderNum: 'asc' } },
          salesScripts: { orderBy: { orderNum: 'asc' } },
          afterSales: true,
          manufacturing: true,
        },
      });
      if (kbProduct) {
        productContext = buildProductContext(kbProduct);
        // Use KB product data as fallback if not explicitly provided
        if (!productName) resolvedProductName = kbProduct.name;
        if (!productDescription) resolvedProductDescription = kbProduct.description || undefined;
        // Extract price from pricing data
        if (!productPrice && kbProduct.pricing?.length) {
          const mainPrice = kbProduct.pricing[0];
          resolvedProductPrice = `${mainPrice.price} ${mainPrice.currency}`;
        }
        // Append KB product images
        if (!productImages?.length && kbProduct.media?.length) {
          resolvedProductImages = kbProduct.media
            .filter((m: any) => m.type === 'image')
            .map((m: any) => m.url);
        }
      }
    }

    // Resolve form template if provided
    let formFieldSpecs: Array<{ fieldName: string; label: string; type: string; required: boolean }> | undefined;
    let paymentMethods: string[] | undefined;
    let resolvedFormFields = formFields || ['name', 'phone'];

    if (formTemplateId) {
      const template = await prisma.orderFormTemplate.findUnique({
        where: { id: formTemplateId },
        include: { fields: { orderBy: { orderNum: 'asc' } } },
      });
      if (template) {
        formFieldSpecs = template.fields.map((f) => ({
          fieldName: f.fieldName,
          label: f.label,
          type: f.type,
          required: f.required,
        }));
        paymentMethods = template.paymentMethods as string[];
        // Override formFields with template field names
        resolvedFormFields = template.fields.map((f) => f.fieldName);
      }
    }

    // Generate HTML with AI
    const html = await aiLpService.generateLandingPage({
      provider: aiProvider || 'anthropic',
      model: aiModel || 'claude-sonnet-4-20250514',
      productName: resolvedProductName,
      productDescription: resolvedProductDescription,
      productPrice: resolvedProductPrice,
      productImages: resolvedProductImages,
      storeName: storeName || '',
      language: language || 'ar',
      instructions,
      formFields: resolvedFormFields,
      productContext,
      formFieldSpecs,
      paymentMethods,
    });

    // Create landing page record
    const page = await lpService.createLandingPage({
      title,
      slug,
      brandId: resolvedBrandId,
      productId,
      html,
      createdBy: req.user!.userId,
    });

    // Save formTemplateId on the landing page if provided
    if (formTemplateId) {
      await prisma.landingPage.update({
        where: { id: page.id },
        data: { formTemplateId },
      });
    }

    // Auto-create field mappings
    if (formTemplateId) {
      // Use template fields for precise mappings
      const template = await prisma.orderFormTemplate.findUnique({
        where: { id: formTemplateId },
        include: { fields: { orderBy: { orderNum: 'asc' } } },
      });
      if (template) {
        const mappings = template.fields.map((f) => ({
          formFieldName: f.fieldName,
          leadField: f.leadField,
        }));
        await lpService.updateFieldMappings(page.id, mappings);
      }
    } else {
      // Fallback: auto-create field mappings for common fields
      const commonMappings = resolvedFormFields.map((f: string) => ({
        formFieldName: f,
        leadField: f === 'phone' ? 'phone' : f,
      }));
      await lpService.updateFieldMappings(page.id, commonMappings);
    }

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

    // Generate edited HTML (uses decrypted key from DB via anthropic provider)
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
