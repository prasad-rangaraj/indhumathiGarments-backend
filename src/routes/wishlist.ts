import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Get wishlist items
router.get('/:userId', async (req, res) => {
  try {
    const wishlistItems = await prisma.wishlistItem.findMany({
      where: { userId: req.params.userId },
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(wishlistItems.map(item => ({
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

// Add to wishlist
router.post('/', async (req, res) => {
  try {
    const { userId, productId } = req.body;

    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        userId,
        productId,
      },
      include: {
        product: true,
      },
    });

    res.status(201).json({
      ...wishlistItem,
      product: {
        ...wishlistItem.product,
        price: Number(wishlistItem.product.price),
        sizes: JSON.parse(wishlistItem.product.sizes || '[]'),
      },
    });
  } catch (error: any) {
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Product already in wishlist' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Remove from wishlist
router.delete('/:userId/:productId', async (req, res) => {
  try {
    await prisma.wishlistItem.deleteMany({
      where: {
        userId: req.params.userId,
        productId: req.params.productId,
      },
    });

    res.json({ message: 'Item removed from wishlist' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;



