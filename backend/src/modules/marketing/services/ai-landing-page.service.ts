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

export async function generateLandingPage(params: {
  productName: string;
  productDescription?: string;
  productPrice?: string;
  productImages?: string[];
  storeName: string;
  language: string;
  instructions?: string;
  formFields: string[];
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set.');

  const userContent: any[] = [
    {
      type: 'text',
      text: `Product: ${params.productName}
Price: ${params.productPrice || 'Not specified'}
Description: ${params.productDescription || 'Not specified'}
Store: ${params.storeName}
Language: ${params.language === 'ar' ? 'Arabic (RTL)' : 'English'}

Instructions: ${params.instructions || 'Create a professional, conversion-optimized landing page'}

Form fields needed: ${params.formFields.join(', ')}`,
    },
  ];

  // Add product images if provided
  if (params.productImages?.length) {
    for (const imgUrl of params.productImages) {
      userContent[0].text += `\nProduct image URL: ${imgUrl}`;
    }
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8096,
      system: GENERATE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${err}`);
  }

  const result: any = await response.json();
  const rawHtml = result.content?.[0]?.text || '';
  return cleanHtml(rawHtml);
}

export async function editLandingPage(params: {
  currentHtml: string;
  editRequest: string;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set.');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8096,
      system: EDIT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Current HTML:\n${params.currentHtml}\n\nRequested change: ${params.editRequest}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${err}`);
  }

  const result: any = await response.json();
  const rawHtml = result.content?.[0]?.text || '';
  return cleanHtml(rawHtml);
}
