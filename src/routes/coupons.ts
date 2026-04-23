import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../lib/db.js';
import { Coupon } from '../entities/Coupon.js';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

export default async function couponPublicRoutes(appInstance: FastifyInstance) {
  const app = appInstance.withTypeProvider<ZodTypeProvider>();

  // Public: get all active (non-expired) coupons for banner
  // Using empty string as path to match exactly /api/coupons (with or without slash depends on Fastify config)
  app.get('', async (request, reply) => {
    try {
       const couponRepo = AppDataSource.getRepository(Coupon);
       const now = new Date();
       
       // Fetch all to see what's in the DB during debug
       const coupons = await couponRepo.find({
         order: { discount: 'DESC' },
       });

       console.log(`[Coupons Debug] Total in DB: ${coupons.length}`);
       
       const active = coupons.filter(c => {
         const isAct = c.isActive === true || (c.isActive as any) === 1 || (c.isActive as any) === '1';
         
         // If validUntil exists, check if it's at least the start of today
         // We set 'today' to the beginning of the current day for a fair comparison
         const today = new Date();
         today.setHours(0, 0, 0, 0);
         
         const expiryDate = c.validUntil ? new Date(c.validUntil) : null;
         const isNotExpired = !expiryDate || expiryDate >= today;
         
         console.log(`[Coupons Debug] Code: ${c.code}, isActive: ${c.isActive}, isNotExpired: ${isNotExpired}`);
         return isAct && isNotExpired;
       });

       return reply.send(active.map(c => ({
         id: c.id,
         code: c.code,
         discount: Number(c.discount),
         minAmount: c.minAmount ? Number(c.minAmount) : null,
         validUntil: c.validUntil,
       })));
    } catch (error: any) {
      console.error('[Coupons Error]', error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
