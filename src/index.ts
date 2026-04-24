import 'reflect-metadata';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import fastifyCookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';

dotenv.config();

// Initialize Fastify
const app = Fastify({
  logger: true
}).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

const PORT = process.env.PORT && process.env.PORT !== '3000' ? Number(process.env.PORT) : 5001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080/';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import Routes (To be refactored)
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import userRoutes from './routes/users.js';
import reviewRoutes from './routes/reviews.js';
import cartRoutes from './routes/cart.js';
import wishlistRoutes from './routes/wishlist.js';
import adminRoutes from './routes/admin.js';
import customerRoutes from './routes/customers.js';
import enquiryRoutes from './routes/enquiries.js';
import settingsRoutes from './routes/settings.js';
import trackingRoutes from './routes/tracking.js';
import couponPublicRoutes from './routes/coupons.js';
import paymentsRoutes from './routes/payments.js';

// Setup Plugins
const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
const frontendUrl = rawFrontendUrl.replace(/\/$/, ''); // Remove trailing slash if any

app.register(cors, {
  origin: true, // Temporarily allow all origins for debugging
  credentials: true,
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
});

app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'uploads'),
  prefix: '/uploads/', // optional: default '/'
});

app.register(fastifyCookie);
app.register(helmet, { global: true, crossOriginResourcePolicy: false }); // Allow images
app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
}); // Basic rate limit for security

import { initDb } from './lib/db.js';

// Health check
app.get('/api/health', async (request, reply) => {
  return { status: 'ok', message: 'Indhumathi API is running with Fastify and Oracle SQL 🚀' };
});

// Public settings (no auth required) — for customer-facing site
app.get('/api/public/settings', async (request, reply) => {
  try {
    const { AppDataSource } = await import('./lib/db.js');
    const { Settings } = await import('./entities/Settings.js');
    const settingsRepo = AppDataSource.getRepository(Settings);
    const rows = await settingsRepo.find();
    const map: Record<string, string> = {};
    rows.forEach((r: any) => { if (!r.isEncrypted) map[r.key] = r.value; });
    const settingsResponse = {
      siteName: map.siteName || 'Indhumathi',
      tagline: map.tagline || "Pure Cotton Women's Innerwear",
      email: map.email || 'indhumathi.img@gmail.com',
      phone: map.phone || '+91 87546 09226',
      address: map.address || 'Teachers colony 2nd street, Pandian nagar, Tiruppur, Tamilnadu - 641604.',
    };

    // Override specifically if they contain the wrong mock data identified
    if (settingsResponse.phone === '+91 98765 43210') {
      settingsResponse.phone = '+91 87546 09226';
    }
    if (settingsResponse.address.includes('123, Textile Street')) {
      settingsResponse.address = 'Teachers colony 2nd street, Pandian nagar, Tiruppur, Tamilnadu - 641604.';
    }

    return reply.send(settingsResponse);
  } catch {
    return reply.send({
      siteName: 'Indhumathi',
      tagline: "Pure Cotton Women's Innerwear",
      email: 'indhumathi.img@gmail.com',
      phone: '+91 87546 09226',
      address: 'Teachers colony 2nd street, Pandian nagar, Tiruppur, Tamilnadu - 641604.',
    });
  }
});

// Register Routes
app.register(authRoutes, { prefix: '/api/auth' });
app.register(productRoutes, { prefix: '/api/products' });
app.register(orderRoutes, { prefix: '/api/orders' });
app.register(userRoutes, { prefix: '/api/users' });
app.register(reviewRoutes, { prefix: '/api/reviews' });
app.register(cartRoutes, { prefix: '/api/cart' });
app.register(wishlistRoutes, { prefix: '/api/wishlist' });
app.register(adminRoutes, { prefix: '/api/admin' });
app.register(settingsRoutes, { prefix: '/api/admin/settings' });
app.register(customerRoutes, { prefix: '/api/customers' });
app.register(enquiryRoutes, { prefix: '/api/enquiries' });
app.register(couponPublicRoutes, { prefix: '/api/coupons' });
app.register(trackingRoutes, { prefix: '/api/public/track' });
app.register(paymentsRoutes, { prefix: '/api/payments' });

const start = async () => {
  try {
    await initDb();
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`Server running on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
