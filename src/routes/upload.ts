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
      const buffer = await toBuffer(data.file);

      // Build a clean S3 key: products/<timestamp>-<sanitized-filename>
      const sanitized = data.filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
      const key = `products/${Date.now()}-${sanitized}`;

      // Upload privately to S3
      await uploadToS3(key, buffer, data.mimetype);

      // Generate a short-lived pre-signed URL for immediate preview in admin
      const { getPresignedUrl } = await import('../lib/s3.js');
      const previewUrl = await getPresignedUrl(key, 3600); // 1 hour

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
