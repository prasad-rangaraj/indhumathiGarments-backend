import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Get cart items
router.get('/:userId', async (req, res) => {
  try {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.params.userId },
      include: {
        product: true,
      },
    });

    res.json(cartItems.map(item => ({
      ...item,
      product: {
        ...item.product,
        price: Number(item.product.price),
        sizes: JSON.parse(item.product.sizes || '[]'),
      },
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add to cart
router.post('/', async (req, res) => {
  try {
    const { userId, productId, quantity, size, color } = req.body;

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        userId,
        productId,
        size,
        color: color || null,
      },
    });

    let cartItem;
    if (existingItem) {
      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
        include: { product: true },
      });
    } else {
      cartItem = await prisma.cartItem.create({
        data: {
          userId,
          productId,
          quantity,
          size,
          color,
        },
        include: { product: true },
      });
    }

    res.status(201).json({
      ...cartItem,
      product: {
        ...cartItem.product,
        price: Number(cartItem.product.price),
        sizes: JSON.parse(cartItem.product.sizes || '[]'),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update cart item
router.patch('/:id', async (req, res) => {
  try {
    const { quantity } = req.body;

    const cartItem = await prisma.cartItem.update({
      where: { id: req.params.id },
      data: { quantity },
      include: { product: true },
    });

    res.json({
      ...cartItem,
      product: {
        ...cartItem.product,
        price: Number(cartItem.product.price),
        sizes: JSON.parse(cartItem.product.sizes || '[]'),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remove from cart
router.delete('/:id', async (req, res) => {
  try {
    await prisma.cartItem.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Item removed from cart' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Clear cart
router.delete('/user/:userId', async (req, res) => {
  try {
    await prisma.cartItem.deleteMany({
      where: { userId: req.params.userId },
    });

    res.json({ message: 'Cart cleared' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;



