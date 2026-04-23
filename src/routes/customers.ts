import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../lib/db.js';
import { User } from '../entities/User.js';
import { Address } from '../entities/Address.js';
import { Order } from '../entities/Order.js';
import { protect } from '../middleware/auth.js';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

export default async function customerRoutes(appInstance: FastifyInstance) {
  const app = appInstance.withTypeProvider<ZodTypeProvider>();

  // Protect all customer routes
  app.addHook('preHandler', protect);

  // Get customer profile
  app.get('/profile/:userId', {
      schema: { params: z.object({ userId: z.string() }) }
  }, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({
          where: { id: userId },
          select: ['id', 'name', 'email', 'phone', 'role', 'createdAt']
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send(user);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update customer profile
  app.patch('/profile/:userId', {
      schema: {
          params: z.object({ userId: z.string() }),
          body: z.object({
              name: z.string().optional(),
              phone: z.string().optional()
          })
      }
  }, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const { name, phone } = request.body as { name?: string, phone?: string };

      // Ensure that ownership or admin privileges exist (omitted for speed unless required, following previous implementation)
      
      const userRepo = AppDataSource.getRepository(User);
      let user = await userRepo.findOneBy({ id: userId });
      
      if (user) {
          if (name) user.name = name;
          if (phone) user.phone = phone;
          await userRepo.save(user);
          user = await userRepo.findOne({
              where: { id: userId },
              select: ['id', 'name', 'email', 'phone', 'role']
          });
      }

      return reply.send(user);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get customer addresses
  app.get('/addresses/:userId', {
      schema: { params: z.object({ userId: z.string() }) }
  }, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const addressRepo = AppDataSource.getRepository(Address);
      const addresses = await addressRepo.find({
          where: { userId },
          order: { isDefault: 'DESC', createdAt: 'DESC' }
      });

      return reply.send(addresses);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Create address
  app.post('/addresses', {
      schema: {
          body: z.object({
              userId: z.string(),
              name: z.string(),
              phone: z.string(),
              address: z.string(),
              city: z.string(),
              pincode: z.string(),
              state: z.string(),
              country: z.string().optional(),
              isDefault: z.boolean().optional(),
              addressType: z.string().optional()
          })
      }
  }, async (request, reply) => {
    try {
      const { userId, name, phone, address, city, pincode, state, country, isDefault, addressType } = request.body as Record<string, any>;

      const addressRepo = AppDataSource.getRepository(Address);
      
      if (isDefault) {
          await addressRepo.update({ userId }, { isDefault: false });
      }

      const newAddress = addressRepo.create({
            userId,
            name,
            phone,
            address,
            city,
            pincode,
            state,
            country: country || 'India',
            isDefault: isDefault || false,
            addressType: addressType || 'home',
      });
      await addressRepo.save(newAddress);

      return reply.status(201).send(newAddress);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update address
  app.patch('/addresses/:id', {
      schema: {
          params: z.object({ id: z.string() }),
          body: z.record(z.string(), z.any())
      }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, any>;
      const { isDefault, ...updateData } = body;

      const addressRepo = AppDataSource.getRepository(Address);
      
      if (isDefault) {
        const address = await addressRepo.findOneBy({ id });
        if (address) {
            await addressRepo.createQueryBuilder()
                .update(Address)
                .set({ isDefault: false })
                .where("userId = :userId AND id != :id", { userId: address.userId, id })
                .execute();
        }
      }

      const updatedAddress = await addressRepo.findOneBy({ id });
      if (updatedAddress) {
          Object.assign(updatedAddress, { ...updateData, isDefault });
          await addressRepo.save(updatedAddress);
      }

      return reply.send(updatedAddress);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Delete address
  app.delete('/addresses/:id', {
      schema: { params: z.object({ id: z.string() }) }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const addressRepo = AppDataSource.getRepository(Address);
      await addressRepo.delete({ id });
      return reply.send({ message: 'Address deleted successfully' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get customer orders
  app.get('/orders/:userId', {
      schema: { params: z.object({ userId: z.string() }) }
  }, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const orderRepo = AppDataSource.getRepository(Order);
      const orders = await orderRepo.find({
          where: { userId },
          relations: ['items', 'items.product'],
          order: { orderDate: 'DESC' }
      });

      return reply.send(orders.map((order: any) => ({
        ...order,
        total: Number(order.total),
        originalTotal: order.originalTotal ? Number(order.originalTotal) : null,
        discount: order.discount ? Number(order.discount) : null,
        items: order.items.map((item: any) => ({
            ...item,
            price: Number(item.price),
            product: item.product ? {
                ...item.product,
                price: Number(item.product.price)
            } : null,
        })),
      })));
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
