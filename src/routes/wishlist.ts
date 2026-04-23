import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../lib/db.js';
import { WishlistItem } from '../entities/WishlistItem.js';
import { protect } from '../middleware/auth.js';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { wishlistSchema } from '../lib/validators.js';
import { z } from 'zod';

export default async function wishlistRoutes(appInstance: FastifyInstance) {
  const app = appInstance.withTypeProvider<ZodTypeProvider>();

  // Apply protection to all wishlist routes
  app.addHook('preHandler', protect);

  // Get wishlist
  app.get('/', async (request, reply) => {
    try {
      const user = (request as any).user;
      const wishlistItemRepo = AppDataSource.getRepository(WishlistItem);
      const items = await wishlistItemRepo.find({
          where: { userId: user.id },
          relations: ['product']
      });

      const validItems = items.filter(item => item.product !== null);

      return reply.send(validItems.map(item => {
          const product = item.product!;
          return {
            id: item.id,
            userId: item.userId,
            productId: product.id,
            createdAt: item.createdAt, 
            product: {
              ...product,
              price: Number(product.price)
            },
          };
      }));
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Add to wishlist
  app.post('/', { schema: { body: wishlistSchema } }, async (request, reply) => {
    try {
      const { productId } = request.body as z.infer<typeof wishlistSchema>;
      const user = (request as any).user;

      const wishlistItemRepo = AppDataSource.getRepository(WishlistItem);
      const existing = await wishlistItemRepo.findOne({
          where: { userId: user.id, productId }
      });

      if (existing) {
           return reply.status(400).send({ error: 'Product already in wishlist' });
      }

      const newItem = wishlistItemRepo.create({
          userId: user.id,
          productId,
      });
      let wishlistItem = await wishlistItemRepo.save(newItem);
      wishlistItem = await wishlistItemRepo.findOne({
          where: { id: wishlistItem.id },
          relations: ['product']
      }) as WishlistItem;
      
      const product = wishlistItem.product;

      return reply.status(201).send({
        id: wishlistItem.id,
        userId: wishlistItem.userId,
        productId: product.id,
        createdAt: wishlistItem.createdAt, 
        product: {
          ...product,
          price: Number(product.price)
        },
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Remove from wishlist
  app.delete('/:productId', {
    schema: { params: z.object({ productId: z.string() }) }
  }, async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };
      const user = (request as any).user;

      const wishlistItemRepo = AppDataSource.getRepository(WishlistItem);
      const existing = await wishlistItemRepo.findOne({
        where: {
            userId: user.id,
            productId
        }
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Item not found in wishlist' });
      }

      await wishlistItemRepo.remove(existing);

      return reply.send({ message: 'Item removed from wishlist' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
