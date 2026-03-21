import { prisma } from '../../../db';
import { decryptToken } from '../../../shared/utils/token-encryption';

const GENERATE_SYSTEM_PROMPT = `You are an expert landing page designer and developer.
Generate a complete, self-contained HTML landing page.

Requirements:
- Complete HTML5 document (<!DOCTYPE>, <html>, <head>, <body>)
- All CSS inline in <style> tags
- Mobile-responsive (mobile-first)
- NO external stylesheets, NO JavaScript (will be injected separately)
- Modern, clean design with excellent typography
- Conversion-optimized with clear CTA
- Include a lead capture form with fields as specified
- Use the provided product images via their URLs
- RTL support if Arabic content
- Return ONLY the HTML code, no explanations

Form Requirements:
- Each form field must have a unique "name" attribute
- Form must have id="lp-form"
- Submit button must have type="submit"
- Common field names: "name", "phone", "email", "address", "city", "notes"`;

const EDIT_SYSTEM_PROMPT = `You are editing an existing HTML landing page.
The user will request changes in natural language.

Rules:
- Apply ONLY the requested changes
- Preserve all existing structure and styling not mentioned
- Keep the form id="lp-form" and all field names intact
- Return the COMPLETE modified HTML (not just the changed parts)
- NO JavaScript, NO external resources
- Return ONLY HTML, no explanations`;

function cleanHtml(raw: string): string {
  let html = raw;
  // Strip markdown code fences
  html = html.replace(/```html\n?/g, '').replace(/```\n?/g, '');
  // Strip any script tags
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  return html.trim();
}

async function getProviderKey(provider: string): Promise<string> {
  const aiProvider = await prisma.aiProvider.findUnique({ where: { provider } });
  if (!aiProvider) throw new Error(`AI provider "${provider}" not configured`);
  return decryptToken(aiProvider.apiKey);
}

async function callAnthropic(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} - ${err}`);
  }

  const data = await res.json() as any;
  return cleanHtml(data.content[0].text);
}

async function callOpenAI(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 8096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} - ${err}`);
  }

  const data = await res.json() as any;
  return cleanHtml(data.choices[0].message.content);
}

async function callGoogle(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: 8096 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google AI API error: ${res.status} - ${err}`);
  }

  const data = await res.json() as any;
  return cleanHtml(data.candidates[0].content.parts[0].text);
}

export async function generateLandingPage(opts: {
  provider: string;
  model: string;
  productName: string;
  productDescription?: string;
  productPrice?: string;
  productImages?: string[];
  storeName: string;
  language: string;
  instructions?: string;
  formFields?: string[];
  productContext?: string;
  formFieldSpecs?: Array<{ fieldName: string; label: string; type: string; required: boolean }>;
  paymentMethods?: string[];
}): Promise<string> {
  const apiKey = await getProviderKey(opts.provider);

  // Build system prompt with enhancements
  let systemPrompt = GENERATE_SYSTEM_PROMPT;

  if (opts.productContext) {
    systemPrompt += `\n\n## Complete Product Data\n${opts.productContext}\nUse your judgment to select the most persuasive information.`;
  }

  if (opts.formFieldSpecs?.length) {
    systemPrompt += `\n\n## Form Fields\nBuild the HTML form with these exact fields:`;
    for (const spec of opts.formFieldSpecs) {
      systemPrompt += `\n- name="${spec.fieldName}" label="${spec.label}" type="${spec.type}" required=${spec.required}`;
    }
  }

  if (opts.paymentMethods?.includes('cod')) {
    systemPrompt += `\n\nAdd payment method section showing 'الدفع عند الاستلام' (Cash on Delivery)`;
  }

  // Build user prompt
  let userPrompt = `Product: ${opts.productName}
Price: ${opts.productPrice || 'Not specified'}
Description: ${opts.productDescription || 'Not specified'}
Store: ${opts.storeName}
Language: ${opts.language === 'ar' ? 'Arabic (RTL)' : 'English'}

Instructions: ${opts.instructions || 'Create a professional, conversion-optimized landing page'}

Form fields needed: ${(opts.formFields || ['name', 'phone']).join(', ')}`;

  // Add product images if provided
  if (opts.productImages?.length) {
    for (const imgUrl of opts.productImages) {
      userPrompt += `\nProduct image URL: ${imgUrl}`;
    }
  }

  // Route to the correct provider
  switch (opts.provider) {
    case 'anthropic':
      return callAnthropic(apiKey, opts.model, systemPrompt, userPrompt);
    case 'openai':
      return callOpenAI(apiKey, opts.model, systemPrompt, userPrompt);
    case 'google':
      return callGoogle(apiKey, opts.model, systemPrompt, userPrompt);
    default:
      throw new Error(`Unsupported AI provider: ${opts.provider}`);
  }
}

export async function editLandingPage(params: {
  currentHtml: string;
  editRequest: string;
}) {
  // Default to anthropic provider for editing
  const apiKey = await getProviderKey('anthropic');

  const userPrompt = `Current HTML:\n${params.currentHtml}\n\nRequested change: ${params.editRequest}`;

  return callAnthropic(apiKey, 'claude-sonnet-4-20250514', EDIT_SYSTEM_PROMPT, userPrompt);
}
