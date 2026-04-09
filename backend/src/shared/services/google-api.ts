/**
 * Google API key retrieval — shared integration utility.
 * Returns decrypted credentials for SERVER-SIDE use ONLY.
 * NEVER include return values in API responses or log output.
 */

import { prisma } from '../../db';
import { decryptToken } from '../utils/token-encryption';
import { logger } from '../config/logger';

/** جلب API Key من إعدادات التكامل (مع فك التشفير) */
export async function getGoogleApiKey(): Promise<string | null> {
  const setting = await prisma.integrationSetting.findUnique({
    where: { key: 'google_sheets_api_key' },
  });
  if (!setting?.value) return null;
  try {
    return decryptToken(setting.value);
  } catch {
    logger.error({ key: setting.key }, 'Stored key is NOT encrypted — re-encrypt via settings');
    return setting.value;
  }
}
