import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppDataSource } from '../lib/db.js';
import { Order } from '../entities/Order.js';
import { OrderItem } from '../entities/OrderItem.js';
import { Product } from '../entities/Product.js';
import { Coupon } from '../entities/Coupon.js';
import { AuditLog } from '../entities/AuditLog.js';
import { Notification } from '../entities/Notification.js';
import { ReturnRequest } from '../entities/ReturnRequest.js';
import { protect } from '../middleware/auth.js';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { orderSchema } from '../lib/validators.js';
import sendEmail from '../lib/email.js';
import { z } from 'zod';

export default async function orderRoutes(appInstance: FastifyInstance) {
  const app = appInstance.withTypeProvider<ZodTypeProvider>();

  // Add protect middleware to all order routes
  app.addHook('preHandler', protect);

  // Helper to map order for response
  const mapOrder = (order: any) => ({
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
  });

  // Get all orders (for a user or admin)
  app.get('/', {
    schema: {
      querystring: z.object({
        userId: z.string().optional(),
        status: z.string().optional()
      })
    }
  }, async (request, reply) => {
    try {
      const { userId, status } = request.query as any;
      const user = (request as any).user;
      
      const queryParams: any = {};
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        queryParams.userId = user.id;
      } else if (userId) {
        queryParams.userId = userId;
      }

      if (status) queryParams.status = status;

      const orderRepo = AppDataSource.getRepository(Order);
      const orders = await orderRepo.find({
        where: queryParams,
        relations: ['items', 'items.product'],
        order: { orderDate: 'DESC' }
      });

      return reply.send(orders.map(mapOrder));
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get order by ID
  app.get('/:orderId', {
    schema: {
      params: z.object({ orderId: z.string() })
    }
  }, async (request, reply) => {
    try {
      const { orderId } = request.params as any;
      const user = (request as any).user;

      const orderRepo = AppDataSource.getRepository(Order);
      const order = await orderRepo.findOne({
        where: { orderId },
        relations: ['items', 'items.product']
      });

      if (!order) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      if (user.role !== 'admin' && user.role !== 'super_admin' && order.userId && order.userId !== user.id) {
        return reply.status(403).send({ error: 'Not authorized to view this order' });
      }

      return reply.send(mapOrder(order));
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Create order
  app.post('/', { schema: { body: orderSchema } }, async (request, reply) => {
    try {
      const {
        items,
        total,
        originalTotal,
        discount,
        couponCode,
        customerInfo,
        paymentMethod
      } = request.body as z.infer<typeof orderSchema>;
      const user = (request as any).user;

      const orderId = `IND${Date.now()}`;
      const trackingNumber = `TRK${Date.now().toString().slice(-6)}`;

      const createdOrder = await AppDataSource.manager.transaction(async transactionalEntityManager => {
        const orderRepo = transactionalEntityManager.getRepository(Order);
        const orderItemRepo = transactionalEntityManager.getRepository(OrderItem);
        const productRepo = transactionalEntityManager.getRepository(Product);

        // Security Recalculation: Do not trust frontend totals.
        let serverTotal = 0;
        const enrichedItems: any[] = [];

        for (const item of items) {
          const product = await productRepo.findOneBy({ id: item.productId });
          if (!product || !product.isActive) {
            throw new Error(`Product not found or unavailable: ${item.productId}`);
          }
          // ── Security Update: Inventory constraints & Stock Decrement ────────
          if (product.stock < item.quantity) {
            throw new Error(`Insufficient stock for product: ${product.name}. Available: ${product.stock}`);
          }
          product.stock -= item.quantity;
          if (product.stock <= 0) product.inStock = false;
          await productRepo.save(product);

          const linePrice = Number(product.price) * item.quantity;
          serverTotal += linePrice;
          enrichedItems.push({ ...item, price: Number(product.price) });
        }

        // We passed discount from frontend to identify coupon value. Ideally coupon logic should भी server side completely,
        // but for now we accept the discount value passed if it exists, but recalculation is ideal if doing complete refactor. 
        // ── Security Check: Calculate discount securely from DB ───────────────
        let actualDiscountPercentage = 0;
        if (couponCode) {
          const couponRepo = transactionalEntityManager.getRepository(Coupon);
          const coupon = await couponRepo.findOneBy({ code: couponCode, isActive: true });
          if (coupon && coupon.validFrom <= new Date() && coupon.validUntil >= new Date()) {
             if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
                 throw new Error('Coupon usage limit reached');
             }
             actualDiscountPercentage = coupon.discount;
             coupon.usedCount += 1;
             await couponRepo.save(coupon);
          }
        }
        
        const finalServerTotal = serverTotal - Math.round((serverTotal * actualDiscountPercentage) / 100);
        const safeDiscount = Math.round((serverTotal * actualDiscountPercentage) / 100);

        const newOrderInfo = orderRepo.create({
            orderId,
            userId: user.id,
            total: finalServerTotal,
            originalTotal: serverTotal,
            discount: safeDiscount,
            couponCode,
            paymentMethod,
            status: 'Pending',
            trackingNumber,
            customerName: customerInfo.name,
            customerEmail: customerInfo.email,
            customerPhone: customerInfo.phone,
            customerAddress: customerInfo.address,
            customerCity: customerInfo.city,
            customerPincode: customerInfo.pincode,
            items: enrichedItems.map(item => orderItemRepo.create({
                productId: item.productId,
                quantity: item.quantity,
                size: item.selectedSize || item.size || '',
                color: item.selectedColor || item.color,
                price: item.price,
            }))
        });

        const savedOrder = await orderRepo.save(newOrderInfo);



        // Create admin notification
        const notificationRepo = transactionalEntityManager.getRepository(Notification);
        await notificationRepo.save({
            title: 'New Order Received',
            message: `New order ${savedOrder.orderId} placed by ${customerInfo.name} for ₹${savedOrder.total}.`,
            type: 'NEW_ORDER',
            link: `/admin/orders/${savedOrder.orderId}`
        });

        return savedOrder;
      });

      if (!createdOrder) {
        throw new Error('Order creation failed');
      }

      // We reload it outside the transaction because we want to load relations with external non-transactional repos safely, or just re-fetch
      const orderRepo = AppDataSource.getRepository(Order);
      const order = await orderRepo.findOne({
        where: { id: createdOrder.id },
        relations: ['items', 'items.product']
      }) as Order;

      try {
        await sendEmail({
            email: customerInfo.email,
            subject: 'Order Confirmation - Indhumathi Garments',
            message: `Thank you for your order! \n\n Order ID: ${order.orderId} \n Total: ₹${order.total} \n\n We will notify you when your order is shipped.`
        });
      } catch (emailError) {
        console.error('Failed to send order confirmation email:', emailError);
      }

      return reply.status(201).send(mapOrder(order));
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update order status
  app.patch('/:orderId/status', {
    schema: {
      params: z.object({ orderId: z.string() }),
      body: z.object({ status: z.string() })
    }
  }, async (request, reply) => {
    try {
      const { orderId } = request.params as any;
      const { status } = request.body as any;
      const user = (request as any).user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
         return reply.status(403).send({ error: 'Not authorized' });
      }

      const orderRepo = AppDataSource.getRepository(Order);
      const existingOrder = await orderRepo.findOne({
        where: { orderId },
        relations: ['items', 'items.product']
      });

      if (!existingOrder) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      existingOrder.status = status;
      await orderRepo.save(existingOrder);
      const order = existingOrder;

      const auditRepo = AppDataSource.getRepository(AuditLog);
      await auditRepo.save({
          adminId: user.id,
          adminEmail: user.email,
          action: 'UPDATE_ORDER_STATUS',
          entityType: 'ORDER',
          entityId: order.orderId,
          details: JSON.stringify({ newStatus: status })
      });

      return reply.send(mapOrder(order));
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Customer cancel order (< 24 hours & Pending)
  app.post('/:orderId/cancel', {
    schema: {
      params: z.object({ orderId: z.string() }),
      body: z.object({ reason: z.string().optional() })
    }
  }, async (request, reply) => {
    try {
      const { orderId } = request.params as any;
      const { reason } = (request.body || {}) as any;
      const user = (request as any).user;

      const orderRepo = AppDataSource.getRepository(Order);
      const existingOrder = await orderRepo.findOne({
        where: { orderId },
        relations: ['items', 'items.product']
      });

      if (!existingOrder) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      // Check ownership
      if (user.role !== 'admin' && user.role !== 'super_admin' && existingOrder.userId && existingOrder.userId !== user.id) {
         return reply.status(403).send({ error: 'Not authorized to cancel this order' });
      }

      if (existingOrder.status !== 'Pending') {
         return reply.status(400).send({ error: 'Only pending orders can be cancelled' });
      }

      // Check 24 hour limit
      const orderDate = new Date(existingOrder.orderDate).getTime();
      const now = new Date().getTime();
      const hours24 = 24 * 60 * 60 * 1000;
      
      if (now - orderDate > hours24 && user.role !== 'admin' && user.role !== 'super_admin') {
         return reply.status(400).send({ error: 'Order cannot be cancelled after 24 hours' });
      }

      existingOrder.status = 'Cancelled';
      if (reason) {
        existingOrder.cancelReason = reason;
      }
      await orderRepo.save(existingOrder);

      const auditRepo = AppDataSource.getRepository(AuditLog);
      await auditRepo.save({
          adminId: user.id, // Using user details even if customer
          adminEmail: user.email,
          action: 'CANCEL_ORDER',
          entityType: 'ORDER',
          entityId: existingOrder.orderId,
          details: JSON.stringify({ cancelledBy: user.role, reason: reason || 'Customer 24h Cancel' })
      });

      return reply.send(mapOrder(existingOrder));
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update order delay
  app.patch('/:orderId/delay', {
    schema: {
      params: z.object({ orderId: z.string() }),
      body: z.object({ 
        delayedDeliveryDate: z.string().nullable(), 
        delayReason: z.string().nullable()
      })
    }
  }, async (request, reply) => {
    try {
      const { orderId } = request.params as any;
      const { delayedDeliveryDate, delayReason } = request.body as any;
      const user = (request as any).user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
         return reply.status(403).send({ error: 'Not authorized' });
      }

      const orderRepo = AppDataSource.getRepository(Order);
      const existingOrder = await orderRepo.findOne({
        where: { orderId },
        relations: ['items', 'items.product']
      });

      if (!existingOrder) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      existingOrder.delayedDeliveryDate = delayedDeliveryDate ? new Date(delayedDeliveryDate) : null;
      existingOrder.delayReason = delayReason || null;
      await orderRepo.save(existingOrder);

      const auditRepo = AppDataSource.getRepository(AuditLog);
      await auditRepo.save({
          adminId: user.id,
          adminEmail: user.email,
          action: 'UPDATE_ORDER_DELAY',
          entityType: 'ORDER',
          entityId: existingOrder.orderId,
          details: JSON.stringify({ delayedDeliveryDate, delayReason })
      });

      return reply.send(mapOrder(existingOrder));
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Request order return
  app.post('/:orderId/return', {
    schema: {
      params: z.object({ orderId: z.string() }),
      body: z.object({ 
        reason: z.string().min(5),
        images: z.array(z.string()).optional()
      })
    }
  }, async (request, reply) => {
    try {
      const { orderId } = request.params as any;
      const { reason, images } = request.body as any;
      const user = (request as any).user;

      const orderRepo = AppDataSource.getRepository(Order);
      const order = await orderRepo.findOne({ where: { orderId, userId: user.id } });

      if (!order) return reply.status(404).send({ error: 'Order not found' });
      if (order.status !== 'Delivered') return reply.status(400).send({ error: 'Only delivered orders can be returned' });

      const returnRepo = AppDataSource.getRepository(ReturnRequest);
      const existingReturn = await returnRepo.findOne({ where: { orderId: order.orderId } });
      if (existingReturn) return reply.status(400).send({ error: 'Return already requested for this order' });

      const newReturn = returnRepo.create({
          orderId: order.orderId,
          userId: user.id,
          reason,
          images: images || [],
          status: 'Pending'
      });
      await returnRepo.save(newReturn);

      // Create admin notification
      const notificationRepo = AppDataSource.getRepository(Notification);
      await notificationRepo.save({
          title: 'New Return Request',
          message: `Customer requested a return for order ${order.orderId}`,
          type: 'RETURN_REQUEST',
          link: `/admin/returns`
      });

      return reply.status(201).send(newReturn);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
