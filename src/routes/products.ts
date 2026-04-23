import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppDataSource } from '../lib/db.js';
import { Product } from '../entities/Product.js';
import { Like, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';

export default async function productRoutes(appInstance: FastifyInstance) {
  const app = appInstance.withTypeProvider<ZodTypeProvider>();

  // Get all products
  app.get('/', {
    schema: {
      querystring: z.object({
        category: z.string().optional(),
        subcategory: z.string().optional(),
        search: z.string().optional(),
        minPrice: z.coerce.number().optional(),
        maxPrice: z.coerce.number().optional(),
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(20)
      })
    }
  }, async (request, reply) => {
    try {
      const { category, subcategory, search, minPrice, maxPrice, page, limit } = request.query as any;
      
      const productRepo = AppDataSource.getRepository(Product);
      
      const whereParams: any = { isActive: true };

      if (category) whereParams.category = category;
      if (subcategory) whereParams.subcategory = subcategory;

      if (search) {
        whereParams.name = Like(`%${search}%`);
      }

      if (minPrice && maxPrice) {
        whereParams.price = Between(minPrice, maxPrice);
      } else if (minPrice) {
        whereParams.price = MoreThanOrEqual(minPrice);
      } else if (maxPrice) {
        whereParams.price = LessThanOrEqual(maxPrice);
      }

      const skip = (page - 1) * limit;

      const [products, total] = await productRepo.findAndCount({
        where: whereParams,
        order: { createdAt: 'DESC' },
        skip,
        take: limit
      });

      return reply.send({
        products: products.map(p => ({
            ...p,
            price: Number(p.price)
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get categories
  app.get('/categories/list', async (request, reply) => {
    try {
      const productRepo = AppDataSource.getRepository(Product);
      const categories = await productRepo.find({
        where: { isActive: true },
        select: ['category', 'subcategory']
      });

      const categoryMap: Record<string, string[]> = {};
      categories.forEach(({ category, subcategory }) => {
        if (!categoryMap[category]) {
          categoryMap[category] = [];
        }
        if (subcategory && !categoryMap[category].includes(subcategory)) {
          categoryMap[category].push(subcategory);
        }
      });

      return reply.send(categoryMap);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get product by ID
  app.get('/:id', {
    schema: {
      params: z.object({ id: z.string() })
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const productRepo = AppDataSource.getRepository(Product);
      const product = await productRepo.findOne({
        where: { id }
      });
      
      if (!product) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      return reply.send({
        ...product,
        price: Number(product.price)
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
