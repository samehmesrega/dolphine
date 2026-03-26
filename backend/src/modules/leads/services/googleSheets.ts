/**
 * خدمة Google Sheets API
 * تستخدم API Key للوصول للشيتات المشاركة علنياً
 */

import { prisma } from '../../../db';
import { decryptToken } from '../../../shared/utils/token-encryption';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/** جلب API Key من إعدادات التكامل (مع فك التشفير) */
export async function getGoogleApiKey(): Promise<string | null> {
  const setting = await prisma.integrationSetting.findUnique({
    where: { key: 'google_sheets_api_key' },
  });
  if (!setting?.value) return null;
  try {
    return decryptToken(setting.value);
  } catch {
    // Legacy plaintext key — return as-is
    return setting.value;
  }
}

/** استخراج spreadsheetId من رابط Google Sheets */
export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/** قراءة أسماء الأعمدة (الصف الأول) */
export async function readHeaders(spreadsheetId: string, sheetName: string): Promise<string[]> {
  const apiKey = await getGoogleApiKey();
  if (!apiKey) throw new Error('مفتاح Google Sheets API غير مُعد');

  const range = encodeURIComponent(`${sheetName}!1:1`);
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}?key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    console.error(`[Google Sheets API] ${res.status} response:`, text);
    if (res.status === 403) {
      // تحليل رسالة الخطأ من Google لتوضيح السبب
      const lower = text.toLowerCase();
      if (lower.includes('sheets api has not been enabled') || lower.includes('sheets api') && lower.includes('disabled')) {
        throw new Error('Google Sheets API غير مفعّل. فعّله من Google Cloud Console → APIs & Services → Enable APIs');
      }
      if (lower.includes('api key not valid') || lower.includes('api_key_invalid')) {
        throw new Error('مفتاح API غير صالح. تأكد من صحة المفتاح');
      }
      throw new Error('لا يمكن الوصول للشيت. تأكد من مشاركته كـ "أي شخص لديه الرابط يمكنه العرض" وأن Google Sheets API مفعّل');
    }
    if (res.status === 404) throw new Error('الشيت غير موجود. تأكد من صحة الرابط واسم الورقة');
    if (res.status === 400) throw new Error(`خطأ في الطلب: تأكد من صحة اسم الورقة. ${text}`);
    throw new Error(`خطأ Google Sheets API: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { values?: string[][] };
  return (data.values?.[0] ?? []) as string[];
}

/** قراءة صفوف البيانات بدءاً من صف معين */
export async function readRows(
  spreadsheetId: string,
  sheetName: string,
  startRow: number = 2,
): Promise<{ headers: string[]; rows: string[][] }> {
  const apiKey = await getGoogleApiKey();
  if (!apiKey) throw new Error('مفتاح Google Sheets API غير مُعد');

  const headers = await readHeaders(spreadsheetId, sheetName);

  // First check how many rows the sheet has — avoid requesting beyond grid limits
  const metaUrl = `${SHEETS_API_BASE}/${spreadsheetId}?fields=sheets(properties(title,gridProperties))&key=${apiKey}`;
  const metaRes = await fetch(metaUrl);
  if (metaRes.ok) {
    const meta = (await metaRes.json()) as { sheets?: Array<{ properties: { title: string; gridProperties: { rowCount: number } } }> };
    const sheet = meta.sheets?.find(s => s.properties.title === sheetName);
    if (sheet) {
      const maxRows = sheet.properties.gridProperties.rowCount;
      if (startRow > maxRows) {
        // No new rows to read
        return { headers, rows: [] };
      }
    }
  }

  const range = encodeURIComponent(`${sheetName}!${startRow}:${startRow + 50000}`);
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}?key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`خطأ Google Sheets API: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { values?: string[][] };
  return { headers, rows: (data.values ?? []) as string[][] };
}
