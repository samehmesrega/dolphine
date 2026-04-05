/**
 * Google Drive Upload — رفع الملفات على Google Drive
 * يستخدم OAuth2 refresh token بتاع يوزر حقيقي (مش service account)
 * Env: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_DRIVE_REFRESH_TOKEN + GOOGLE_DRIVE_UPLOADS_FOLDER_ID
 */

const DRIVE_API = 'https://www.googleapis.com/upload/drive/v3/files';

let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('[Drive] Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_DRIVE_REFRESH_TOKEN');
    return null;
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      console.error('[Drive] Token refresh failed:', await res.text());
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
