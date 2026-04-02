/**
 * Google Drive Upload — رفع الملفات على Google Drive
 * يستخدم نفس Service Account الخاص بـ Google Sheets
 * Env: GOOGLE_SERVICE_ACCOUNT_KEY + GOOGLE_DRIVE_UPLOADS_FOLDER_ID
 */

import { createSign } from 'crypto';

const DRIVE_API = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  try {
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
    const creds = JSON.parse(json);
    if (!creds.client_email || !creds.private_key) return null;

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
      iss: creds.client_email,
      scope: DRIVE_SCOPE,
      aud: creds.token_uri,
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    const sign = createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(creds.private_key, 'base64url');

    const res = await fetch(creds.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${payload}.${signature}`,
    });

    if (!res.ok) {
      console.error('[Drive] Token exchange failed:', await res.text());
      return null;
    }

    const data = await res.json() as { access_token: string; expires_in: number };
    cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
    return cachedToken.token;
  } catch (err: any) {
    console.error('[Drive] Auth error:', err.message);
    return null;
  }
}

/**
 * Upload file to Google Drive
 * Returns the public URL or null on failure
 */
export async function uploadFileToDrive(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) {
    console.error('[Drive] No access token — skipping upload');
    return null;
  }

  const folderId = process.env.GOOGLE_DRIVE_UPLOADS_FOLDER_ID;

  try {
    // Multipart upload
    const metadata: Record<string, any> = { name: filename };
    if (folderId) metadata.parents = [folderId];

    const boundary = 'dolphin_upload_boundary';
    const body = [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ];

    const bodyBuffer = Buffer.concat([
      Buffer.from(body[0]),
      Buffer.from(body[1]),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const res = await fetch(`${DRIVE_API}?uploadType=multipart&fields=id,webViewLink`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyBuffer,
    });

    if (!res.ok) {
      console.error('[Drive] Upload failed:', await res.text());
      return null;
    }

    const data = await res.json() as { id: string; webViewLink?: string };

    // Make file publicly readable
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });

    // Return direct image URL
    return `https://lh3.googleusercontent.com/d/${data.id}`;
  } catch (err: any) {
    console.error('[Drive] Upload error:', err.message);
    return null;
  }
}
