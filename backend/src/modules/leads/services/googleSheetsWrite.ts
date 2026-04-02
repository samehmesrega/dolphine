/**
 * كتابة بيانات الليد على Google Sheets
 * يتطلب Google Service Account مشارك على الشيت كـ Editor
 * Env var: GOOGLE_SERVICE_ACCOUNT_KEY (JSON string أو base64)
 *
 * الأعمدة الثابتة:
 *   T → السيلز المسؤول (بأسماء الشيت من userMapping)
 *   U → حالة الليد (بأسماء الشيت من statusMapping)
 *   V → ملاحظات التواصل (تتراكم)
 *   X → قيمة الطلب
 */

import { prisma } from '../../../db';
import { normalizePhone } from '../../../shared/utils/phone';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri: string;
}

interface FieldMapping {
  phone?: string;
  userMapping?: Record<string, string>;   // sheetName → dolphinUserId
  statusMapping?: Record<string, string>; // sheetStatus → dolphinSlug
  [k: string]: unknown;
}

let cachedToken: { token: string; expires: number } | null = null;

async function getServiceAccountCredentials(): Promise<ServiceAccountCredentials | null> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
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

// ─── Column indices (0-based) ───
const COL_T = 19; // السيلز
const COL_U = 20; // الحالة
const COL_V = 21; // ملاحظات التواصل
const COL_X = 23; // قيمة الطلب

function colLetter(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  return String.fromCharCode(64 + Math.floor(index / 26)) + String.fromCharCode(65 + (index % 26));
}

/** عكس userMapping: من dolphinUserId → اسم المودريتور على الشيت */
function reverseUserMapping(mapping: FieldMapping): Record<string, string> {
  const reversed: Record<string, string> = {};
  if (mapping.userMapping) {
    for (const [sheetName, userId] of Object.entries(mapping.userMapping)) {
      // لو فيه أكتر من اسم لنفس الـ userId، الأول يكسب
      if (!reversed[userId]) reversed[userId] = sheetName;
    }
  }
  return reversed;
}

/** عكس statusMapping: من dolphinSlug → اسم الحالة على الشيت */
function reverseStatusMapping(mapping: FieldMapping): Record<string, string> {
  const reversed: Record<string, string> = {};
  if (mapping.statusMapping) {
    for (const [sheetStatus, slug] of Object.entries(mapping.statusMapping)) {
      // لو فيه أكتر من اسم لنفس الـ slug، الأول يكسب
      if (!reversed[slug]) reversed[slug] = sheetStatus;
    }
  }
  return reversed;
}

const COMM_TYPE_LABELS: Record<string, string> = {
  call: 'مكالمة', whatsapp: 'واتساب', email: 'إيميل', physical: 'زيارة',
};

function formatCommNote(_type: string, notes: string | null, _userName: string, _date?: Date): string {
  return notes?.trim() || '';
}

/**
 * مزامنة بيانات الليد للشيت — يُستدعى عند:
 *   1. تسجيل تواصل جديد
 *   2. تغيير حالة الليد
 *   3. إنشاء / تعديل طلب
 */
export async function syncLeadDataToSheet(
  leadId: string,
  commInfo?: { type: string; notes: string | null; salesName: string },
): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    console.log('[Sheets Write] No service account configured — skipping sheet sync');
    return;
  }

  // جلب بيانات الليد
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      status: true,
      assignedTo: { select: { id: true, name: true } },
      orders: {
        where: { deletedAt: null },
        include: { orderItems: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!lead?.phoneNormalized) return;

  // الاتصالات النشطة
  const connections = await prisma.sheetConnection.findMany({
    where: { isActive: true },
    select: { spreadsheetId: true, sheetName: true, fieldMapping: true },
  });
  if (connections.length === 0) return;

  // قيمة الطلب
  let orderValue = '';
  if (lead.orders.length > 0) {
    const order = lead.orders[0];
    const total = order.orderItems.reduce(
      (sum: number, item: { price: unknown; quantity: number }) => sum + Number(item.price) * item.quantity, 0,
    );
    const discount = Number(order.discount) || 0;
    orderValue = String(total - discount);
  }

  // ملاحظة التواصل
  let commNote = '';
  if (commInfo) {
    commNote = formatCommNote(commInfo.type, commInfo.notes, commInfo.salesName);
  }

  for (const conn of connections) {
    try {
      const mapping = (conn.fieldMapping ?? {}) as FieldMapping;
      const phoneColumn = mapping.phone;
      if (!phoneColumn) continue;

      // عكس الـ mappings للكتابة بأسماء الشيت
      const userIdToSheetName = reverseUserMapping(mapping);
      const slugToSheetStatus = reverseStatusMapping(mapping);

      const sheetSalesName = (lead.assignedTo?.id && userIdToSheetName[lead.assignedTo.id])
        || lead.assignedTo?.name || '—';
      const sheetStatusName = (lead.status?.slug && slugToSheetStatus[lead.status.slug])
        || lead.status?.name || '—';

      // قراءة الشيت
      const range = encodeURIComponent(`${conn.sheetName}!A1:ZZ`);
      const readUrl = `${SHEETS_API}/${conn.spreadsheetId}/values/${range}?access_token=${token}`;
      const readRes = await fetch(readUrl);
      if (!readRes.ok) {
        console.error(`[Sheets Write] Read failed ${conn.spreadsheetId}: ${readRes.status}`);
        continue;
      }

      const sheetData = await readRes.json() as { values?: string[][] };
      const rows = sheetData.values || [];
      if (rows.length < 2) continue;

      const headers = rows[0];
      const phoneColIndex = headers.indexOf(phoneColumn);
      if (phoneColIndex === -1) continue;

      // البحث عن الصف بالموبايل
      // لو فيه صفوف مكررة (نفس الموبايل)، نحاول نلاقي الصف اللي مكتوب فيه
      // نفس اسم السيلز المعيّن أو الصف الفاضي (مش متكتب فيه سيلز لسه)
      let targetRow = -1;
      let fallbackRow = -1;
      for (let i = 1; i < rows.length; i++) {
        const cellPhone = rows[i]?.[phoneColIndex] || '';
        const normalizedCell = normalizePhone(cellPhone);
        if (normalizedCell === lead.phoneNormalized || cellPhone === lead.phone) {
          const cellSales = rows[i]?.[COL_T] || '';
          // Perfect match: same phone + same sales name (or empty sales column)
          if (!cellSales || cellSales === sheetSalesName) {
            targetRow = i + 1;
            break;
          }
          // Fallback: first phone match (in case no sales match found)
          if (fallbackRow === -1) fallbackRow = i + 1;
        }
      }
      if (targetRow === -1) targetRow = fallbackRow;
      if (targetRow === -1) continue;

      // تجهيز ملاحظات التواصل (تراكمية)
      let notesValue = '';
      if (commNote) {
        const existingNotes = rows[targetRow - 1]?.[COL_V] || '';
        notesValue = existingNotes ? `${commNote}\n${existingNotes}` : commNote;
      }

      // تحديث الأعمدة دفعة واحدة
      const updates: Array<{ range: string; values: string[][] }> = [
        { range: `${conn.sheetName}!${colLetter(COL_T)}${targetRow}`, values: [[sheetSalesName]] },
        { range: `${conn.sheetName}!${colLetter(COL_U)}${targetRow}`, values: [[sheetStatusName]] },
      ];
      if (commNote) {
        updates.push({ range: `${conn.sheetName}!${colLetter(COL_V)}${targetRow}`, values: [[notesValue]] });
      }
      if (orderValue) {
        updates.push({ range: `${conn.sheetName}!${colLetter(COL_X)}${targetRow}`, values: [[orderValue]] });
      }

      const batchUrl = `${SHEETS_API}/${conn.spreadsheetId}/values:batchUpdate?access_token=${token}`;
      const batchRes = await fetch(batchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'RAW', data: updates }),
      });

      if (!batchRes.ok) {
        console.error(`[Sheets Write] Batch update failed ${conn.spreadsheetId}: ${batchRes.status}`, await batchRes.text());
        continue;
      }

      console.log(`[Sheets Write] Synced lead ${lead.phone} → row ${targetRow} (T=${sheetSalesName}, U=${sheetStatusName}${orderValue ? `, X=${orderValue}` : ''})`);
    } catch (err) {
      console.error(`[Sheets Write] Failed for connection ${conn.spreadsheetId}:`, err);
    }
  }
}

/** Backward-compatible alias — يُستدعى من leads.ts عند تسجيل تواصل */
export async function syncCommunicationToSheet(
  leadId: string,
  commType: string,
  commNotes: string | null,
  salesName: string,
): Promise<void> {
  return syncLeadDataToSheet(leadId, { type: commType, notes: commNotes, salesName });
}

/**
 * Backfill — مزامنة بيانات دولفين (T,U,V,X) للشيت لصفوف موجودة
 * بيقرأ الشيت من startRow، بيطابق كل صف بالفون مع ليد في دولفين،
 * وبيكتب السيلز والحالة وآخر تواصل وقيمة الطلب — بأسماء الشيت.
 */
export async function backfillDolphinDataToSheet(
  spreadsheetId: string,
  sheetName: string,
  phoneColumnName: string,
  startRow: number,
  maxRows?: number,
  fieldMapping?: FieldMapping,
  onProgress?: (done: number, total: number) => void,
): Promise<{ synced: number; notFound: number; skipped: number; total: number }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Google Service Account غير مُعد');

  // عكس الـ mappings
  const mapping = fieldMapping ?? {};
  const userIdToSheetName = reverseUserMapping(mapping);
  const slugToSheetStatus = reverseStatusMapping(mapping);

  // قراءة الشيت
  const range = encodeURIComponent(`${sheetName}!A1:ZZ`);
  const readUrl = `${SHEETS_API}/${spreadsheetId}/values/${range}?access_token=${token}`;
  const readRes = await fetch(readUrl);
  if (!readRes.ok) throw new Error(`فشل قراءة الشيت: ${readRes.status}`);

  const sheetData = await readRes.json() as { values?: string[][] };
  const rows = sheetData.values || [];
  if (rows.length < 2) throw new Error('الشيت فارغ');

  const headers = rows[0];
  const phoneColIndex = headers.indexOf(phoneColumnName);
  if (phoneColIndex === -1) throw new Error(`عمود "${phoneColumnName}" غير موجود في الشيت`);

  // الصفوف المستهدفة (startRow is 1-indexed, row 1 = headers)
  const dataStartIndex = startRow - 1; // convert to 0-based array index
  if (dataStartIndex < 1 || dataStartIndex >= rows.length) {
    return { synced: 0, notFound: 0, skipped: 0, total: 0 };
  }

  const allTargetRows = rows.slice(dataStartIndex);
  const targetRows = maxRows ? allTargetRows.slice(0, maxRows) : allTargetRows;
  let synced = 0, notFound = 0, skipped = 0;

  // تجميع التحديثات في batches
  const BATCH_SIZE = 50;
  let batchUpdates: Array<{ range: string; values: string[][] }> = [];

  for (let i = 0; i < targetRows.length; i++) {
    const row = targetRows[i];
    const sheetRowNumber = dataStartIndex + 1 + i; // 1-indexed row in sheet

    if (!row || row.every((cell) => !cell?.trim())) { skipped++; continue; }

    const phoneRaw = (row[phoneColIndex] || '').trim();
    if (!phoneRaw || phoneRaw.length < 6) { skipped++; continue; }

    const phoneNorm = normalizePhone(phoneRaw);
    if (!phoneNorm) { skipped++; continue; }

    // البحث عن الليد في دولفين بالفون
    const lead = await prisma.lead.findFirst({
      where: { phoneNormalized: phoneNorm, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        status: true,
        assignedTo: { select: { id: true, name: true } },
        orders: {
          where: { deletedAt: null },
          include: { orderItems: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        communications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!lead) { notFound++; continue; }

    // السيلز — بأسماء الشيت
    const sheetSalesName = (lead.assignedTo?.id && userIdToSheetName[lead.assignedTo.id])
      || lead.assignedTo?.name || '—';

    // الحالة — بأسماء الشيت
    const sheetStatusName = (lead.status?.slug && slugToSheetStatus[lead.status.slug])
      || lead.status?.name || '—';

    // قيمة الطلب
    let orderValue = '';
    if (lead.orders.length > 0) {
      const order = lead.orders[0];
      const total = order.orderItems.reduce(
        (sum: number, item: { price: unknown; quantity: number }) => sum + Number(item.price) * item.quantity, 0,
      );
      const discount = Number(order.discount) || 0;
      orderValue = String(total - discount);
    }

    // آخر تواصل
    let lastCommNote = '';
    if (lead.communications.length > 0) {
      const comm = lead.communications[0];
      lastCommNote = formatCommNote(
        comm.type,
        comm.notes,
        comm.user?.name || '—',
        comm.createdAt,
      );
    }

    // إضافة التحديثات
    batchUpdates.push(
      { range: `${sheetName}!${colLetter(COL_T)}${sheetRowNumber}`, values: [[sheetSalesName]] },
      { range: `${sheetName}!${colLetter(COL_U)}${sheetRowNumber}`, values: [[sheetStatusName]] },
    );
    if (lastCommNote) {
      batchUpdates.push({ range: `${sheetName}!${colLetter(COL_V)}${sheetRowNumber}`, values: [[lastCommNote]] });
    }
    if (orderValue) {
      batchUpdates.push({ range: `${sheetName}!${colLetter(COL_X)}${sheetRowNumber}`, values: [[orderValue]] });
    }
    synced++;

    // إرسال الـ batch لما يمتلي
    if (batchUpdates.length >= BATCH_SIZE * 4) {
      const batchUrl = `${SHEETS_API}/${spreadsheetId}/values:batchUpdate?access_token=${token}`;
      const batchRes = await fetch(batchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'RAW', data: batchUpdates }),
      });
      if (!batchRes.ok) {
        console.error(`[Backfill] Batch failed: ${batchRes.status}`, await batchRes.text());
      }
      batchUpdates = [];
      if (onProgress) onProgress(i + 1, targetRows.length);
    }
  }

  // إرسال آخر batch
  if (batchUpdates.length > 0) {
    const batchUrl = `${SHEETS_API}/${spreadsheetId}/values:batchUpdate?access_token=${token}`;
    const batchRes = await fetch(batchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'RAW', data: batchUpdates }),
    });
    if (!batchRes.ok) {
      console.error(`[Backfill] Final batch failed: ${batchRes.status}`, await batchRes.text());
    }
  }

  console.log(`[Backfill] Done: ${synced} synced, ${notFound} not found, ${skipped} skipped out of ${targetRows.length}`);
  return { synced, notFound, skipped, total: targetRows.length };
}
