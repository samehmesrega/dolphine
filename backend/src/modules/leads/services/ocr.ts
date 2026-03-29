/**
 * OCR Service — Google Vision API TEXT_DETECTION wrapper
 * Extracts text from transfer receipt images and parses structured data.
 */

import { getGoogleApiKey } from './googleSheets';

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';

/**
 * Extract full text from an image buffer using Google Vision API.
 * Returns null if Vision API key is not configured or call fails.
 */
export async function extractTextFromImage(imageBuffer: Buffer): Promise<string | null> {
  const apiKey = await getGoogleApiKey();
  if (!apiKey) {
    console.warn('[OCR] No Google API key configured — skipping OCR');
    return null;
  }

  try {
    const base64Image = imageBuffer.toString('base64');

    const response = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: 'TEXT_DETECTION' }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[OCR] Vision API error ${response.status}:`, errText);
      return null;
    }

    const data = await response.json() as {
      responses?: Array<{
        fullTextAnnotation?: { text?: string };
        textAnnotations?: Array<{ description?: string }>;
        error?: { message?: string };
      }>;
    };

    const firstResponse = data.responses?.[0];
    if (firstResponse?.error) {
      console.error('[OCR] Vision API returned error:', firstResponse.error.message);
      return null;
    }

    // fullTextAnnotation.text contains the full extracted text
    const fullText = firstResponse?.fullTextAnnotation?.text
      || firstResponse?.textAnnotations?.[0]?.description
      || null;

    return fullText || null;
  } catch (err) {
    console.error('[OCR] Failed to call Vision API:', err instanceof Error ? err.message : err);
    return null;
  }
}

export type ParsedReceipt = {
  amount: number | null;
  reference: string | null;
  date: string | null;
  time: string | null;
  recipientPhone: string | null;
  recipientName: string | null;
};

// Map Arabic-Indic digits to Western digits
function arabicToWestern(str: string): string {
  return str
    .replace(/[٠]/g, '0')
    .replace(/[١]/g, '1')
    .replace(/[٢]/g, '2')
    .replace(/[٣]/g, '3')
    .replace(/[٤]/g, '4')
    .replace(/[٥]/g, '5')
    .replace(/[٦]/g, '6')
    .replace(/[٧]/g, '7')
    .replace(/[٨]/g, '8')
    .replace(/[٩]/g, '9');
}

/**
 * Parse transfer receipt text and extract structured data.
 */
export function parseTransferReceipt(fullText: string): ParsedReceipt {
  // Normalize: convert Arabic-Indic digits, normalize whitespace
  const normalized = arabicToWestern(fullText);
  const lines = normalized.split(/\n/);

  const result: ParsedReceipt = {
    amount: null,
    reference: null,
    date: null,
    time: null,
    recipientPhone: null,
    recipientName: null,
  };

  // --- Amount ---
  // Look for patterns like "1,038 EGP", "١٬٠٣٨", "المبلغ: 150", "EGP 500", "جنيه 1000"
  // Also handle "Amount: 1,500.00" or just big numbers near currency keywords
  const amountPatterns = [
    // "المبلغ: 1,038.00" or "المبلغ 150"
    /(?:المبلغ|المبلغ المحول|Amount|Value|القيمة|قيمة التحويل)\s*[:：]?\s*([\d,،٬.]+)/i,
    // "1,038 EGP" or "1038 جنيه" or "EGP 1,038"
    /(?:EGP|جنيه|ج\.م|LE)\s*([\d,،٬.]+)/i,
    /([\d,،٬.]+)\s*(?:EGP|جنيه|ج\.م|LE)/i,
    // "تم تحويل 500" or "تم إرسال 1,200"
    /(?:تم تحويل|تم إرسال|تم ارسال)\s*([\d,،٬.]+)/i,
  ];

  for (const pattern of amountPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const cleaned = match[1].replace(/[,،٬\s]/g, '');
      const val = parseFloat(cleaned);
      if (!isNaN(val) && val > 0) {
        result.amount = val;
        break;
      }
    }
  }

  // Fallback: find the largest number that looks like an amount (3-6 digits, possibly with comma formatting)
  if (!result.amount) {
    const allNumbers = normalized.match(/\b([\d,،٬]{3,10}(?:\.\d{1,2})?)\b/g);
    if (allNumbers) {
      let maxVal = 0;
      for (const numStr of allNumbers) {
        const cleaned = numStr.replace(/[,،٬\s]/g, '');
        const val = parseFloat(cleaned);
        // Reasonable transfer amount range
        if (!isNaN(val) && val >= 10 && val <= 100000 && val > maxVal) {
          maxVal = val;
        }
      }
      if (maxVal > 0) {
        result.amount = maxVal;
      }
    }
  }

  // --- Reference number --- (10-14 digit numbers)
  const refPatterns = [
    /(?:رقم (?:المرجع|العملية|التحويل|المعاملة)|(?:Ref|Reference|Transaction)\s*(?:No|Number|ID)?)\s*[:：]?\s*(\d{8,20})/i,
    /\b(\d{10,14})\b/,
  ];
  for (const pattern of refPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      result.reference = match[1];
      break;
    }
  }

  // --- Date ---
  const datePatterns = [
    // "3/25/2026", "25/3/2026", "2026/3/25", "2026-03-25"
    /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/,
    /(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/,
  ];
  for (const pattern of datePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      result.date = match[0];
      break;
    }
  }

  // --- Time ---
  const timeMatch = normalized.match(/\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM|ص|م))?)\b/i);
  if (timeMatch) {
    result.time = timeMatch[1];
  }

  // --- Recipient phone --- Egyptian mobile numbers (01x...)
  const phonePatterns = [
    /(?:إلى|الى|To|Recipient|المستلم|رقم المحفظة|Wallet)\s*[:：]?\s*(01[0-9]\d{8})/i,
    /\b(01[0125]\d{8})\b/,
  ];
  for (const pattern of phonePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      result.recipientPhone = match[1];
      break;
    }
  }

  // --- Recipient name ---
  const namePatterns = [
    /(?:إلى|الى|To|Recipient|المستلم|اسم المستلم)\s*[:：]?\s*([^\n\d]{2,40})/i,
  ];
  for (const pattern of namePatterns) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) {
        const name = match[1].trim();
        // Filter out phone numbers and pure digits
        if (name && !/^\d+$/.test(name) && !/^01\d{9}$/.test(name)) {
          result.recipientName = name;
          break;
        }
      }
    }
    if (result.recipientName) break;
  }

  return result;
}
