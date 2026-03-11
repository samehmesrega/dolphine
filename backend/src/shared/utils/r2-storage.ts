/**
 * Cloudflare R2 Storage Utility
 * Uses AWS S3-compatible API
 *
 * Required env vars:
 * - CF_ACCOUNT_ID
 * - CLOUDFLARE_R2_ACCESS_KEY
 * - CLOUDFLARE_R2_SECRET_KEY
 * - CLOUDFLARE_R2_BUCKET
 * - R2_PUBLIC_URL (optional, for public access)
 */

import { logger } from '../config/logger';

// R2 client is lazily initialized to avoid startup errors when not configured
let r2Client: any = null;

async function getR2Client() {
  if (r2Client) return r2Client;

  const accountId = process.env.CF_ACCOUNT_ID;
  const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY;
  const secretKey = process.env.CLOUDFLARE_R2_SECRET_KEY;

  if (!accountId || !accessKey || !secretKey) {
    throw new Error('R2 storage not configured. Set CF_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY, CLOUDFLARE_R2_SECRET_KEY');
  }

  // Dynamic import to avoid requiring @aws-sdk/client-s3 when R2 is not used
  const { S3Client } = await import('@aws-sdk/client-s3');

  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  });

  return r2Client;
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const client = await getR2Client();
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');

  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  if (!bucket) throw new Error('CLOUDFLARE_R2_BUCKET not set');

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (publicUrl) {
    return `${publicUrl}/${key}`;
  }

  return `r2://${bucket}/${key}`;
}

export async function getSignedDownloadUrl(key: string): Promise<string> {
  const client = await getR2Client();
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  if (!bucket) throw new Error('CLOUDFLARE_R2_BUCKET not set');

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 }
  );
}

export async function deleteFromR2(key: string): Promise<void> {
  const client = await getR2Client();
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  if (!bucket) throw new Error('CLOUDFLARE_R2_BUCKET not set');

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Check if R2 is configured
 */
export function isR2Configured(): boolean {
  return !!(
    process.env.CF_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY &&
    process.env.CLOUDFLARE_R2_SECRET_KEY &&
    process.env.CLOUDFLARE_R2_BUCKET
  );
}
