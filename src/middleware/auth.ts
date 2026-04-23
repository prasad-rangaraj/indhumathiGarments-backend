import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../lib/db.js';
import { User } from '../entities/User.js';
import { BlacklistedToken } from '../entities/BlacklistedToken.js';

export const protect = async (request: FastifyRequest, reply: FastifyReply) => {
  let token;
  const authHeader = request.headers.authorization;

  if (request.cookies && request.cookies.token) {
    token = request.cookies.token;
  } else if (authHeader && authHeader.startsWith('Bearer')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return reply.status(401).send({ error: 'Not authorized, no token' });
  }

  try {
    const tokenRepo = AppDataSource.getRepository(BlacklistedToken);
    const isBlacklisted = await tokenRepo.findOne({ where: { token } });
    if (isBlacklisted) {
      return reply.status(401).send({ error: 'Session expired. Please log in again.' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }
    const decoded: any = jwt.verify(token, secret);

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: decoded.id }
    });
    
    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }

    // Attach user to request
    (request as any).user = user;
  } catch (error) {
    return reply.status(401).send({ error: 'Not authorized, token failed' });
  }
};

export const admin = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = (request as any).user;
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return reply.status(403).send({ error: 'Not authorized as an admin or super admin' });
  }
};
