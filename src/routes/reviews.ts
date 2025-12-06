import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Get reviews for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: {
        productId: req.params.productId,
        isApproved: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(reviews);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create review
router.post('/', async (req, res) => {
  try {
    const { productId, userId, name, rating, title, content } = req.body;

    const review = await prisma.review.create({
      data: {
        productId,
        userId: userId || null,
        name,
        rating: parseInt(rating),
        title,
        content,
        isApproved: false, // Admin needs to approve
      },
    });

    res.status(201).json(review);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;



