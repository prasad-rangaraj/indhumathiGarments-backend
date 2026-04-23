import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../lib/db.js';
import { CartItem } from '../entities/CartItem.js';
import { protect } from '../middleware/auth.js';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { cartSchema } from '../lib/validators.js';
import { z } from 'zod';

export default async function cartRoutes(appInstance: FastifyInstance) {
  const app = appInstance.withTypeProvider<ZodTypeProvider>();

  // Apply protection to all cart routes
  app.addHook('preHandler', protect);

  // Get cart items
  app.get('/', async (request, reply) => {
    try {
      const user = (request as any).user;
      const cartItemRepo = AppDataSource.getRepository(CartItem);
      const items = await cartItemRepo.find({
        where: { userId: user.id },
        relations: ['product']
      });
      
      // Filter out items with missing products
      const validItems = items.filter(item => item.product !== null);
      
      // Cleanup invalid items
      if (items.length !== validItems.length) {
         const invalidIds = items.filter(item => item.product === null).map(item => item.id);
         if (invalidIds.length > 0) {
             await cartItemRepo.delete(invalidIds);
         }
      }

      return reply.send(validItems.map(cartItem => {
          const product = cartItem.product;
          return {
              id: cartItem.id,
              userId: cartItem.userId,
              productId: product!.id,
              quantity: cartItem.quantity,
              size: cartItem.size,
              color: cartItem.color,
              createdAt: cartItem.createdAt,
              updatedAt: cartItem.updatedAt,
              product: {
                  ...product!,
                  price: Number(product!.price)
              },
          };
      }));
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Add to cart
  app.post('/', { schema: { body: cartSchema } }, async (request, reply) => {
    try {
      const { productId, quantity, size, color } = request.body as z.infer<typeof cartSchema>;
      const user = (request as any).user;

      const cartItemRepo = AppDataSource.getRepository(CartItem);
      
      const existingItem = await cartItemRepo.findOne({
        where: {
          userId: user.id,
          productId,
          size,
          color: color || undefined,
        }
      });

      let cartItem;
      if (existingItem) {
        existingItem.quantity += quantity;
        cartItem = await cartItemRepo.save(existingItem);
        // Explicitly load the product relation for existingItem since save() doesn't auto-fetch relations if not loaded
        cartItem = await cartItemRepo.findOne({ where: { id: cartItem.id }, relations: ['product'] });
      } else {
        const newItem = cartItemRepo.create({
            userId: user.id,
            productId,
            quantity,
            size,
            color
        });
        cartItem = await cartItemRepo.save(newItem);
        cartItem = await cartItemRepo.findOne({ where: { id: cartItem.id }, relations: ['product'] });
      }

      if (!cartItem || !cartItem.product) {
          return reply.status(500).send({ error: 'Failed to add item to cart' });
      }

      const product = cartItem.product;

      return reply.status(201).send({
          id: cartItem.id,
          userId: cartItem.userId,
          productId: product.id,
          quantity: cartItem.quantity,
          size: cartItem.size,
          color: cartItem.color,
          createdAt: cartItem.createdAt,
          updatedAt: cartItem.updatedAt,
          product: {
              ...product,
              price: Number(product.price)
          },
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update cart item
  app.patch('/:id', {
    schema: {
      body: z.object({ quantity: z.number().int().positive() })
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { quantity } = request.body as { quantity: number };
      const user = (request as any).user;

      const cartItemRepo = AppDataSource.getRepository(CartItem);

      // Verify ownership
      const existing = await cartItemRepo.findOne({
          where: { id, userId: user.id },
          relations: ['product']
      });

      if (!existing) {
          return reply.status(404).send({ error: 'Cart item not found' });
      }

      existing.quantity = quantity;
      const cartItem = await cartItemRepo.save(existing);

      const product = cartItem.product; 

      return reply.send({
          id: cartItem.id,
          userId: cartItem.userId,
          productId: product.id,
          quantity: cartItem.quantity,
          size: cartItem.size,
          color: cartItem.color,
          createdAt: cartItem.createdAt, 
          updatedAt: cartItem.updatedAt,
          product: {
              ...product,
              price: Number(product.price)
          },
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Remove from cart
  app.delete('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = (request as any).user;
      
      if (!id) {
        return reply.status(400).send({ error: 'Cart item ID is required' });
      }
      const cartItemRepo = AppDataSource.getRepository(CartItem);
      
      const existing = await cartItemRepo.findOne({
          where: { id, userId: user.id }
      });

      if (!existing) {
          return reply.status(404).send({ error: 'Item not found' });
      }

      await cartItemRepo.remove(existing);

      return reply.send({ message: 'Item removed from cart' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Clear cart
  app.delete('/', async (request, reply) => {
    try {
      const user = (request as any).user;
      const cartItemRepo = AppDataSource.getRepository(CartItem);
      await cartItemRepo.delete({ userId: user.id });

      return reply.send({ message: 'Cart cleared' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
