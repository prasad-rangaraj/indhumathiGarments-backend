import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../lib/db.js';
import { Review } from '../entities/Review.js';
import { protect } from '../middleware/auth.js';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { reviewSchema } from '../lib/validators.js';
import { z } from 'zod';

export default async function reviewRoutes(appInstance: FastifyInstance) {
  const app = appInstance.withTypeProvider<ZodTypeProvider>();

  // Create review (Protected)
  app.post('/', { 
    preHandler: [protect],
    schema: { body: reviewSchema } 
  }, async (request, reply) => {
    try {
      const { productId, rating, title, content, images } = request.body as z.infer<typeof reviewSchema>;
      const user = (request as any).user;
      
      const name = user.name;

      const reviewRepo = AppDataSource.getRepository(Review);
      const newReview = reviewRepo.create({
        productId,
        userId: user.id,
        name,
        rating: rating,
        title,
        content,
        images: images || [],
        isApproved: false,
      });

      const review = await reviewRepo.save(newReview);

      return reply.status(201).send(review);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get reviews for a product
  app.get('/product/:productId', {
    schema: { params: z.object({ productId: z.string() }) }
  }, async (request, reply) => {
      try {
          const { productId } = request.params as { productId: string };
          const reviewRepo = AppDataSource.getRepository(Review);
          const reviews = await reviewRepo.find({
              where: { productId, isApproved: true },
              order: { createdAt: 'DESC' }
          });
          return reply.send(reviews);
      } catch (error: any) {
          return reply.status(500).send({ error: error.message });
      }
  });
}
