import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import * as lpService from '../services/landing-page.service';
import { prisma } from '../../../db';

// Zod schema for form submission — sanitize all fields
const formSubmissionSchema = z.record(
  z.string().max(200),
  z.string().max(2000).trim()
).refine(
  (data) => Object.keys(data).length <= 50,
  { message: 'Too many fields' }
);

const router = Router();

function getFormScript(landingPageId: string) {
  return `
<div style="position:absolute;left:-9999px;"><input type="text" name="_hp" tabindex="-1" autocomplete="off"></div>
<script>
document.getElementById('lp-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  const urlParams = new URLSearchParams(window.location.search);
  data._utm_source = urlParams.get('utm_source') || '';
  data._utm_medium = urlParams.get('utm_medium') || '';
  data._utm_campaign = urlParams.get('utm_campaign') || '';
  data._utm_content = urlParams.get('utm_content') || '';
  data._landing_page_id = '${landingPageId}';
  try {
    const res = await fetch('/lp/submit/${landingPageId}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      e.target.innerHTML = '<h2 style="text-align:center;color:green;padding:20px;">\\u2705 تم التسجيل بنجاح!</h2>';
    }
  } catch (err) {
    alert('حدث خطأ، حاول مرة أخرى');
  }
});
</script>`;
}

// GET /lp/:brand/:slug — Serve public landing page
router.get('/:brand/:slug', async (req: Request, res: Response) => {
  try {
    const lp = await lpService.getPublishedLP(
      String(req.params.brand),
      String(req.params.slug)
    );
    if (!lp) return res.status(404).send('Not found');

    // Check for active A/B test
    const abTest = await lpService.getActiveABTest(lp.id);
    let html = lp.html;

    if (abTest) {
      // Cookie-based variant assignment
      const cookieName = `ab_${abTest.id}`;
      const existingVariant = req.cookies?.[cookieName];
      const variant =
        existingVariant || (Math.random() * 100 < abTest.trafficSplit ? 'A' : 'B');

      if (!existingVariant) {
        res.cookie(cookieName, variant, {
          maxAge: 30 * 24 * 60 * 60 * 1000,
          httpOnly: true,
        });
      }

      html =
        variant === 'A'
          ? abTest.landingPageA.html
          : abTest.landingPageB.html;

      // Track A/B visit
      const visitField = variant === 'A' ? 'visitsA' : 'visitsB';
      await prisma.aBTest.update({
        where: { id: abTest.id },
        data: { [visitField]: { increment: 1 } },
      });
    }

    // Inject form submission script
    html = html.replace('</body>', `${getFormScript(lp.id)}</body>`);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err: any) {
    res.status(500).send('Server error');
  }
});

// POST /lp/submit/:landingPageId — Public form submission
router.post('/submit/:landingPageId', async (req: Request, res: Response) => {
  try {
    // Validate & sanitize input
    const parsed = formSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'بيانات غير صحيحة' });
    }
    const formData = parsed.data;

    // Honeypot check — bots fill hidden field, humans don't
    if (formData._hp) {
      return res.json({ success: true }); // fake success
    }

    // Validate landingPageId format
    if (!/^[a-f0-9-]{36}$/.test(String(req.params.landingPageId))) {
      return res.status(400).json({ success: false, error: 'Invalid landing page ID' });
    }

    // Basic phone validation
    const phone = formData.phone || '';
    if (phone && phone.replace(/\D/g, '').length < 8) {
      return res.status(400).json({ success: false, error: 'رقم الهاتف غير صالح' });
    }

    const result = await lpService.handleFormSubmission(
      String(req.params.landingPageId),
      formData
    );

    // Track A/B conversion
    if (!result.duplicate) {
      const abTest = await lpService.getActiveABTest(String(req.params.landingPageId));
      if (abTest) {
        const convField =
          abTest.landingPageAId === String(req.params.landingPageId)
            ? 'conversionsA'
            : 'conversionsB';
        await prisma.aBTest.update({
          where: { id: abTest.id },
          data: { [convField]: { increment: 1 } },
        });
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[LP Submit] Error:', err);
    res.status(500).json({ success: false, error: 'حدث خطأ في معالجة الطلب' });
  }
});

export default router;
