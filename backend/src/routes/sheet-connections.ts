/**
 * إدارة اتصالات Google Sheets
 * CRUD + استيراد الليدز من الشيتات
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import { extractSpreadsheetId, readHeaders, readRows } from '../services/googleSheets';
import { normalizePhone } from '../utils/phone';
import { getNextAssignedUserId } from '../services/roundRobin';

const router = Router();

const fieldMappingSchema = z.object({
  name:         z.string().optional(),
  phone:        z.string().optional(),
  email:        z.string().optional(),
  address:      z.string().optional(),
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
    res.json({
      configured: !!setting?.value,
      apiKeyMasked: setting?.value ? setting.value.slice(0, 8) + '...' : null,
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
    await prisma.integrationSetting.upsert({
      where: { key: 'google_sheets_api_key' },
      update: { value: apiKey.trim() },
      create: { key: 'google_sheets_api_key', value: apiKey.trim() },
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
    const conn = await prisma.sheetConnection.findUnique({ where: { id: req.params.id } });
    if (!conn) { res.status(404).json({ error: 'الاتصال غير موجود' }); return; }
    const headers = await readHeaders(conn.spreadsheetId, conn.sheetName);
    res.json({ headers });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في قراءة الشيت';
    console.error('Read headers error:', msg);
    res.status(400).json({ error: msg });
  }
});

// تحديث field mapping
router.patch('/:id/mapping', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
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
    const id = req.params.id;
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
    const existing = await prisma.sheetConnection.findUnique({ where: { id: req.params.id } });
    if (!existing) { res.status(404).json({ error: 'الاتصال غير موجود' }); return; }
    await prisma.sheetConnection.delete({ where: { id: req.params.id } });
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

  // حقول مخصصة
  const leadCustomFields: Record<string, unknown> = {};
  const productCustomFields: Record<string, unknown> = {};
  for (const def of mapping.customFields ?? []) {
    const val = (rowData[def.field] ?? '').trim();
    if (val) {
      if (def.type === 'product') productCustomFields[def.label] = val;
      else leadCustomFields[def.label] = val;
    }
  }

  const status = await prisma.leadStatus.findUnique({ where: { slug: 'new' } });
  if (!status) return { created: false, skipped: false, error: 'حالة "new" غير موجودة' };

  const customer = await prisma.customer.upsert({
    where: { phone: phoneNormalized },
    update: { email, address },
    create: { phone: phoneNormalized, name, email, address },
  });

  const assignedToId = await getNextAssignedUserId();

  const lead = await prisma.lead.create({
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
    },
  });

  if (productId) {
    await prisma.productInterest.create({
      data: {
        leadId: lead.id,
        productId,
        quantity: 1,
        customFields: productCustomFields as object,
      },
    });
  }

  // إنشاء تاسك ليد جديد
  if (assignedToId) {
    await prisma.task.create({
      data: {
        type: 'new_lead',
        title: `تواصل مع ليد جديد: ${name}`,
        leadId: lead.id,
        assignedToId,
        status: 'pending',
      },
    });
  }

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
    const conn = await prisma.sheetConnection.findUnique({ where: { id: req.params.id } });
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
    const conn = await prisma.sheetConnection.findUnique({ where: { id: req.params.id } });
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

export default router;
