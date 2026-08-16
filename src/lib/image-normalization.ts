import path from 'node:path';

const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

export interface NormalizedImage {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  converted: boolean;
}

export function isHeicUpload(filename: string, mimeType: string): boolean {
  return HEIC_MIME_TYPES.has(mimeType.toLowerCase()) || /\.(?:heic|heif)$/i.test(filename);
}

export function normalizeUploadMime(filename: string, mimeType: string): string {
  const normalized = mimeType.toLowerCase().trim();
  if (isHeicUpload(filename, normalized)) return 'image/heic';
  if (normalized) return normalized;

  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  return 'application/octet-stream';
}

export async function normalizeImageForProcessing(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<NormalizedImage> {
  if (!isHeicUpload(filename, mimeType)) {
    return { buffer, filename, mimeType, converted: false };
  }

  try {
    const { default: convertHeic } = await import('heic-convert');
    const converted = await convertHeic({
      buffer,
      format: 'JPEG',
      quality: 0.94,
    });
    return {
      buffer: Buffer.from(converted),
      filename: filename.replace(/\.(?:heic|heif)$/i, '.jpg'),
      mimeType: 'image/jpeg',
      converted: true,
    };
  } catch (error) {
    throw new Error(`Could not decode iPhone HEIC photo ${filename}: ${(error as Error).message}`);
  }
}
