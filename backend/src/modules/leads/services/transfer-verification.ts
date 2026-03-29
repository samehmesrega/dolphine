/**
 * Transfer Verification Service
 * Runs automatically when an order is created.
 * Performs non-OCR checks and calculates a trust score.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../../db';
import { config } from '../../../shared/config';

export type TransferCheck = {
  name: string;
  label: string;
  passed: boolean;
  warning: boolean;
  detail: string;
  score: number; // negative = deduction, positive = bonus
};

/**
 * Try to read EXIF data from an image buffer.
 * Returns true if valid EXIF metadata is found.
 */
async function hasExifData(buffer: Buffer): Promise<boolean> {
  try {
    const exifModule = await import('exif-reader');
    const parse: (buf: Buffer) => Record<string, unknown> =
      typeof exifModule.default === 'function'
        ? (exifModule.default as (buf: Buffer) => Record<string, unknown>)
        : (exifModule as unknown as (buf: Buffer) => Record<string, unknown>);
    // exif-reader expects a Buffer starting from the EXIF APP1 marker TIFF data
    // Find EXIF offset in JPEG
    const EXIF_MARKER = 0xe1;
    let offset = 2; // skip SOI marker (0xFFD8)
    while (offset < buffer.length - 1) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (marker === EXIF_MARKER) {
        // Found APP1 marker — extract EXIF data
        const exifData = buffer.subarray(offset + 4, offset + 2 + segmentLength);
        // Check if it starts with "Exif\0\0"
        if (exifData.subarray(0, 6).toString('ascii') === 'Exif\0\0') {
          const tiffData = exifData.subarray(6);
          const result = parse(tiffData);
          // If we got any meaningful data, EXIF exists
          return !!(result && (result.Image || result.Photo || result.GPSInfo || result.Iop));
        }
      }
      offset += 2 + segmentLength;
    }
    return false;
  } catch {
    // If parsing fails, we cannot determine EXIF — treat as no EXIF
    return false;
  }
}

/**
 * Compute MD5 hash of a buffer.
 */
function computeImageHash(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Main verification function.
 * Called after order creation.
 */
export async function verifyTransfer(order: {
  id: string;
  transferImage?: string | null;
  noTransferImage: boolean;
  senderPhone?: string | null;
  imageHash?: string | null;
  customerId: string;
  leadId: string;
  partialAmount?: number | null;
  discount?: number | null;
  paymentType: string;
  orderItems: Array<{ price: number; quantity: number }>;
}, userId: string): Promise<{ trustScore: number; checks: TransferCheck[]; imageHash: string | null }> {
  const checks: TransferCheck[] = [];
  let imageHash: string | null = null;

  // Calculate total order amount
  const totalItemsAmount = order.orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountVal = Number(order.discount) || 0;
  const finalTotal = totalItemsAmount - discountVal;
  const paidAmount = order.paymentType === 'full'
    ? finalTotal
    : (Number(order.partialAmount) || 0);

  // ==========================================
  // 1. EXIF/Metadata check
  // ==========================================
  if (order.transferImage) {
    try {
      const filePath = path.resolve(config.upload.dir, order.transferImage);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        imageHash = computeImageHash(buffer);

        const hasExif = await hasExifData(buffer);
        checks.push({
          name: 'exif_check',
          label: 'فحص EXIF/Metadata',
          passed: hasExif,
          warning: !hasExif,
          detail: hasExif ? 'الصورة تحتوي على بيانات EXIF' : 'الصورة لا تحتوي على بيانات EXIF — قد تكون معدّلة',
          score: hasExif ? 0 : -15,
        });
      }
    } catch (err) {
      console.error('[TransferVerification] EXIF check error:', err);
    }
  }

  // ==========================================
  // 2. Image hash — duplicate check
  // ==========================================
  if (imageHash) {
    const duplicateOrder = await prisma.order.findFirst({
      where: {
        imageHash,
        id: { not: order.id },
        deletedAt: null,
      },
      select: { id: true, number: true },
    });

    const isDuplicate = !!duplicateOrder;
    checks.push({
      name: 'image_hash',
      label: 'تكرار الصورة',
      passed: !isDuplicate,
      warning: isDuplicate,
      detail: isDuplicate
        ? `صورة مكررة — نفس الصورة مستخدمة في طلب #${duplicateOrder!.number}`
        : 'الصورة فريدة',
      score: isDuplicate ? -40 : 0,
    });
  }

  // ==========================================
  // 3. Sender phone repetition
  // ==========================================
  if (order.senderPhone) {
    const samePhoneOrders = await prisma.order.count({
      where: {
        senderPhone: order.senderPhone,
        id: { not: order.id },
        deletedAt: null,
      },
    });

    const isRepeated = samePhoneOrders > 0;
    checks.push({
      name: 'sender_phone_repeat',
      label: 'تكرار رقم المحوّل',
      passed: !isRepeated,
      warning: isRepeated,
      detail: isRepeated
        ? `رقم المحوّل مستخدم في ${samePhoneOrders} طلب/طلبات أخرى`
        : 'رقم المحوّل يظهر لأول مرة',
      score: isRepeated ? -20 : 0,
    });
  }

  // ==========================================
  // 4. Same sender + same amount same day
  // ==========================================
  if (order.senderPhone) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Find orders with same sender phone on same day
    const sameDayOrders = await prisma.order.findMany({
      where: {
        senderPhone: order.senderPhone,
        id: { not: order.id },
        deletedAt: null,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      include: {
        orderItems: { select: { price: true, quantity: true } },
      },
    });

    let sameAmountSameDay = false;
    for (const o of sameDayOrders) {
      const oTotal = o.orderItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0) - (Number(o.discount) || 0);
      const oPaid = o.paymentType === 'full' ? oTotal : (Number(o.partialAmount) || 0);
      if (Math.abs(oPaid - paidAmount) < 0.01) {
        sameAmountSameDay = true;
        break;
      }
    }

    checks.push({
      name: 'same_sender_amount_day',
      label: 'نفس الرقم + نفس المبلغ نفس اليوم',
      passed: !sameAmountSameDay,
      warning: sameAmountSameDay,
      detail: sameAmountSameDay
        ? 'نفس رقم المحوّل حوّل نفس المبلغ اليوم في طلب آخر'
        : 'لا يوجد تكرار',
      score: sameAmountSameDay ? -35 : 0,
    });
  }

  // ==========================================
  // 5. Customer history
  // ==========================================
  const customerOrders = await prisma.order.findMany({
    where: {
      customerId: order.customerId,
      id: { not: order.id },
      deletedAt: null,
    },
    select: { id: true, accountsStatus: true },
  });

  const previousRejected = customerOrders.filter(o => o.accountsStatus === 'rejected').length;
  const previousConfirmed = customerOrders.filter(o => o.accountsStatus === 'confirmed').length;
  const isNewCustomer = customerOrders.length === 0;

  if (isNewCustomer) {
    checks.push({
      name: 'customer_history',
      label: 'سجل العميل',
      passed: true,
      warning: true,
      detail: 'عميل جديد — أول طلب',
      score: -10,
    });
  } else if (previousRejected > 0) {
    checks.push({
      name: 'customer_history',
      label: 'سجل العميل',
      passed: false,
      warning: true,
      detail: `العميل لديه ${previousRejected} طلب/طلبات مرفوضة سابقاً`,
      score: -25,
    });
  } else if (previousConfirmed > 0) {
    checks.push({
      name: 'customer_history',
      label: 'سجل العميل',
      passed: true,
      warning: false,
      detail: `العميل لديه ${previousConfirmed} طلب/طلبات ناجحة سابقة`,
      score: +15,
    });
  }

  // ==========================================
  // 6. Sales agent pattern — rejection rate
  // ==========================================
  // Get all orders created by this sales agent (via lead assignment)
  const agentLeads = await prisma.lead.findMany({
    where: { assignedToId: userId },
    select: { id: true },
  });
  const agentLeadIds = agentLeads.map(l => l.id);

  if (agentLeadIds.length > 0) {
    const agentOrders = await prisma.order.findMany({
      where: {
        leadId: { in: agentLeadIds },
        deletedAt: null,
      },
      select: { accountsStatus: true },
    });

    const totalAgentOrders = agentOrders.length;
    const rejectedAgentOrders = agentOrders.filter(o => o.accountsStatus === 'rejected').length;
    const rejectionRate = totalAgentOrders > 0 ? (rejectedAgentOrders / totalAgentOrders) * 100 : 0;

    const highRejection = totalAgentOrders >= 5 && rejectionRate > 20;
    checks.push({
      name: 'agent_pattern',
      label: 'نمط السيلز',
      passed: !highRejection,
      warning: highRejection,
      detail: highRejection
        ? `نسبة رفض السيلز ${rejectionRate.toFixed(0)}% (${rejectedAgentOrders}/${totalAgentOrders})`
        : `نسبة رفض السيلز ${rejectionRate.toFixed(0)}% — ضمن الحد الطبيعي`,
      score: highRejection ? -15 : 0,
    });
  }

  // ==========================================
  // 7. Blacklist check
  // ==========================================
  if (order.senderPhone) {
    const blacklisted = await prisma.blacklistedPhone.findUnique({
      where: { phone: order.senderPhone },
    });

    const isBlacklisted = !!blacklisted;
    checks.push({
      name: 'blacklist',
      label: 'قائمة الحظر',
      passed: !isBlacklisted,
      warning: isBlacklisted,
      detail: isBlacklisted
        ? `رقم المحوّل محظور: ${blacklisted!.reason || 'بدون سبب'}`
        : 'رقم المحوّل ليس في قائمة الحظر',
      score: isBlacklisted ? -50 : 0,
    });
  }

  // ==========================================
  // 8. Amount > 2000 — flag for mandatory review
  // ==========================================
  const isHighAmount = paidAmount > 2000;
  checks.push({
    name: 'high_amount',
    label: 'مبلغ فوق 2000 ج.م',
    passed: !isHighAmount,
    warning: isHighAmount,
    detail: isHighAmount
      ? `المبلغ المدفوع ${paidAmount.toFixed(2)} ج.م — يحتاج مراجعة إلزامية`
      : `المبلغ المدفوع ${paidAmount.toFixed(2)} ج.م — ضمن الحد الطبيعي`,
    score: isHighAmount ? -10 : 0,
  });

  // ==========================================
  // 9. No transfer image — penalty
  // ==========================================
  if (order.noTransferImage || !order.transferImage) {
    checks.push({
      name: 'no_image',
      label: 'بدون صورة تحويل',
      passed: false,
      warning: true,
      detail: 'لا توجد صورة تحويل مرفقة بالطلب',
      score: -30,
    });
  }

  // ==========================================
  // Calculate Trust Score
  // ==========================================
  let trustScore = 100;
  for (const check of checks) {
    trustScore += check.score;
  }
  // Clamp to 0-100
  trustScore = Math.max(0, Math.min(100, trustScore));

  return { trustScore, checks, imageHash };
}
