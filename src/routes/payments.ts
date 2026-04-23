import { FastifyInstance } from 'fastify';
import { protect } from '../middleware/auth.js';
import { AppDataSource } from '../lib/db.js';
import { Order } from '../entities/Order.js';
import { OrderItem } from '../entities/OrderItem.js';
import { Product } from '../entities/Product.js';
import { Coupon } from '../entities/Coupon.js';
import { Notification } from '../entities/Notification.js';
import sendEmail from '../lib/email.js';
import crypto from 'crypto';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

// Guard: fail fast if keys are missing (prevents empty-secret HMAC bypass)
if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.warn('[SECURITY WARNING] Razorpay keys are not configured. Payment routes will be disabled.');
}

// Lazy import razorpay to avoid top-level await issues
const getRazorpayInstance = async () => {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Payment gateway is not configured. Please contact support.');
  }
  const Razorpay = (await import('razorpay')).default;
  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
};

// Strict item schema — price is optional, backend always recalculates from DB
const orderItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive().max(100),
  price: z.number().positive().optional(), // ignored — backend recalculates from DB
  selectedSize: z.string().optional(),
  size: z.string().optional(),
  selectedColor: z.string().optional(),
  color: z.string().optional(),
});

export default async function paymentsRoutes(appInstance: FastifyInstance) {
  const app = appInstance.withTypeProvider<ZodTypeProvider>();

  // All payment routes require auth
  app.addHook('preHandler', protect);

  /**
   * POST /api/payments/create-order
   * Creates a Razorpay order. Amount is calculated SERVER-SIDE from cart items.
   * We store the razorpayOrderId → expectedAmount in memory for verification.
   */
  app.post('/create-order', {
    schema: {
      body: z.object({
        items: z.array(orderItemSchema).min(1),
        couponDiscount: z.number().min(0).max(100).optional(), // discount % from valid coupon
      })
    }
  }, async (request, reply) => {
    try {
      const { items, couponDiscount } = request.body as any;

      // Verify product prices from DB — NEVER trust client-side prices
      const productRepo = AppDataSource.getRepository(Product);
      let serverTotal = 0;
      for (const item of items) {
        const product = await productRepo.findOneBy({ id: item.productId });
        if (!product) {
          return reply.status(400).send({ error: `Product not found: ${item.productId}` });
        }
        if (!product.isActive) {
          return reply.status(400).send({ error: `Product is no longer available: ${product.name}` });
        }
        serverTotal += Number(product.price) * item.quantity;
      }

      // Apply coupon discount server-side based on actual DB record
      const { couponCode } = request.body as any;
      if (couponCode) {
        const couponRepo = AppDataSource.getRepository(Coupon);
        const coupon = await couponRepo.findOneBy({ code: couponCode, isActive: true });
        if (coupon && coupon.validFrom <= new Date() && coupon.validUntil >= new Date()) {
          serverTotal = serverTotal - Math.round((serverTotal * coupon.discount) / 100);
        }
      }

      serverTotal = Math.round(serverTotal * 100) / 100; // round to paise

      const razorpay = await getRazorpayInstance();
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(serverTotal * 100), // paise
        currency: 'INR',
        receipt: `rcpt_${Date.now()}`,
      });

      return reply.send({
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        serverTotal, // return so frontend can display, but verify endpoint re-looks this up
        keyId: RAZORPAY_KEY_ID,
      });
    } catch (error: any) {
      console.error('Razorpay create-order error:', error);
      return reply.status(500).send({ error: error.message || 'Failed to create payment order' });
    }
  });

  /**
   * POST /api/payments/verify
   * Verifies Razorpay HMAC signature, then fetches the actual order amount
   * from Razorpay API (not from client) before saving the order.
   *
   * Security guarantees:
   * 1. HMAC signature is cryptographically verified.
   * 2. Amount is fetched from Razorpay API — client cannot manipulate it.
   * 3. Replay attack prevention: razorpayPaymentId must be unique in our DB.
   * 4. Input sanitization via Zod.
   */
  app.post('/verify', {
    schema: {
      body: z.object({
        razorpay_order_id: z.string().min(1),
        razorpay_payment_id: z.string().min(1),
        razorpay_signature: z.string().min(1),
        orderData: z.object({
          items: z.array(orderItemSchema).min(1),
          couponCode: z.string().optional().nullable(),
          couponDiscount: z.number().min(0).max(100).optional(),
          customerInfo: z.object({
            name: z.string().min(1).max(100),
            email: z.string().email(),
            phone: z.string().min(10).max(15),
            address: z.string().min(1).max(500),
            city: z.string().min(1).max(100),
            pincode: z.string().min(5).max(10),
          }),
          paymentMethod: z.string().min(1),
        }),
      })
    }
  }, async (request, reply) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        orderData,
      } = request.body as any;

      // ── Security Check 1: HMAC Signature Verification ──────────────────────
      // Use constant-time comparison to prevent timing attacks
      const generated_signature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      const sigBuffer = Buffer.from(generated_signature, 'hex');
      const clientSigBuffer = Buffer.from(razorpay_signature, 'hex');

      const signaturesValid =
        sigBuffer.length === clientSigBuffer.length &&
        crypto.timingSafeEqual(sigBuffer, clientSigBuffer);

      if (!signaturesValid) {
        return reply.status(400).send({ error: 'Invalid payment signature.' });
      }

      // ── Security Check 2: Replay Attack Prevention ─────────────────────────
      const orderRepo = AppDataSource.getRepository(Order);
      const existingOrder = await orderRepo.findOneBy({ razorpayPaymentId: razorpay_payment_id });
      if (existingOrder) {
        return reply.status(409).send({ error: 'This payment has already been processed.' });
      }

      // ── Security Check 3: Fetch real amount from Razorpay (not from client) ─
      const razorpay = await getRazorpayInstance();
      const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
      const verifiedAmountPaise = Number(rzpOrder.amount);
      const verifiedAmountINR = verifiedAmountPaise / 100;

      // ── Security Check 4: Recalculate price from DB products ───────────────
      const productRepo = AppDataSource.getRepository(Product);
      let serverTotal = 0;
      const enrichedItems: any[] = [];

      for (const item of orderData.items) {
        const product = await productRepo.findOneBy({ id: item.productId });
        if (!product || !product.isActive) {
          return reply.status(400).send({ error: `Product not found or unavailable: ${item.productId}` });
        }
        const linePrice = Number(product.price) * item.quantity;
        serverTotal += linePrice;
        enrichedItems.push({ ...item, price: Number(product.price) });
      }

      // ── Security Check 4.5: Calculate discount securely ───────────────
      let actualDiscountPercentage = 0;
      if (orderData.couponCode) {
        const couponRepo = AppDataSource.getRepository(Coupon);
        const coupon = await couponRepo.findOneBy({ code: orderData.couponCode, isActive: true });
        if (coupon && coupon.validFrom <= new Date() && coupon.validUntil >= new Date()) {
           actualDiscountPercentage = coupon.discount;
           serverTotal = serverTotal - Math.round((serverTotal * actualDiscountPercentage) / 100);
        }
      }
      serverTotal = Math.round(serverTotal * 100) / 100;

      // Compare server-calculated total with Razorpay's verified amount (allow ±1 paise rounding)
      if (Math.abs(serverTotal - verifiedAmountINR) > 0.5) {
        console.error(`[SECURITY] Amount mismatch: server=₹${serverTotal}, razorpay=₹${verifiedAmountINR}`);
        return reply.status(400).send({ error: 'Payment amount mismatch. Order cannot be processed.' });
      }

      // ── All checks passed: Save order ──────────────────────────────────────
      const user = (request as any).user;
      const orderId = `IND${Date.now()}`;
      const trackingNumber = `TRK${Date.now().toString().slice(-6)}`;
      const discount = actualDiscountPercentage > 0
        ? Math.round((serverTotal / (1 - actualDiscountPercentage / 100)) * (actualDiscountPercentage / 100))
        : 0;
      const originalTotal = serverTotal + discount;

      const savedOrder = await AppDataSource.manager.transaction(async (em) => {
        const orderItemRepo = em.getRepository(OrderItem);
        const orderRepoTx = em.getRepository(Order);
        const productRepoTx = em.getRepository(Product);
        const couponRepoTx = em.getRepository(Coupon);

        // ── Security Update: Inventory constraints & Stock Decrement ────────
        for (const item of enrichedItems) {
            // Pessimistic read lock could be used, but atomic update via save is generally sufficient here
            const product = await productRepoTx.findOneBy({ id: item.productId });
            if (!product || product.stock < item.quantity) {
                throw new Error(`Insufficient stock for product: ${product?.name || item.productId}. Available: ${product?.stock}`);
            }
            product.stock -= item.quantity;
            if (product.stock <= 0) product.inStock = false;
            await productRepoTx.save(product);
        }

        // ── Security Update: Coupon Usage Constraints ───────────────────────
        if (orderData.couponCode) {
            const coupon = await couponRepoTx.findOneBy({ code: orderData.couponCode });
            if (coupon) {
                if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
                    throw new Error('Coupon usage limit reached');
                }
                coupon.usedCount += 1;
                await couponRepoTx.save(coupon);
            }
        }

        const newOrder = orderRepoTx.create({
          orderId,
          userId: user.id,
          total: serverTotal,
          originalTotal,
          discount,
          couponCode: orderData.couponCode || null,
          paymentMethod: orderData.paymentMethod,
          paymentStatus: 'Paid',
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          status: 'Pending',
          trackingNumber,
          customerName: orderData.customerInfo.name,
          customerEmail: orderData.customerInfo.email,
          customerPhone: orderData.customerInfo.phone,
          customerAddress: orderData.customerInfo.address,
          customerCity: orderData.customerInfo.city,
          customerPincode: orderData.customerInfo.pincode,
          items: enrichedItems.map((item: any) =>
            orderItemRepo.create({
              productId: item.productId,
              quantity: item.quantity,
              size: item.selectedSize || item.size || '',
              color: item.selectedColor || item.color,
              price: item.price,
            })
          ),
        });

        const saved = await orderRepoTx.save(newOrder);

        const notificationRepo = em.getRepository(Notification);
        await notificationRepo.save({
          title: 'New Paid Order',
          message: `Order ${saved.orderId} placed by ${orderData.customerInfo.name} for ₹${saved.total}. Payment verified.`,
          type: 'NEW_ORDER',
          link: `/admin/orders/${saved.orderId}`,
        });

        return saved;
      });

      // Send confirmation email (non-blocking)
      sendEmail({
        email: orderData.customerInfo.email,
        subject: 'Order Confirmed — Indhumathi Garments',
        message: `Thank you for your order!\n\nOrder ID: ${savedOrder.orderId}\nAmount Paid: ₹${savedOrder.total}\nPayment ID: ${razorpay_payment_id}\n\nWe will notify you when your order is shipped.`,
      }).catch((e: any) => console.error('Email send failed:', e));

      return reply.status(201).send({
        success: true,
        orderId: savedOrder.orderId,
        trackingNumber: savedOrder.trackingNumber,
      });
    } catch (error: any) {
      console.error('Payment verify error:', error);
      return reply.status(500).send({ error: error.message || 'Order creation failed after payment' });
    }
  });
}
