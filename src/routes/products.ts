import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Get all products
router.get('/', async (req, res) => {
  try {
    const { category, subcategory, search, minPrice, maxPrice, page = '1', limit = '20' } = req.query;
    
    const where: any = {
      isActive: true,
    };

    if (category) {
      where.category = category as string;
    }

    if (subcategory) {
      where.subcategory = subcategory as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice as string);
      if (maxPrice) where.price.lte = parseFloat(maxPrice as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    // Parse sizes JSON
    const productsWithParsedSizes = products.map(product => ({
      ...product,
      sizes: JSON.parse(product.sizes || '[]'),
      price: Number(product.price),
    }));

    res.json({
      products: productsWithParsedSizes,
      total,
      page: parseInt(page as string),
      limit: take,
      totalPages: Math.ceil(total / take),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        reviews: {
          where: { isApproved: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      ...product,
      sizes: JSON.parse(product.sizes || '[]'),
      price: Number(product.price),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        category: true,
        subcategory: true,
      },
      distinct: ['category', 'subcategory'],
    });

    const categoryMap: Record<string, string[]> = {};
    categories.forEach(({ category, subcategory }) => {
      if (!categoryMap[category]) {
        categoryMap[category] = [];
      }
      if (subcategory && !categoryMap[category].includes(subcategory)) {
        categoryMap[category].push(subcategory);
      }
    });

    res.json(categoryMap);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;



