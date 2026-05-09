import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

// ─── S3 Client ───────────────────────────────────────────────────────────────
export const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const S3_BUCKET = process.env.AWS_S3_BUCKET || 'indhumathi-garments-images';

// ─── Upload a file buffer to S3 ──────────────────────────────────────────────
export const uploadToS3 = async (
  key: string,
  body: Buffer | Readable,
  contentType: string
): Promise<string> => {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  // Return the S3 key (NOT a URL) — URLs will be signed on demand
  return key;
};

// ─── Generate a pre-signed URL (valid for 7 days) ───────────────────────────
// Cache signed URLs in memory so the same URL string is returned across API calls.
// This allows the browser to cache the actual image file.
// 7-day expiry prevents images from breaking between page visits.
const urlCache = new Map<string, { url: string; expiresAt: number }>();

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60; // 604800 seconds
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

export const getPresignedUrl = async (key: string, expiresInSeconds = SEVEN_DAYS_IN_SECONDS): Promise<string> => {
  const now = Date.now();
  const cached = urlCache.get(key);
  
  // Reuse cached URL if it's still valid for at least 1 more hour
  if (cached && cached.expiresAt > now + ONE_HOUR_IN_MS) {
    return cached.url;
  }

  const command = new GetObjectCommand({ 
    Bucket: S3_BUCKET, 
    Key: key,
  });
  
  const url = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  
  // Cache the generated URL
  urlCache.set(key, {
    url,
    expiresAt: now + (expiresInSeconds * 1000)
  });
  
  return url;
};

// ─── Delete an object from S3 ────────────────────────────────────────────────
export const deleteFromS3 = async (key: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
};

// ─── Helper: Is this an S3 key? (not a local /uploads/ path) ─────────────────
export const isS3Key = (path: string): boolean =>
  !path.startsWith('/uploads/') && !path.startsWith('http');

// ─── Helper: Convert any image path/key to a displayable URL ─────────────────
// - S3 key (e.g. "products/abc.jpg")        → pre-signed URL
// - Old local path (e.g. "/uploads/abc.jpg") → full EC2 URL (backward compat)
// - Already a full URL                       → return as-is
export const resolveImageUrl = async (imagePathOrKey: string | undefined | null): Promise<string | null> => {
  if (!imagePathOrKey) return null;
  if (imagePathOrKey.startsWith('http')) return imagePathOrKey;
  if (imagePathOrKey.startsWith('/uploads/')) {
    // Legacy local file — serve via the old EC2 backend URL
    const baseUrl = process.env.PUBLIC_BACKEND_URL || '';
    return `${baseUrl}${imagePathOrKey}`;
  }
  // It's an S3 key — generate a pre-signed URL
  return getPresignedUrl(imagePathOrKey);
};
