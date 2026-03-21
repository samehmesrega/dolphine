import { prisma } from '../../../db';
import type { KbMediaSource } from '@prisma/client';
import { getGoogleApiKey } from '../../leads/services/googleSheets';

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

function extractDriveFolderId(url: string): string | null {
  // https://drive.google.com/drive/folders/FOLDER_ID
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function extractDriveFileId(url: string): string | null {
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

export async function listMedia(productId: string) {
  return prisma.kbMedia.findMany({
    where: { productId },
    orderBy: { orderNum: 'asc' },
  });
}

export async function getMediaById(id: string) {
  return prisma.kbMedia.findUnique({ where: { id } });
}

export async function createMedia(data: {
  productId: string;
  type: string;
  url: string;
  thumbnail?: string;
  caption?: string;
  tags?: string;
  source?: KbMediaSource;
  orderNum?: number;
}) {
  return prisma.kbMedia.create({
    data: {
      productId: data.productId,
      type: data.type,
      url: data.url,
      thumbnail: data.thumbnail,
      caption: data.caption,
      tags: data.tags,
      source: data.source ?? 'UPLOAD',
      orderNum: data.orderNum ?? 0,
    },
  });
}

export async function updateMedia(
  id: string,
  data: Partial<{
    type: string;
    url: string;
    thumbnail: string;
    caption: string;
    tags: string;
    source: KbMediaSource;
    orderNum: number;
  }>
) {
  return prisma.kbMedia.update({
    where: { id },
    data,
  });
}

export async function deleteMedia(id: string) {
  return prisma.kbMedia.delete({ where: { id } });
}

export async function reorderMedia(productId: string, orderedIds: string[]) {
  const updates = orderedIds.map((id, index) =>
    prisma.kbMedia.update({
      where: { id },
      data: { orderNum: index },
    })
  );
  await prisma.$transaction(updates);
  return listMedia(productId);
}

export async function syncFromDrive(productId: string) {
  // Get product to find drive folder URL
  const product = await prisma.kbProduct.findUnique({ where: { id: productId } });
  if (!product?.driveFolderUrl) {
    throw new Error('لا يوجد رابط فولدر درايف لهذا المنتج');
  }

  const folderId = extractDriveFolderId(product.driveFolderUrl);
  if (!folderId) {
    throw new Error('رابط فولدر الدرايف غير صالح');
  }

  const apiKey = await getGoogleApiKey();
  if (!apiKey) {
    throw new Error('مفتاح Google API غير مُعد — أضفه من إعدادات التكاملات');
  }

  // List files in the Drive folder
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = 'files(id,name,mimeType,thumbnailLink)';
  const url = `${DRIVE_API}?q=${query}&key=${apiKey}&fields=${fields}&pageSize=200`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    if (text.includes('notFound')) {
      throw new Error('الفولدر غير موجود أو غير مشارك كـ public');
    }
    throw new Error(`خطأ من Google Drive API: ${text}`);
  }

  const data = (await res.json()) as { files?: Array<{ id: string; name: string; mimeType: string; thumbnailLink?: string }> };
  const files = data.files || [];

  // Get existing Drive media to avoid duplicates
  const existing = await prisma.kbMedia.findMany({
    where: { productId, source: 'DRIVE' },
    select: { url: true },
  });
  const existingUrls = new Set(existing.map((m) => m.url));

  // Get max orderNum
  const lastMedia = await prisma.kbMedia.findFirst({
    where: { productId },
    orderBy: { orderNum: 'desc' },
  });
  let nextOrder = (lastMedia?.orderNum || 0) + 1;

  let synced = 0;

  for (const file of files) {
    const isImage = file.mimeType.startsWith('image/');
    const isVideo = file.mimeType.startsWith('video/');
    if (!isImage && !isVideo) continue;

    const fileUrl = `https://drive.google.com/uc?export=view&id=${file.id}`;
    if (existingUrls.has(fileUrl)) continue;

    const thumbnail = `https://lh3.googleusercontent.com/d/${file.id}=w400`;

    await prisma.kbMedia.create({
      data: {
        productId,
        type: isImage ? 'image' : 'video',
        url: fileUrl,
        thumbnail,
        caption: file.name,
        source: 'DRIVE',
        orderNum: nextOrder++,
      },
    });
    synced++;
  }

  // Update product driveFolderUrl if not set
  if (!product.driveFolderUrl && product.driveFolderUrl !== product.driveFolderUrl) {
    await prisma.kbProduct.update({
      where: { id: productId },
      data: { driveFolderUrl: product.driveFolderUrl },
    });
  }

  return { synced, total: files.filter((f) => f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/')).length };
}
