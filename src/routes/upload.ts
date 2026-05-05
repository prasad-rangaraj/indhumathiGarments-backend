import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { protect, admin } from '../middleware/auth.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function uploadRoutes(app: FastifyInstance) {
  // Ensure the uploads directory exists
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Upload route (Protected for Admins only)
  app.post('/upload', { preHandler: [protect, admin] }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      // Sanitize the filename to prevent path traversal
      const sanitizedFilename = data.filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
      const uniqueFilename = `${Date.now()}-${sanitizedFilename}`;
      const savePath = path.join(uploadsDir, uniqueFilename);

      await pipeline(data.file, fs.createWriteStream(savePath));

      const fileUrl = `/uploads/${uniqueFilename}`;

      return reply.status(200).send({
        url: fileUrl,
        message: 'File uploaded successfully',
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to upload file' });
    }
  });
}
