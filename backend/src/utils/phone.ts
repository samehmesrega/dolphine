/**
 * تطبيع رقم الفون - دولفين
 * توحيد صيغة الرقم لضمان الربط الصحيح بين الليدز والعملاء
 */

import { parsePhoneNumberWithError, isValidPhoneNumber } from 'libphonenumber-js';

/**
 * يحوّل الرقم لصيغة موحدة (E.164)
 * مثال: 01234567890 أو 201234567890 → +201234567890
 */
export function normalizePhone(phone: string, defaultCountry: string = 'EG'): string | null {
  if (!phone || typeof phone !== 'string') return null;
  
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 9) return null;

  try {
    let toParse = phone;
    if (cleaned.startsWith('01') && cleaned.length === 11) {
      toParse = '+20' + cleaned.slice(1);
    } else if (cleaned.startsWith('1') && cleaned.length === 10) {
      toParse = '+20' + cleaned;
    } else if (!phone.startsWith('+')) {
      toParse = '+' + phone;
    }

    const parsed = parsePhoneNumberWithError(toParse, defaultCountry as any);
    if (parsed && isValidPhoneNumber(parsed.number)) {
      return parsed.format('E.164');
    }
  } catch {
    // fallback: إرجاع الرقم بعد تنظيفه
    const digits = cleaned.replace(/^0+/, '');
    if (digits.length >= 9) {
      return digits.startsWith('20') ? '+' + digits : '+20' + digits;
    }
  }
  return null;
}
