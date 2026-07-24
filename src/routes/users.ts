import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../lib/db.js';
import { User } from '../entities/User.js';
import { protect } from '../middleware/auth.js';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import bcrypt from 'bcrypt';
import sendEmail from '../lib/email.js';

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

  // Request OTP for Password Update
  app.post('/request-password-update-otp', async (request, reply) => {
    try {
      const currentUser = (request as any).user;
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: currentUser.id } });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      user.otp = otp;
      user.otpExpires = otpExpires;
      await userRepo.save(user);

      await sendEmail({
        email: user.email,
        subject: 'Password Update Verification Code',
        message: `Your verification code to update your password is: ${otp}\n\nThis code will expire in 15 minutes.`
      });

      return reply.send({ message: 'OTP sent to your email' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update Password with OTP
  app.patch('/update-password-otp', {
    schema: {
      body: z.object({
        otp: z.string().length(6),
        newPassword: z.string().min(6, "New password must be at least 6 characters")
      })
    }
  }, async (request, reply) => {
    try {
      const { otp, newPassword } = request.body as any;
      const currentUser = (request as any).user;
      
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ 
        where: { id: currentUser.id }
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      if (user.otp !== otp) {
        return reply.status(400).send({ error: 'Invalid OTP' });
      }

      if (user.otpExpires && user.otpExpires < new Date()) {
        return reply.status(400).send({ error: 'OTP has expired' });
      }

      // Hash the new password and save it
      user.password = await bcrypt.hash(newPassword, 10);
      user.otp = undefined;
      user.otpExpires = undefined;
      await userRepo.save(user);
      
      return reply.send({ message: 'Password updated successfully' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
