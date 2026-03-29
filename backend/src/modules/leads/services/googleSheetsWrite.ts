/**
 * كتابة بيانات التواصل على Google Sheets
 * يتطلب Google Service Account مشارك على الشيت كـ Editor
 * Env var: GOOGLE_SERVICE_ACCOUNT_KEY (JSON string أو base64)
 */

import { prisma } from '../../../db';
import { normalizePhone } from '../../../shared/utils/phone';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri: string;
}

let cachedToken: { token: string; expires: number } | null = null;

async function getServiceAccountCredentials(): Promise<ServiceAccountCredentials | null> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    // Try JSON first, then base64
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
    const creds = JSON.parse(json);
    if (creds.client_email && creds.private_key) return creds;
    return null;
  } catch {
    return null;
  }
}

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token;

  const creds = await getServiceAccountCredentials();
  if (!creds) return null;

  // Create JWT
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: creds.token_uri,
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const { createSign } = await import('crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(creds.private_key, 'base64url');

  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch(creds.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    console.error('[Sheets Write] Token exchange failed:', await res.text());
    return null;
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

/**
 * يبحث عن الليد في الشيت بالموبايل ويحدّث خلية notes
 */
export async function syncCommunicationToSheet(
  leadId: string,
  commType: string,
  commNotes: string | null,
  salesName: string,
): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    console.log('[Sheets Write] No service account configured — skipping sheet sync');
    return;
  }

  // Find the lead
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { phoneNormalized: true, phone: true },
  });
  if (!lead?.phoneNormalized) return;

  // Find active sheet connections
  const connections = await prisma.sheetConnection.findMany({
    where: { isActive: true },
    select: { spreadsheetId: true, sheetName: true, fieldMapping: true },
  });

  if (connections.length === 0) return;

  const typeLabels: Record<string, string> = {
    call: 'مكالمة',
    whatsapp: 'واتساب',
    email: 'إيميل',
    physical: 'زيارة',
  };

  const now = new Date();
  const dateStr = `${now.getDate()}/${now.getMonth() + 1} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const noteText = `[${dateStr}] ${typeLabels[commType] || commType} — ${salesName}${commNotes ? ` — "${commNotes}"` : ''}`;

  for (const conn of connections) {
    try {
      const mapping = (conn.fieldMapping ?? {}) as { phone?: string; [k: string]: unknown };
      const phoneColumn = mapping.phone;
      if (!phoneColumn) continue;

      // Read the sheet to find the row
      const range = encodeURIComponent(`${conn.sheetName}!A1:ZZ`);
      const readUrl = `${SHEETS_API}/${conn.spreadsheetId}/values/${range}?access_token=${token}`;
      const readRes = await fetch(readUrl);
      if (!readRes.ok) continue;

      const sheetData = await readRes.json() as { values?: string[][] };
      const rows = sheetData.values || [];
      if (rows.length < 2) continue;

      const headers = rows[0];
      const phoneColIndex = headers.indexOf(phoneColumn);
      if (phoneColIndex === -1) continue;

      // Find "Notes" or "notes" column, or create one
      let notesColIndex = headers.findIndex(h =>
        h.toLowerCase() === 'notes' || h === 'ملاحظات' || h.toLowerCase() === 'dolphin notes'
      );

      // If no notes column, use the last column + 1
      if (notesColIndex === -1) {
        notesColIndex = headers.length;
        // Add header
        const colLetter = String.fromCharCode(65 + notesColIndex);
        const headerRange = encodeURIComponent(`${conn.sheetName}!${colLetter}1`);
        await fetch(`${SHEETS_API}/${conn.spreadsheetId}/values/${headerRange}?valueInputOption=RAW&access_token=${token}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [['Dolphin Notes']] }),
        });
      }

      // Find the row by phone
      let targetRow = -1;
      for (let i = 1; i < rows.length; i++) {
        const cellPhone = rows[i]?.[phoneColIndex] || '';
        const normalizedCell = normalizePhone(cellPhone);
        if (normalizedCell === lead.phoneNormalized || cellPhone === lead.phone) {
          targetRow = i + 1; // 1-indexed
          break;
        }
      }

      if (targetRow === -1) continue;

      // Get existing notes
      const existingNotes = rows[targetRow - 1]?.[notesColIndex] || '';
      const updatedNotes = existingNotes ? `${noteText}\n${existingNotes}` : noteText;

      // Write the updated notes
      const colLetter = notesColIndex < 26
        ? String.fromCharCode(65 + notesColIndex)
        : String.fromCharCode(64 + Math.floor(notesColIndex / 26)) + String.fromCharCode(65 + (notesColIndex % 26));
      const writeRange = encodeURIComponent(`${conn.sheetName}!${colLetter}${targetRow}`);
      await fetch(`${SHEETS_API}/${conn.spreadsheetId}/values/${writeRange}?valueInputOption=RAW&access_token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[updatedNotes]] }),
      });

      console.log(`[Sheets Write] Updated notes for lead ${lead.phone} in sheet ${conn.sheetName} row ${targetRow}`);
    } catch (err) {
      console.error(`[Sheets Write] Failed for connection ${conn.spreadsheetId}:`, err);
    }
  }
}
