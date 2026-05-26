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

// ─── Generate a static public S3 URL ──────────────────────────────────────────
export const getPresignedUrl = async (key: string): Promise<string> => {
  const region = process.env.AWS_REGION || 'ap-south-1';
  return `https://${S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
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

// ─── Helper: Convert an S3 URL back into an S3 Key ───────────────────────────
export const extractS3Key = (urlOrKey: string | undefined | null): string | null => {
  if (!urlOrKey) return null;
  const region = process.env.AWS_REGION || 'ap-south-1';
  const prefix = `https://${S3_BUCKET}.s3.${region}.amazonaws.com/`;
  
  try {
    if (urlOrKey.startsWith(prefix)) {
      const url = new URL(urlOrKey);
      return url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    }
  } catch (e) {
    // Fallback if URL parsing fails
    if (urlOrKey.startsWith(prefix)) {
      return urlOrKey.slice(prefix.length).split('?')[0];
    }
  }
  
  // If it's a signed URL from somewhere else (e.g., custom domain), try to parse it
  if (urlOrKey.includes('?X-Amz-Algorithm')) {
    try {
      const url = new URL(urlOrKey);
      return url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    } catch (e) {
      return urlOrKey.split('?')[0];
    }
  }
  
  return urlOrKey;
};
