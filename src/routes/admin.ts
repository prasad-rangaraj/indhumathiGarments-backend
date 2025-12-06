import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [totalProducts, totalOrders, totalCustomers, orders] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.user.count({ where: { role: 'customer' } }),
      prisma.order.findMany({
        where: {
          orderDate: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
          },
        },
        select: {
          total: true,
          orderDate: true,
        },
      }),
    ]);

    // Calculate revenue by month
    const revenueData = orders.reduce((acc: any, order) => {
      const month = new Date(order.orderDate).toLocaleString('default', { month: 'short' });
      if (!acc[month]) {
        acc[month] = { revenue: 0, orders: 0 };
      }
      acc[month].revenue += Number(order.total);
      acc[month].orders += 1;
      return acc;
    }, {});

    // Get category distribution
    const categoryData = await prisma.product.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: true,
    });

    res.json({
      totalRevenue: orders.reduce((sum, o) => sum + Number(o.total), 0),
      totalOrders,
      totalCustomers,
      totalProducts,
      revenueData: Object.entries(revenueData).map(([name, data]: [string, any]) => ({
        name,
        revenue: data.revenue,
        orders: data.orders,
      })),
      categoryData: categoryData.map(c => ({
        name: c.category,
        value: c._count,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all products (admin)
router.get('/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(products.map(product => ({
      ...product,
      price: Number(product.price),
      sizes: JSON.parse(product.sizes || '[]'),
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create product
router.post('/products', async (req, res) => {
  try {
    const { name, description, price, image, material, category, subcategory, sizes, stock, isActive } = req.body;
    
    const product = await prisma.product.create({
      data: {
        name,
        description,
        price,
        image: image || null,
        material: material || 'Cotton',
        category,
        subcategory,
        sizes: JSON.stringify(sizes || []),
        stock: stock || 0,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    res.status(201).json({
      ...product,
      price: Number(product.price),
      sizes: JSON.parse(product.sizes || '[]'),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update product
router.patch('/products/:id', async (req, res) => {
  try {
    const updateData: any = {};
    if (req.body.sizes) updateData.sizes = JSON.stringify(req.body.sizes);
    if (req.body.price !== undefined) updateData.price = req.body.price;
    if (req.body.stock !== undefined) updateData.stock = req.body.stock;
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.image !== undefined) updateData.image = req.body.image;
    if (req.body.material) updateData.material = req.body.material;
    if (req.body.category) updateData.category = req.body.category;
    if (req.body.subcategory) updateData.subcategory = req.body.subcategory;
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({
      ...product,
      price: Number(product.price),
      sizes: JSON.parse(product.sizes || '[]'),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete product
router.delete('/products/:id', async (req, res) => {
  try {
    await prisma.product.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all customers
router.get('/customers', async (req, res) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: 'customer' },
      include: {
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate total spent for each customer
    const customersWithStats = await Promise.all(
      customers.map(async (customer) => {
        const orders = await prisma.order.findMany({
          where: { userId: customer.id },
          select: { total: true },
        });

        const totalSpent = orders.reduce((sum, o) => sum + Number(o.total), 0);
        const lastOrder = await prisma.order.findFirst({
          where: { userId: customer.id },
          orderBy: { orderDate: 'desc' },
          select: { orderDate: true },
        });

        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          totalOrders: customer._count.orders,
          totalSpent,
          lastOrderDate: lastOrder?.orderDate.toISOString() || null,
          status: customer.isActive ? 'active' : 'inactive',
        };
      })
    );

    res.json(customersWithStats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all orders (admin)
router.get('/orders', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
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

// Get all reviews (admin)
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(reviews);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update review approval
router.patch('/reviews/:id', async (req, res) => {
  try {
    const { isApproved } = req.body;
    const review = await prisma.review.update({
      where: { id: req.params.id },
      data: { isApproved },
    });

    res.json(review);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all enquiries
router.get('/enquiries', async (req, res) => {
  try {
    const enquiries = await prisma.enquiry.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(enquiries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update enquiry status
router.patch('/enquiries/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const enquiry = await prisma.enquiry.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json(enquiry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all banners
router.get('/banners', async (req, res) => {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: { order: 'asc' },
    });

    res.json(banners);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create banner
router.post('/banners', async (req, res) => {
  try {
    const { title, description, image, link, position, isActive, order } = req.body;
    const banner = await prisma.banner.create({
      data: {
        title,
        description,
        image,
        link,
        position: position || 'hero',
        isActive: isActive !== undefined ? isActive : true,
        order: order || 0,
      },
    });

    res.status(201).json(banner);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update banner
router.patch('/banners/:id', async (req, res) => {
  try {
    const banner = await prisma.banner.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json(banner);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete banner
router.delete('/banners/:id', async (req, res) => {
  try {
    await prisma.banner.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Banner deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all coupons
router.get('/coupons', async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(coupons.map(coupon => ({
      ...coupon,
      discount: Number(coupon.discount),
      minAmount: coupon.minAmount ? Number(coupon.minAmount) : null,
      maxDiscount: coupon.maxDiscount ? Number(coupon.maxDiscount) : null,
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create coupon
router.post('/coupons', async (req, res) => {
  try {
    const { code, discount, minAmount, maxDiscount, validFrom, validUntil, isActive, usageLimit } = req.body;
    const coupon = await prisma.coupon.create({
      data: {
        code,
        discount,
        minAmount: minAmount || null,
        maxDiscount: maxDiscount || null,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        isActive: isActive !== undefined ? isActive : true,
        usageLimit: usageLimit || null,
      },
    });

    res.status(201).json({
      ...coupon,
      discount: Number(coupon.discount),
      minAmount: coupon.minAmount ? Number(coupon.minAmount) : null,
      maxDiscount: coupon.maxDiscount ? Number(coupon.maxDiscount) : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update coupon
router.patch('/coupons/:id', async (req, res) => {
  try {
    const coupon = await prisma.coupon.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json({
      ...coupon,
      discount: Number(coupon.discount),
      minAmount: coupon.minAmount ? Number(coupon.minAmount) : null,
      maxDiscount: coupon.maxDiscount ? Number(coupon.maxDiscount) : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete coupon
router.delete('/coupons/:id', async (req, res) => {
  try {
    await prisma.coupon.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Coupon deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update customer status
router.patch('/customers/:id', async (req, res) => {
  try {
    const { isActive } = req.body;
    const customer = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
      },
    });

    res.json({
      ...customer,
      status: customer.isActive ? 'active' : 'inactive',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


