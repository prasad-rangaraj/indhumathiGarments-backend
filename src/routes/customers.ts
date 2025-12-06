import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Get customer profile
router.get('/profile/:userId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update customer profile
router.patch('/profile/:userId', async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { name, phone },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer addresses
router.get('/addresses/:userId', async (req, res) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.params.userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json(addresses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create address
router.post('/addresses', async (req, res) => {
  try {
    const { userId, name, phone, address, city, pincode, state, country, isDefault, addressType } = req.body;

    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const newAddress = await prisma.address.create({
      data: {
        userId,
        name,
        phone,
        address,
        city,
        pincode,
        state,
        country: country || 'India',
        isDefault: isDefault || false,
        addressType: addressType || 'home',
      },
    });

    res.status(201).json(newAddress);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update address
router.patch('/addresses/:id', async (req, res) => {
  try {
    const { isDefault, ...updateData } = req.body;

    // If setting as default, unset other defaults
    if (isDefault) {
      const address = await prisma.address.findUnique({
        where: { id: req.params.id },
        select: { userId: true },
      });

      if (address) {
        await prisma.address.updateMany({
          where: { userId: address.userId, id: { not: req.params.id } },
          data: { isDefault: false },
        });
      }
    }

    const updatedAddress = await prisma.address.update({
      where: { id: req.params.id },
      data: { ...updateData, isDefault },
    });

    res.json(updatedAddress);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete address
router.delete('/addresses/:id', async (req, res) => {
  try {
    await prisma.address.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Address deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer orders
router.get('/orders/:userId', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.params.userId },
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

export default router;


