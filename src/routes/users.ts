import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../lib/db.js';
import { User } from '../entities/User.js';
import { protect } from '../middleware/auth.js';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

export default async function userRoutes(appInstance: FastifyInstance) {
  const app = appInstance.withTypeProvider<ZodTypeProvider>();

  // Apply protection to all routes
  app.addHook('preHandler', protect);

  // Get user by ID (Protected: Self or Admin)
  app.get('/:id', {
    schema: { params: z.object({ id: z.string() }) }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { id } = request.params as { id: string };

      // Access Control Check
      if (user.role !== 'admin' && user.id !== id) {
          return reply.status(403).send({ error: 'Not authorized to view this profile' });
      }

      const userRepo = AppDataSource.getRepository(User);
      const fetchedUser = await userRepo.findOne({
          where: { id },
          select: ['id', 'name', 'email', 'phone', 'role', 'createdAt', 'address']
      });

      if (!fetchedUser) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send(fetchedUser);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update Profile
  app.patch('/profile', {
      schema: {
          body: z.object({
              name: z.string().optional(),
              phone: z.string().optional(),
              address: z.string().optional()
          })
      }
  }, async (request, reply) => {
    try {
      const { name, phone, address } = request.body as { name?: string, phone?: string, address?: string };
      const currentUser = (request as any).user;
      
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: currentUser.id } });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      if (name) user.name = name;
      if (phone) user.phone = phone;
      if (address) user.address = address;

      const updatedUser = await userRepo.save(user);
      
      return reply.send({
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
          role: updatedUser.role,
          createdAt: updatedUser.createdAt,
          address: updatedUser.address
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
