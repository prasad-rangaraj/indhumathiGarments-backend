import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Get all orders (for a user or admin)
router.get('/', async (req, res) => {
  try {
    const { userId, status } = req.query;
    
    const where: any = {};
    if (userId) where.userId = userId as string;
    if (status) where.status = status as string;

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { orderDate: 'desc' },
    });

    res.json(orders.map(order => ({
      ...order,
      total: Number(order.total),
      originalTotal: order.originalTotal ? Number(order.originalTotal) : null,
      discount: order.discount ? Number(order.discount) : null,
      items: order.items.map(item => ({
        ...item,
        price: Number(item.price),
        product: {
          ...item.product,
          price: Number(item.product.price),
          sizes: JSON.parse(item.product.sizes || '[]'),
        },
      })),
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get order by ID
router.get('/:orderId', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderId: req.params.orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      ...order,
      total: Number(order.total),
      originalTotal: order.originalTotal ? Number(order.originalTotal) : null,
      discount: order.discount ? Number(order.discount) : null,
      items: order.items.map(item => ({
        ...item,
        price: Number(item.price),
        product: {
          ...item.product,
          price: Number(item.product.price),
          sizes: JSON.parse(item.product.sizes || '[]'),
        },
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create order
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      items,
      total,
      originalTotal,
      discount,
      couponCode,
      paymentMethod,
      customerInfo,
    } = req.body;

    const orderId = `IND${Date.now()}`;
    const trackingNumber = `TRK${Date.now().toString().slice(-6)}`;

    const order = await prisma.order.create({
      data: {
        orderId,
        userId: userId || null,
        total,
        originalTotal,
        discount,
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
        items: {
          create: items.map((item: any) => ({
            productId: item.productId || item.id,
            quantity: item.quantity,
            size: item.selectedSize || item.size,
            color: item.selectedColor || item.color,
            price: item.price,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Update product stock
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId || item.id },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });
    }

    res.status(201).json({
      ...order,
      total: Number(order.total),
      originalTotal: order.originalTotal ? Number(order.originalTotal) : null,
      discount: order.discount ? Number(order.discount) : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status
router.patch('/:orderId/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const order = await prisma.order.update({
      where: { orderId: req.params.orderId },
      data: { status },
    });

    res.json({
      ...order,
      total: Number(order.total),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;



