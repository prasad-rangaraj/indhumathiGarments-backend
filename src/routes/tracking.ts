import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../lib/db.js';
import { Order } from '../entities/Order.js';
import { AuditLog } from '../entities/AuditLog.js';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

export default async function trackingRoutes(appInstance: FastifyInstance) {
  const app = appInstance.withTypeProvider<ZodTypeProvider>();

  app.get('/:trackingNumber', {
    schema: {
      params: z.object({ trackingNumber: z.string() })
    }
  }, async (request, reply) => {
    try {
      const { trackingNumber } = request.params as { trackingNumber: string };
      
      const orderRepo = AppDataSource.getRepository(Order);
      const order = await orderRepo.findOne({
        where: { trackingNumber },
        select: ['orderId', 'total', 'originalTotal', 'status', 'trackingNumber', 'createdAt', 'paymentMethod', 'customerName', 'customerEmail', 'customerPhone', 'customerAddress', 'customerCity', 'customerPincode']
      });

      if (!order) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      const auditRepo = AppDataSource.getRepository(AuditLog);
      const audits = await auditRepo.find({
        where: { entityId: order.orderId, action: 'UPDATE_ORDER_STATUS' },
        order: { createdAt: 'ASC' }
      });

      const events = [];
      
      // Push genesis event
      events.push({
        status: 'Order Confirmed',
        location: 'Processing Facility',
        timestamp: order.createdAt,
        description: 'Your order has been received and confirmed'
      });

      // Push audit trail events
      for (const audit of audits) {
        try {
          const details = JSON.parse(audit.details);
          let location = 'Distribution Hub';
          let desc = 'Your order status was updated';

          if (details.newStatus === 'Shipped') {
             location = 'Last Mile Warehouse';
             desc = 'Your order has been shipped out for delivery';
          } else if (details.newStatus === 'Delivered') {
             location = 'Destination';
             desc = 'Your order has been delivered successfully';
          }

          events.push({
            status: details.newStatus,
            location: location,
            timestamp: audit.createdAt,
            description: desc
          });
        } catch(e) {}
      }

      return reply.send({
        orderInfo: {
          orderId: order.orderId,
          total: Number(order.total),
          originalTotal: order.originalTotal ? Number(order.originalTotal) : null,
          status: order.status,
          trackingNumber: order.trackingNumber,
          paymentMethod: order.paymentMethod,
          customerInfo: {
            name: order.customerName,
            address: order.customerAddress,
            city: order.customerCity,
            pincode: order.customerPincode,
            phone: order.customerPhone,
            email: order.customerEmail
          }
        },
        events: events.reverse()
      });

    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
