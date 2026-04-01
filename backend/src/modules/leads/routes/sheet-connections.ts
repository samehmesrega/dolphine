/**
 * إدارة اتصالات Google Sheets
 * CRUD + استيراد الليدز من الشيتات
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../../db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import { extractSpreadsheetId, readHeaders, readRows } from '../services/googleSheets';
import { normalizePhone } from '../../../shared/utils/phone';
import { getNextAssignedUserId } from '../services/roundRobin';
import { encryptToken, decryptToken } from '../../../shared/utils/token-encryption';
import { backfillDolphinDataToSheet } from '../services/googleSheetsWrite';

const router = Router();

const fieldMappingSchema = z.object({
  name:         z.string().optional(),
  phone:        z.string().optional(),
  email:        z.string().optional(),
  address:      z.string().optional(),
  createdAt:    z.string().optional(),
  statusColumn: z.string().optional(),
  statusMapping: z.record(z.string(), z.string()).optional(),
  userColumn:   z.string().optional(),
  userMapping:  z.record(z.string(), z.string()).optional(),
  customFields: z.array(z.object({
    label: z.string().min(1),
    field: z.string().min(1),
    type:  z.enum(['customer', 'product']).default('customer').optional(),
  })).optional(),
}).optional();

const createSchema = z.object({
  name:           z.string().min(1, 'الاسم مطلوب'),
  spreadsheetUrl: z.string().min(1, 'رابط الشيت مطلوب'),
  sheetName:      z.string().optional(),
  productId:      z.string().uuid().optional(),
});

// ──── Google API Key Config ────

router.get('/google-config', async (_req: Request, res: Response) => {
  try {
    const setting = await prisma.integrationSetting.findUnique({
      where: { key: 'google_sheets_api_key' },
    });
    let apiKeyMasked: string | null = null;
    if (setting?.value) {
      try {
        const decrypted = decryptToken(setting.value);
        apiKeyMasked = decrypted.slice(0, 6) + '****';
      } catch {
        // Legacy plaintext key — mask it directly
        apiKeyMasked = setting.value.slice(0, 6) + '****';
      }
    }
    res.json({
      configured: !!setting?.value,
      apiKeyMasked,
    });
  } catch (err) {
    console.error('Google config read error:', err);
    res.status(500).json({ error: 'خطأ في قراءة الإعدادات' });
  }
});

router.post('/google-config', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body as { apiKey?: string };
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      res.status(400).json({ error: 'مفتاح API غير صالح' });
      return;
    }
    const encrypted = encryptToken(apiKey.trim());
    await prisma.integrationSetting.upsert({
      where: { key: 'google_sheets_api_key' },
      update: { value: encrypted },
      create: { key: 'google_sheets_api_key', value: encrypted },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Google config save error:', err);
    res.status(500).json({ error: 'خطأ في حفظ الإعدادات' });
  }
});

// ──── Sheet Connections CRUD ────

// قائمة الاتصالات
router.get('/', async (_req: Request, res: Response) => {
  try {
    const connections = await prisma.sheetConnection.findMany({
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { id: true, name: true } } },
    });
    res.json({ connections });
  } catch (err) {
    console.error('Sheet connections list error:', err);
    res.status(500).json({ error: 'خطأ في تحميل الاتصالات' });
  }
});

// إنشاء اتصال جديد
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
      return;
    }
    const spreadsheetId = extractSpreadsheetId(parsed.data.spreadsheetUrl);
    if (!spreadsheetId) {
      res.status(400).json({ error: 'رابط Google Sheets غير صالح' });
      return;
    }
    const token = crypto.randomBytes(24).toString('hex');
    const connection = await prisma.sheetConnection.create({
      data: {
        name: parsed.data.name,
        spreadsheetId,
        sheetName: parsed.data.sheetName || 'Sheet1',
        token,
        productId: parsed.data.productId || null,
      },
    });
    res.status(201).json({ connection });
  } catch (err) {
    console.error('Create sheet connection error:', err);
    res.status(500).json({ error: 'خطأ في إنشاء الاتصال' });
  }
});

// جلب أسماء أعمدة الشيت
router.get('/:id/headers', async (req: Request, res: Response) => {
  try {
    const conn = await prisma.sheetConnection.findUnique({ where: { id: String(req.params.id) } });
    if (!conn) { res.status(404).json({ error: 'الاتصال غير موجود' }); return; }
    const headers = await readHeaders(conn.spreadsheetId, conn.sheetName);
    res.json({ headers });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في قراءة الشيت';
    console.error('Read headers error:', msg);
    res.status(400).json({ error: msg });
  }
});

// جلب القيم المميزة من عمود معين
router.get('/:id/column-values', async (req: Request, res: Response) => {
  try {
    const conn = await prisma.sheetConnection.findUnique({ where: { id: String(req.params.id) } });
    if (!conn) { res.status(404).json({ error: 'الاتصال غير موجود' }); return; }

    const column = String(req.query.column ?? '');
    if (!column) { res.status(400).json({ error: 'اسم العمود مطلوب' }); return; }

    const { headers, rows } = await readRows(conn.spreadsheetId, conn.sheetName, 2);
    const colIndex = headers.indexOf(column);
    if (colIndex < 0) { res.json({ values: [] }); return; }

    const distinctValues = [...new Set(
      rows.map(row => (row[colIndex] ?? '').trim()).filter(Boolean)
    )];

    res.json({ values: distinctValues });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في قراءة البيانات';
    console.error('Read column values error:', msg);
    res.status(400).json({ error: msg });
  }
});

// تحديث field mapping
router.patch('/:id/mapping', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const parsed = fieldMappingSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'بيانات غير صحيحة' }); return; }
    const existing = await prisma.sheetConnection.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'الاتصال غير موجود' }); return; }
    const connection = await prisma.sheetConnection.update({
      where: { id },
      data: { fieldMapping: (parsed.data ?? Prisma.JsonNull) as Prisma.InputJsonValue },
    });
    res.json({ connection });
  } catch (err) {
    console.error('Update sheet mapping error:', err);
    res.status(500).json({ error: 'خطأ في تحديث الـ mapping' });
  }
});

// تحديث اتصال (productId, sheetName, isActive)
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { productId, sheetName, isActive } = req.body as {
      productId?: string | null;
      sheetName?: string;
      isActive?: boolean;
    };
    const existing = await prisma.sheetConnection.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'الاتصال غير موجود' }); return; }

    const data: Record<string, unknown> = {};
    if (productId !== undefined) data.productId = productId || null;
    if (sheetName !== undefined) data.sheetName = sheetName;
    if (isActive !== undefined) data.isActive = isActive;

    const connection = await prisma.sheetConnection.update({
      where: { id },
      data,
      include: { product: { select: { id: true, name: true } } },
    });
    res.json({ connection });
  } catch (err) {
    console.error('Update sheet connection error:', err);
    res.status(500).json({ error: 'خطأ في تحديث الاتصال' });
  }
});

// حذف اتصال
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.sheetConnection.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'الاتصال غير موجود' }); return; }
    await prisma.sheetConnection.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error('Delete sheet connection error:', err);
    res.status(500).json({ error: 'خطأ في حذف الاتصال' });
  }
});

// ──── Import Logic ────

type FieldMapping = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt?: string;
  statusColumn?: string;
  statusMapping?: Record<string, string>;
  userColumn?: string;
  userMapping?: Record<string, string>;
  customFields?: Array<{ label: string; field: string; type?: string }>;
};

/** إنشاء ليد من صف بيانات (مستخدم في الاستيراد والويب هوك) */
export async function createLeadFromRow(
  rowData: Record<string, string>,
  mapping: FieldMapping,
  connectionName: string,
  productId: string | null,
): Promise<{ created: boolean; skipped: boolean; error?: string }> {
  // استخراج القيم حسب الـ mapping
  const phoneRaw = mapping.phone ? (rowData[mapping.phone] ?? '').trim() : findPhoneInRow(rowData);
  if (!phoneRaw || phoneRaw.length < 6) return { created: false, skipped: true };

  const phoneNormalized = normalizePhone(phoneRaw);
  if (!phoneNormalized) return { created: false, skipped: true };

  const name = (mapping.name ? (rowData[mapping.name] ?? '').trim() : '') || 'وارد من جوجل شيتس';
  const email = (mapping.email ? (rowData[mapping.email] ?? '').trim() : '') || undefined;
  const address = (mapping.address ? (rowData[mapping.address] ?? '').trim() : '') || undefined;

  // تاريخ الإنشاء من الشيت (يُعامل كتوقيت مصر UTC+2)
  let parsedCreatedAt: Date | undefined;
  if (mapping.createdAt) {
    const rawDate = (rowData[mapping.createdAt] ?? '').trim();
    if (rawDate) {
      console.log(`[Sheet Date Debug] raw: "${rawDate}" | mapping key: "${mapping.createdAt}"`);
      // Append timezone offset if not present — Sheet dates are in Egypt time (UTC+2)
      const hasTimezone = /[+-]\d{2}:?\d{2}$|Z$/i.test(rawDate);
      const d = new Date(hasTimezone ? rawDate : rawDate + ' GMT+0200');
      console.log(`[Sheet Date Debug] parsed: "${d.toISOString()}" | hasTimezone: ${hasTimezone}`);
      if (!isNaN(d.getTime())) parsedCreatedAt = d;
    }
  }

  // حقول مخصصة
  const leadCustomFields: Record<string, unknown> = {};
  const productCustomFields: Record<string, unknown> = {};

  // استخراج UTMs تلقائياً من أعمدة الشيت
  // يدعم أسماء مختلفة: utm_source, UTM Source, utm source, Utm_Source, إلخ
  const utmLabels: Record<string, string> = {
    utm_source:   'مصدر الزيارة',
    utm_medium:   'وسيلة الزيارة',
    utm_campaign: 'الحملة الإعلانية',
    utm_content:  'محتوى الإعلان',
    utm_term:     'كلمة البحث',
  };
  const utmValues: Record<string, string> = {};
  for (const [utmKey, label] of Object.entries(utmLabels)) {
    // حوّل utm_source لـ pattern يطابق: utm_source, UTM Source, utm source, utmsource
    const normalized = utmKey.replace(/_/g, '').toLowerCase(); // "utmsource"
    for (const [col, val] of Object.entries(rowData)) {
      const colNorm = col.replace(/[_\s-]/g, '').toLowerCase(); // "utmsource" من أي صيغة
      if (colNorm === normalized && val.trim()) {
        leadCustomFields[label] = val.trim();
        utmValues[utmKey] = val.trim();
        break;
      }
    }
  }

  for (const def of mapping.customFields ?? []) {
    const val = (rowData[def.field] ?? '').trim();
    if (val) {
      if (def.type === 'product') productCustomFields[def.label] = val;
      else leadCustomFields[def.label] = val;
    }
  }

  // تحديد حالة الليد من الشيت أو الافتراضية
  let statusSlug = 'new';
  if (mapping.statusColumn && mapping.statusMapping) {
    const sheetStatusValue = (rowData[mapping.statusColumn] ?? '').trim();
    if (sheetStatusValue && mapping.statusMapping[sheetStatusValue]) {
      statusSlug = mapping.statusMapping[sheetStatusValue];
    }
  }
  const status = await prisma.leadStatus.findUnique({ where: { slug: statusSlug } });
  if (!status) return { created: false, skipped: false, error: `حالة "${statusSlug}" غير موجودة` };

  // تعيين المسؤول من الشيت أو التوزيع التلقائي
  let assignedToId: string | null = null;
  if (mapping.userColumn && mapping.userMapping) {
    const sheetUserValue = (rowData[mapping.userColumn] ?? '').trim();
    if (sheetUserValue && mapping.userMapping[sheetUserValue]) {
      assignedToId = mapping.userMapping[sheetUserValue];
    }
  }
  if (!assignedToId) {
    const assignment = await getNextAssignedUserId();
    assignedToId = assignment.userId;
    if (!assignedToId && assignment.reason) {
      console.log(`[Sheet Import] لم يتم تعيين الليد: ${assignment.reason}`);
    }
  }

  // Wrap customer + lead + product interest + task in a transaction
  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { phone: phoneNormalized },
      update: { email, address },
      create: { phone: phoneNormalized, name, email, address },
    });

    const lead = await tx.lead.create({
      data: {
        name,
        phone: phoneRaw,
        phoneNormalized,
        email,
        address,
        customFields: leadCustomFields as object,
        source: 'google_sheets',
        sourceDetail: connectionName,
        statusId: status.id,
        customerId: customer.id,
        ...(assignedToId ? { assignedToId } : {}),
        ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
        // Save UTMs to dedicated fields for campaign tracking
        ...(utmValues.utm_source ? { utmSource: utmValues.utm_source } : {}),
        ...(utmValues.utm_medium ? { utmMedium: utmValues.utm_medium } : {}),
        ...(utmValues.utm_campaign ? { utmCampaign: utmValues.utm_campaign } : {}),
        ...(utmValues.utm_content ? { utmContent: utmValues.utm_content } : {}),
      },
    });

    if (productId) {
      await tx.productInterest.create({
        data: {
          leadId: lead.id,
          productId,
          quantity: 1,
          customFields: productCustomFields as object,
        },
      });
    }

    if (assignedToId) {
      await tx.task.create({
        data: {
          type: 'new_lead',
          title: `تواصل مع ليد جديد: ${name}`,
          leadId: lead.id,
          assignedToId,
          status: 'pending',
        },
      });
    }
  });

  return { created: true, skipped: false };
}

function findPhoneInRow(row: Record<string, string>): string | null {
  for (const [key, val] of Object.entries(row)) {
    const k = key.toLowerCase();
    if ((k.includes('phone') || k.includes('tel') || k.includes('mobile') || k.includes('رقم') || k.includes('هاتف') || k.includes('موبايل')) && (val ?? '').trim().length >= 6) {
      return val.trim();
    }
  }
  return null;
}

// استيراد صفوف جديدة فقط
router.post('/:id/import', async (req: Request, res: Response) => {
  try {
    const conn = await prisma.sheetConnection.findUnique({ where: { id: String(req.params.id) } });
    if (!conn) { res.status(404).json({ error: 'الاتصال غير موجود' }); return; }

    const mapping = (conn.fieldMapping ?? {}) as FieldMapping;
    const startRow = conn.lastSyncedRow + 2; // +2 لأن الصف 1 = headers، وlastSyncedRow هو عدد الصفوف المستوردة
    const { headers, rows } = await readRows(conn.spreadsheetId, conn.sheetName, startRow);

    let created = 0, skipped = 0, failed = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // تجاهل الصفوف الفارغة تماماً
      if (!row || row.every((cell) => !cell?.trim())) { skipped++; continue; }

      const rowData: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        if (headers[j]) rowData[headers[j]] = row[j] ? String(row[j]) : '';
      }

      try {
        const result = await createLeadFromRow(rowData, mapping, conn.name, conn.productId);
        if (result.created) created++;
        else if (result.skipped) skipped++;
        else { failed++; if (result.error) errors.push({ row: startRow + i, error: result.error }); }
      } catch (err: unknown) {
        failed++;
        errors.push({ row: startRow + i, error: err instanceof Error ? err.message : 'خطأ غير متوقع' });
      }
    }

    // تحديث آخر صف تم استيراده
    await prisma.sheetConnection.update({
      where: { id: conn.id },
      data: {
        lastSyncedRow: conn.lastSyncedRow + rows.length,
        updatedAt: new Date(),
      },
    });

    console.log(`[sheets] استيراد من "${conn.name}": ${created} جديد، ${skipped} تخطي، ${failed} فشل`);
    res.json({ created, skipped, failed, errors, totalRows: rows.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في الاستيراد';
    console.error('Sheet import error:', msg);
    res.status(400).json({ error: msg });
  }
});

// استيراد كل الصفوف (إعادة من البداية)
router.post('/:id/import-all', async (req: Request, res: Response) => {
  try {
    const conn = await prisma.sheetConnection.findUnique({ where: { id: String(req.params.id) } });
    if (!conn) { res.status(404).json({ error: 'الاتصال غير موجود' }); return; }

    // إعادة تعيين lastSyncedRow
    await prisma.sheetConnection.update({ where: { id: conn.id }, data: { lastSyncedRow: 0 } });

    const mapping = (conn.fieldMapping ?? {}) as FieldMapping;
    const { headers, rows } = await readRows(conn.spreadsheetId, conn.sheetName, 2);

    let created = 0, skipped = 0, failed = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((cell) => !cell?.trim())) { skipped++; continue; }

      const rowData: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        if (headers[j]) rowData[headers[j]] = row[j] ? String(row[j]) : '';
      }

      try {
        const result = await createLeadFromRow(rowData, mapping, conn.name, conn.productId);
        if (result.created) created++;
        else if (result.skipped) skipped++;
        else { failed++; if (result.error) errors.push({ row: 2 + i, error: result.error }); }
      } catch (err: unknown) {
        failed++;
        errors.push({ row: 2 + i, error: err instanceof Error ? err.message : 'خطأ غير متوقع' });
      }
    }

    await prisma.sheetConnection.update({
      where: { id: conn.id },
      data: {
        lastSyncedRow: rows.length,
        updatedAt: new Date(),
      },
    });

    console.log(`[sheets] استيراد كامل من "${conn.name}": ${created} جديد، ${skipped} تخطي، ${failed} فشل`);
    res.json({ created, skipped, failed, errors, totalRows: rows.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في الاستيراد';
    console.error('Sheet import-all error:', msg);
    res.status(400).json({ error: msg });
  }
});

// GET /api/sheet-connections/:id/auto-sync-script — Generate Google Apps Script for auto-sync
router.get('/:id/auto-sync-script', async (req: Request, res: Response) => {
  try {
    const connection = await prisma.sheetConnection.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!connection) {
      res.status(404).json({ error: 'الاتصال غير موجود' });
      return;
    }

    const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const webhookUrl = `${baseUrl}/api/webhooks/sheets/${connection.token}`;

    const script = `// Dolphin Auto-Sync — ${connection.name}
// يفحص الشيت كل دقيقة ويبعت أي صفوف جديدة لدولفين تلقائياً

var WEBHOOK_URL = '${webhookUrl}';
var PROP_KEY = 'dolphin_last_synced_row';

function dolphinSync() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var props = PropertiesService.getScriptProperties();
  var lastSynced = parseInt(props.getProperty(PROP_KEY) || '1', 10);
  var lastRow = sheet.getLastRow();

  if (lastRow <= lastSynced) return; // مفيش صفوف جديدة

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // استيراد كل الصفوف الجديدة
  for (var r = lastSynced + 1; r <= lastRow; r++) {
    var values = sheet.getRange(r, 1, 1, lastCol).getValues()[0];

    // تجاهل الصفوف الفارغة
    var hasData = values.some(function(v) { return v !== '' && v !== null && v !== undefined; });
    if (!hasData) continue;

    var rowData = {};
    for (var i = 0; i < headers.length; i++) {
      if (headers[i]) {
        rowData[headers[i]] = (values[i] !== null && values[i] !== undefined) ? String(values[i]) : '';
      }
    }

    try {
      var response = UrlFetchApp.fetch(WEBHOOK_URL, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ row: rowData }),
        muteHttpExceptions: true
      });
      var code = response.getResponseCode();
      if (code === 201 || code === 200) {
        props.setProperty(PROP_KEY, String(r));
        Logger.log('✅ صف ' + r + ' — تم');
      } else {
        Logger.log('⚠️ صف ' + r + ' — رد: ' + code);
      }
    } catch(err) {
      Logger.log('❌ صف ' + r + ' — خطأ: ' + err);
    }
  }
}

// قم بتشغيل هذه الدالة مرة واحدة فقط لتفعيل المزامنة التلقائية
function installDolphinSync() {
  // حذف أي triggers قديمة
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dolphinSync') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // إضافة trigger كل دقيقة
  ScriptApp.newTrigger('dolphinSync')
    .timeBased()
    .everyMinutes(1)
    .create();

  // تسجيل آخر صف حالي عشان ما يبعتش الصفوف القديمة
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  props = PropertiesService.getScriptProperties();
  props.setProperty(PROP_KEY, String(lastRow));

  Logger.log('✅ تم تفعيل المزامنة كل دقيقة — آخر صف: ' + lastRow);
}`;

    res.json({ script, webhookUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ';
    res.status(400).json({ error: msg });
  }
});

// POST /api/sheet-connections/:id/backfill-utms — تحديث UTMs للليدز الموجودة (مرة واحدة)
router.post('/:id/backfill-utms', async (req: Request, res: Response) => {
  try {
    const conn = await prisma.sheetConnection.findUnique({ where: { id: String(req.params.id) } });
    if (!conn) { res.status(404).json({ error: 'الاتصال غير موجود' }); return; }

    const mapping = (conn.fieldMapping ?? {}) as FieldMapping;
    const { headers, rows } = await readRows(conn.spreadsheetId, conn.sheetName, 2);

    // UTM column matching (same logic as createLeadFromRow)
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    const utmDbFields: Record<string, string> = {
      utm_source: 'utmSource',
      utm_medium: 'utmMedium',
      utm_campaign: 'utmCampaign',
      utm_content: 'utmContent',
    };

    let updated = 0, skipped = 0, notFound = 0;

    for (const row of rows) {
      if (!row || row.every((cell) => !cell?.trim())) { skipped++; continue; }

      const rowData: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        if (headers[j]) rowData[headers[j]] = row[j] ? String(row[j]) : '';
      }

      // Extract phone
      const phoneCol = mapping.phone;
      const phoneRaw = phoneCol ? (rowData[phoneCol] ?? '').trim() : '';
      if (!phoneRaw) { skipped++; continue; }
      const phoneNormalized = normalizePhone(phoneRaw);
      if (!phoneNormalized) { skipped++; continue; }

      // Extract UTMs
      const utmValues: Record<string, string> = {};
      for (const utmKey of utmKeys) {
        const normalized = utmKey.replace(/_/g, '').toLowerCase();
        for (const [col, val] of Object.entries(rowData)) {
          const colNorm = col.replace(/[_\s-]/g, '').toLowerCase();
          if (colNorm === normalized && val.trim()) {
            utmValues[utmKey] = val.trim();
            break;
          }
        }
      }

      if (!utmValues.utm_source && !utmValues.utm_campaign) { skipped++; continue; }

      // Find lead by phone
      const lead = await prisma.lead.findFirst({
        where: { phoneNormalized, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, utmSource: true, utmCampaign: true },
      });

      if (!lead) { notFound++; continue; }

      // Update only UTM fields
      const updateData: Record<string, string> = {};
      for (const [utmKey, dbField] of Object.entries(utmDbFields)) {
        if (utmValues[utmKey]) updateData[dbField] = utmValues[utmKey];
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.lead.update({ where: { id: lead.id }, data: updateData });
        updated++;
      } else {
        skipped++;
      }
    }

    res.json({ success: true, updated, skipped, notFound, total: rows.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ';
    res.status(500).json({ error: msg });
  }
});

// POST /api/sheet-connections/:id/backfill-statuses — تحديث حالات الليدز من الشيت (مرة واحدة)
router.post('/:id/backfill-statuses', async (req: Request, res: Response) => {
  try {
    const maxRow = req.body?.maxRow ? Number(req.body.maxRow) : undefined; // optional: آخر صف يتسحب
    const conn = await prisma.sheetConnection.findUnique({ where: { id: String(req.params.id) } });
    if (!conn) { res.status(404).json({ error: 'الاتصال غير موجود' }); return; }

    const mapping = (conn.fieldMapping ?? {}) as FieldMapping;
    if (!mapping.statusColumn) {
      res.status(400).json({ error: 'عمود الحالة (statusColumn) غير محدد في الماپنج' });
      return;
    }
    const statusMapping = mapping.statusMapping ?? {};

    const { headers, rows } = await readRows(conn.spreadsheetId, conn.sheetName, 2);

    // Limit rows if maxRow specified (maxRow is 1-indexed, row 1 = headers, data starts row 2)
    const dataRows = maxRow ? rows.slice(0, maxRow - 1) : rows;

    // Pre-fetch all lead statuses
    const allStatuses = await prisma.leadStatus.findMany();
    const statusBySlug = new Map(allStatuses.map(s => [s.slug, s.id]));

    const phoneColIndex = headers.indexOf(mapping.phone ?? '');
    const statusColIndex = headers.indexOf(mapping.statusColumn);

    if (phoneColIndex === -1) { res.status(400).json({ error: 'عمود الموبايل غير موجود في الشيت' }); return; }
    if (statusColIndex === -1) { res.status(400).json({ error: 'عمود الحالة غير موجود في الشيت' }); return; }

    let updated = 0, skipped = 0, notFound = 0;

    for (const row of dataRows) {
      if (!row || row.every((cell) => !cell?.trim())) { skipped++; continue; }

      const phoneRaw = (row[phoneColIndex] ?? '').trim();
      if (!phoneRaw) { skipped++; continue; }
      const phoneNormalized = normalizePhone(phoneRaw);
      if (!phoneNormalized) { skipped++; continue; }

      const sheetStatus = (row[statusColIndex] ?? '').trim();
      if (!sheetStatus) { skipped++; continue; }

      // Map sheet status → dolphin slug
      const dolphinSlug = statusMapping[sheetStatus];
      if (!dolphinSlug) { skipped++; continue; }

      const statusId = statusBySlug.get(dolphinSlug);
      if (!statusId) { skipped++; continue; }

      // Find lead by phone
      const lead = await prisma.lead.findFirst({
        where: { phoneNormalized, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, statusId: true },
      });

      if (!lead) { notFound++; continue; }

      // Update only if status is different
      if (lead.statusId !== statusId) {
        await prisma.lead.update({ where: { id: lead.id }, data: { statusId } });
        updated++;
      } else {
        skipped++;
      }
    }

    res.json({ success: true, updated, skipped, notFound, total: dataRows.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ';
    res.status(500).json({ error: msg });
  }
});

// POST /api/sheet-connections/:id/backfill-dolphin — مزامنة بيانات دولفين (سيلز، حالة، قيمة طلب) للشيت
router.post('/:id/backfill-dolphin', async (req: Request, res: Response) => {
  try {
    const conn = await prisma.sheetConnection.findUnique({ where: { id: String(req.params.id) } });
    if (!conn) { res.status(404).json({ error: 'الاتصال غير موجود' }); return; }

    const mapping = (conn.fieldMapping ?? {}) as { phone?: string; [k: string]: unknown };
    if (!mapping.phone) {
      res.status(400).json({ error: 'عمود الموبايل (phone) غير محدد في الماپنج' });
      return;
    }

    const startRow = req.body?.startRow ? Number(req.body.startRow) : 2;
    if (isNaN(startRow) || startRow < 2) {
      res.status(400).json({ error: 'startRow يجب أن يكون رقم >= 2' });
      return;
    }
    const maxRows = req.body?.maxRows ? Number(req.body.maxRows) : undefined;

    const result = await backfillDolphinDataToSheet(
      conn.spreadsheetId,
      conn.sheetName,
      mapping.phone,
      startRow,
      maxRows,
      mapping,
    );

    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ';
    console.error('Backfill dolphin data error:', msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
