import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Normalize phone number to E.164 format
 * e.g., "01012345678" → "+201012345678"
 */
export function normalizePhone(phone: string, defaultCountry: string = 'EG'): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry as any);
  return parsed?.format('E.164') ?? cleaned;
}

/**
 * Check if phone number is valid
 */
export function isValidPhone(phone: string, defaultCountry: string = 'EG'): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry as any);
  return parsed?.isValid() ?? false;
}
