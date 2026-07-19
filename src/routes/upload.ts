import { FastifyInstance } from 'fastify';
import { protect, admin } from '../middleware/auth.js';
import { uploadToS3 } from '../lib/s3.js';
import { toBuffer } from '../lib/streamUtils.js';

export default async function uploadRoutes(app: FastifyInstance) {
  // Upload route — Admin only, stores image privately on S3
  app.post('/upload', { preHandler: [protect, admin] }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({ error: 'Only JPEG, PNG, WebP, and GIF images are allowed' });
      }

      // Read the file into a buffer
      const originalBuffer = await toBuffer(data.file);

      // Process image with sharp
      const sharp = (await import('sharp')).default;
      const buffer = await sharp(originalBuffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      // Get folder from query, default to 'products'
      const query = request.query as { folder?: string };
      let rawFolder = query.folder || 'products';
      let folderName = rawFolder.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_/]/g, '');
      if (!folderName) folderName = 'products'; // Fallback if only special chars were provided
      folderName = folderName.replace(/^\/+|\/+$/g, ''); // Clean leading/trailing slashes

      // Build a clean S3 key: folder/<timestamp>-<sanitized-filename>.webp
      const sanitized = data.filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
      const key = `${folderName}/${Date.now()}-${sanitized}.webp`;

      // Upload privately to S3
      await uploadToS3(key, buffer, 'image/webp');

      // Generate a short-lived pre-signed URL for immediate preview in admin
      const { getPresignedUrl } = await import('../lib/s3.js');
      const previewUrl = await getPresignedUrl(key); // Uses default 7-day expiry

      // Return both: key (store in DB), previewUrl (show in admin preview)
      return reply.status(200).send({
        key,
        url: previewUrl,
        message: 'File uploaded successfully to S3',
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to upload file: ' + error.message });
    }
  });
}
