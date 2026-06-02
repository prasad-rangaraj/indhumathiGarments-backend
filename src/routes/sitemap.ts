import { FastifyPluginAsync } from 'fastify';
import { AppDataSource } from '../lib/db.js';
import { Product } from '../entities/Product.js';

const sitemapRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/sitemap.xml', async (request, reply) => {
    // Get frontend URL from env, default to indhumathigarments.com
    const rawFrontendUrl = process.env.FRONTEND_URL || 'https://indhumathigarments.com';
    const FRONTEND_URL = rawFrontendUrl.replace(/\/$/, '');
    
    try {
      const productRepo = AppDataSource.getRepository(Product);
      const products = await productRepo.find({
        where: { isActive: true },
        select: ['id', 'updatedAt']
      });

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
      
      // Static routes
      xml += `  <url>\n    <loc>${FRONTEND_URL}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
      xml += `  <url>\n    <loc>${FRONTEND_URL}/shop</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
      xml += `  <url>\n    <loc>${FRONTEND_URL}/about</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      xml += `  <url>\n    <loc>${FRONTEND_URL}/contact</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;

      // Dynamic product routes
      products.forEach((product) => {
        const lastMod = product.updatedAt 
          ? product.updatedAt.toISOString().split('T')[0] 
          : new Date().toISOString().split('T')[0];
        
        xml += `  <url>\n`;
        xml += `    <loc>${FRONTEND_URL}/product/${product.id}</loc>\n`;
        xml += `    <lastmod>${lastMod}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `  </url>\n`;
      });

      xml += `</urlset>`;

      reply.header('Content-Type', 'application/xml');
      return reply.send(xml);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send('Error generating sitemap');
    }
  });
};

export default sitemapRoutes;
