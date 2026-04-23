import 'fastify';
import { User } from '../entities/User.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User; // Adding the User entity type to all Fastify requests
  }
}
