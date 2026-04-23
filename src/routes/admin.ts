import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../lib/db.js';
import { Category } from '../entities/Category.js';
import { Product } from '../entities/Product.js';
import { Order } from '../entities/Order.js';
import { User } from '../entities/User.js';
import { Review } from '../entities/Review.js';
import { Enquiry } from '../entities/Enquiry.js';
import { Banner } from '../entities/Banner.js';
import { Coupon } from '../entities/Coupon.js';
import { AuditLog } from '../entities/AuditLog.js';
import { Notification } from '../entities/Notification.js';
import { ReturnRequest } from '../entities/ReturnRequest.js';
import { protect, admin } from '../middleware/auth.js';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { categorySchema, productSchema } from '../lib/validators.js';
import { z } from 'zod';

export default async function adminRoutes(appInstance: FastifyInstance) {
  const app = appInstance.withTypeProvider<ZodTypeProvider>();

  // Most routes in admin routes are generic, some might need auth
  // Let's add auth for all admin routes, as these are typically protected
  app.addHook('preHandler', protect);
  app.addHook('preHandler', admin);

  // Dashboard stats
  app.get('/dashboard', async (request, reply) => {
    try {
      const { range } = request.query as { range?: string };
      const { MoreThanOrEqual, Between } = await import('typeorm');

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      // Determine date range for charts
      let rangeStart: Date;
      if (range === 'today') rangeStart = todayStart;
      else if (range === 'week') { rangeStart = new Date(); rangeStart.setDate(rangeStart.getDate() - 7); }
      else if (range === 'month') { rangeStart = new Date(); rangeStart.setMonth(rangeStart.getMonth() - 1); }
      else rangeStart = sixMonthsAgo; // default: 6 months

      const productRepo = AppDataSource.getRepository(Product);
      const orderRepo = AppDataSource.getRepository(Order);
      const userRepo = AppDataSource.getRepository(User);

      const [totalProducts, totalOrders, totalCustomers, allOrders, todayOrders, rangeOrders] = await Promise.all([
        productRepo.count({ where: { isActive: true } }),
        orderRepo.count(),
        userRepo.count({ where: { role: 'customer' } }),
        orderRepo.find({ select: ['total', 'orderDate'] }),
        orderRepo.find({ where: { orderDate: MoreThanOrEqual(todayStart) }, select: ['total', 'orderDate'] }),
        orderRepo.find({ where: { orderDate: MoreThanOrEqual(rangeStart) }, select: ['total', 'orderDate'] }),
      ]);

      const totalRevenue = allOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const todayOrderCount = todayOrders.length;

      // Low stock count using raw query
      const lowStockResult = await productRepo.createQueryBuilder('product')
        .where('product.isActive = :isActive', { isActive: true })
        .andWhere('product.stock < :threshold', { threshold: 10 })
        .getCount()
        .catch(async () => {
          // fallback: try inStock field
          return productRepo.count({ where: { isActive: true, inStock: false } }).catch(() => 0);
        });
      const lowStockCount = lowStockResult;

      // Top 5 selling products by order count
      const topProductsRaw = await orderRepo.createQueryBuilder('order')
        .leftJoin('order.items', 'item')
        .leftJoin('item.product', 'product')
        .select('product.name', 'name')
        .addSelect('SUM(item.quantity)', 'sold')
        .groupBy('product.id')
        .orderBy('sold', 'DESC')
        .limit(5)
        .getRawMany()
        .catch(() => []);

      // Category distribution
      const categoryAgg = await productRepo.createQueryBuilder('product')
        .select('product.category', 'category')
        .addSelect('COUNT(product.id)', '_count')
        .where('product.isActive = :isActive', { isActive: true })
        .groupBy('product.category')
        .getRawMany();

      // Revenue by month/day depending on range
      const revenueMap: any = {};
      rangeOrders.forEach(order => {
        const key = range === 'today'
          ? `${order.orderDate.getHours()}:00`
          : order.orderDate.toLocaleString('default', { month: 'short', day: 'numeric' }).replace(/ /g, ' ');
        if (!revenueMap[key]) revenueMap[key] = { revenue: 0, orders: 0 };
        revenueMap[key].revenue += Number(order.total);
        revenueMap[key].orders += 1;
      });

      const recentOrdersRaw = await orderRepo.find({
        order: { orderDate: 'DESC' },
        take: 5,
        relations: ['items', 'items.product']
      });

      return reply.send({
        totalRevenue,
        todayRevenue,
        todayOrders: todayOrderCount,
        totalOrders,
        totalCustomers,
        totalProducts,
        lowStockCount,
        topProducts: topProductsRaw.map((p: any) => ({ name: p.name || 'Unknown', sold: Number(p.sold) })),
        revenueData: Object.entries(revenueMap).map(([name, data]: [string, any]) => ({
          name,
          revenue: data.revenue,
          orders: data.orders,
        })),
        categoryData: categoryAgg.map((c: any) => ({
          name: c.category,
          value: Number(c._count),
        })),
        recentOrders: recentOrdersRaw.map(o => ({
          ...o,
          total: Number(o.total),
          items: (o.items || []).map(i => ({
            ...i,
            price: Number(i.price)
          }))
        }))
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });


  // Get all categories
  app.get('/categories', async (request, reply) => {
    try {
      const categoryRepo = AppDataSource.getRepository(Category);
      const categories = await categoryRepo.find({
          order: { createdAt: 'DESC' }
      });
      return reply.send(categories);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Create category
  app.post('/categories', { schema: { body: categorySchema } }, async (request, reply) => {
    try {
      const { name, description, image, isActive } = request.body as z.infer<typeof categorySchema>;
      const categoryRepo = AppDataSource.getRepository(Category);
      const category = categoryRepo.create({
          name,
          description,
          image,
          isActive: isActive !== undefined ? isActive : true,
      });
      await categoryRepo.save(category);
      return reply.status(201).send(category);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Delete category
  app.delete('/categories/:id', {
      schema: { params: z.object({ id: z.string() }) }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const categoryRepo = AppDataSource.getRepository(Category);
      await categoryRepo.delete({ id });
      return reply.send({ message: 'Category deleted successfully' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get all products (admin)
  app.get('/products', async (request, reply) => {
    try {
      const productRepo = AppDataSource.getRepository(Product);
      const products = await productRepo.find({
          order: { createdAt: 'DESC' }
      });

      return reply.send(products.map(product => ({
        ...product,
        price: Number(product.price),
      })));
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Create product
  app.post('/products', { schema: { body: productSchema } }, async (request, reply) => {
    try {
      const { name, description, price, image, material, category, subcategory, sizes, inStock, isActive } = request.body as z.infer<typeof productSchema>;
      
      const productRepo = AppDataSource.getRepository(Product);
      const product = productRepo.create({
            name,
            description,
            price,
            image: image || undefined,
            material: material || 'Cotton',
            category,
            subcategory,
            sizes: sizes || [],
            images: [], // or whatever default
            inStock: inStock !== undefined ? inStock : true,
            isActive: isActive !== undefined ? isActive : true,
      });
      await productRepo.save(product);

      return reply.status(201).send({
        ...product,
        price: Number(product.price),
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update product
  app.patch('/products/:id', {
      schema: { 
          params: z.object({ id: z.string() }),
          body: z.object({
              name: z.string().optional(),
              description: z.string().optional(),
              price: z.number().optional(),
              image: z.string().optional(),
              material: z.string().optional(),
              category: z.string().optional(),
              subcategory: z.string().optional(),
              sizes: z.array(z.string()).optional(),
              inStock: z.boolean().optional(),
              isActive: z.boolean().optional(),
          })
      }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, any>;
      
      const updateData: any = {};
      
      if (body.sizes) updateData.sizes = body.sizes; 
      if (body.price !== undefined) updateData.price = body.price;
      if (body.inStock !== undefined) updateData.inStock = body.inStock;
      if (body.name) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.image !== undefined) updateData.image = body.image;
      if (body.material) updateData.material = body.material;
      if (body.category) updateData.category = body.category;
      if (body.subcategory) updateData.subcategory = body.subcategory;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;

      const productRepo = AppDataSource.getRepository(Product);
      let product = await productRepo.findOneBy({ id });
      
      if (!product) {
        return reply.status(404).send({ error: 'Product not found' });
      }
      
      Object.assign(product, updateData);
      await productRepo.save(product);

      return reply.send({
        ...product,
        price: Number(product.price),
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Delete product
  app.delete('/products/:id', {
      schema: { params: z.object({ id: z.string() }) }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const productRepo = AppDataSource.getRepository(Product);
      await productRepo.delete({ id });
      return reply.send({ message: 'Product deleted successfully' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Bulk Seed Products - Removed as not needed for Fastify refactor necessarily, but translating it directly
  app.post('/seed-products', async (request, reply) => {
    try {
      const products = request.body as any[]; 

      if (!Array.isArray(products)) {
          return reply.status(400).send({ error: 'Input must be an array of products' });
      }

      const seededProducts = [];
      const errors = [];

      for (const p of products) {
          try {
              // Note: For prisma Seed, you should use `prisma/seed.js`. But translating it.
              const productRepo = AppDataSource.getRepository(Product);
              const existing = await productRepo.findOne({ where: { name: p.name } });
              if (existing) continue;

              const newProduct = productRepo.create({
                      name: p.name,
                      description: p.description,
                      price: p.price,
                      category: p.category,
                      subcategory: p.subcategory,
                      image: p.image || undefined,
                      sizes: p.sizes || [],
                      material: p.material || 'Cotton',
                      inStock: true, 
                      isActive: true
              });
              await productRepo.save(newProduct);
              seededProducts.push(newProduct);
          } catch (err: any) {
              errors.push({ name: p.name, error: err.message });
          }
      }

      return reply.send({
          message: `Seeded ${seededProducts.length} products`,
          seededCount: seededProducts.length,
          errors
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get all admin staff (admin and super_admin roles)
  app.get('/staff', async (request, reply) => {
    try {
      const { In } = await import('typeorm');
      const userRepo = AppDataSource.getRepository(User);
      const staff = await userRepo.find({
          where: { role: In(['admin', 'super_admin']) },
          order: { createdAt: 'DESC' }
      });
      return reply.send(staff.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        status: s.isActive ? 'active' : 'inactive',
        role: s.role,
        createdAt: s.createdAt
      })));
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get all customers (customer role only — admins managed separately)
  app.get('/customers', async (request, reply) => {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const orderRepo = AppDataSource.getRepository(Order);
      const customers = await userRepo.find({
          where: { role: 'customer' },
          order: { createdAt: 'DESC' }
      });

      let orderStats: any[] = [];
      if (customers.length > 0) {
        orderStats = await orderRepo.createQueryBuilder("order")
          .select("order.userId", "userId")
          .addSelect("COUNT(order.id)", "totalOrders")
          .addSelect("SUM(order.total)", "totalSpent")
          .addSelect("MAX(order.orderDate)", "lastOrderDate")
          .where("order.userId IN (:...userIds)", { userIds: customers.map((c) => c.id) })
          .groupBy("order.userId")
          .getRawMany();
      }

      const statsMap = new Map(orderStats.map(stat => [stat.userId, stat]));

      const customersWithStats = customers.map(customer => {
        const stats = statsMap.get(customer.id);
        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          totalOrders: stats ? Number(stats.totalOrders) : 0,
          totalSpent: stats ? Number(stats.totalSpent) : 0,
          lastOrderDate: stats && stats.lastOrderDate ? new Date(stats.lastOrderDate).toISOString() : null,
          status: customer.isActive ? 'active' : 'inactive',
          role: customer.role,
        };
      });

      return reply.send(customersWithStats);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get all orders (admin)
  app.get('/orders', async (request, reply) => {
    try {
      const orderRepo = AppDataSource.getRepository(Order);
      const orders = await orderRepo.find({
          relations: ['items', 'items.product'],
          order: { orderDate: 'DESC' }
      });

      return reply.send(orders.map(order => ({
        ...order,
        total: Number(order.total),
        originalTotal: order.originalTotal ? Number(order.originalTotal) : null,
        discount: order.discount ? Number(order.discount) : null,
        items: order.items.map(item => ({
            ...item,
            price: Number(item.price),
            product: item.product ? {
                ...item.product,
                price: Number(item.product.price)
            } : null,
        }))
      })));
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get all reviews (admin)
  app.get('/reviews', async (request, reply) => {
    try {
      const reviewRepo = AppDataSource.getRepository(Review);
      const reviews = await reviewRepo.find({
          relations: ['product'],
          order: { createdAt: 'DESC' }
      });

      return reply.send(reviews.map((r) => ({
          ...r,
          product: r.product ? {
               ...r.product,
               price: Number(r.product.price)
          } : null
      })));
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update review approval
  app.patch('/reviews/:id', {
      schema: {
          params: z.object({ id: z.string() }),
          body: z.object({ isApproved: z.boolean() })
      }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { isApproved } = request.body as { isApproved: boolean };

      const reviewRepo = AppDataSource.getRepository(Review);
      const review = await reviewRepo.findOneBy({ id });
      if(!review) return reply.status(404).send({ error: 'Review not found' });

      review.isApproved = isApproved;
      await reviewRepo.save(review);

      return reply.send(review);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get all enquiries
  app.get('/enquiries', async (request, reply) => {
    try {
      const enquiryRepo = AppDataSource.getRepository(Enquiry);
      const enquiries = await enquiryRepo.find({ order: { createdAt: 'DESC' } });
      return reply.send(enquiries);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update enquiry status
  app.patch('/enquiries/:id', {
      schema: { 
          params: z.object({ id: z.string() }),
          body: z.object({ status: z.string() })
      }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: string };

      const enquiryRepo = AppDataSource.getRepository(Enquiry);
      const enquiry = await enquiryRepo.findOneBy({ id });
      if(!enquiry) return reply.status(404).send({ error: 'Enquiry not found' });

      enquiry.status = status;
      await enquiryRepo.save(enquiry);

      return reply.send(enquiry);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get all banners
  app.get('/banners', async (request, reply) => {
    try {
      const bannerRepo = AppDataSource.getRepository(Banner);
      const banners = await bannerRepo.find({ order: { order: 'ASC' } });
      return reply.send(banners);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Create banner
  app.post('/banners', {
      schema: {
          body: z.object({
              title: z.string(),
              description: z.string().optional(),
              image: z.string(),
              link: z.string().optional(),
              position: z.string().optional(),
              isActive: z.boolean().optional(),
              order: z.number().int().optional()
          })
      }
  }, async (request, reply) => {
    try {
      const { title, description, image, link, position, isActive, order } = request.body as Record<string, any>;
      const bannerRepo = AppDataSource.getRepository(Banner);
      const banner = bannerRepo.create({
            title,
            description,
            image,
            link,
            position: position || 'hero',
            isActive: isActive !== undefined ? isActive : true,
            order: order || 0,
      });
      await bannerRepo.save(banner);

      return reply.status(201).send(banner);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update banner
  app.patch('/banners/:id', {
      schema: {
          params: z.object({ id: z.string() }),
          body: z.record(z.string(), z.any())
      }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const bannerRepo = AppDataSource.getRepository(Banner);
      let banner = await bannerRepo.findOneBy({ id });
      if (!banner) return reply.status(404).send({ error: 'Banner not found' });

      Object.assign(banner, request.body);
      await bannerRepo.save(banner);

      return reply.send(banner);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Delete banner
  app.delete('/banners/:id', {
      schema: { params: z.object({ id: z.string() }) }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const bannerRepo = AppDataSource.getRepository(Banner);
      await bannerRepo.delete({ id });
      return reply.send({ message: 'Banner deleted successfully' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get all coupons
  app.get('/coupons', async (request, reply) => {
    try {
      const couponRepo = AppDataSource.getRepository(Coupon);
      const coupons = await couponRepo.find({ order: { createdAt: 'DESC' } });

      return reply.send(coupons.map(coupon => ({
        ...coupon,
        discount: Number(coupon.discount),
        minAmount: coupon.minAmount ? Number(coupon.minAmount) : null,
        maxDiscount: coupon.maxDiscount ? Number(coupon.maxDiscount) : null,
      })));
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Create coupon
  app.post('/coupons', {
      schema: {
          body: z.object({
              code: z.string(),
              discount: z.number(),
              minAmount: z.number().optional(),
              maxDiscount: z.number().optional(),
              validFrom: z.string(),
              validUntil: z.string(),
              isActive: z.boolean().optional(),
              usageLimit: z.number().int().optional()
          })
      }
  }, async (request, reply) => {
    try {
      const { code, discount, minAmount, maxDiscount, validFrom, validUntil, isActive, usageLimit } = request.body as Record<string, any>;
      const couponRepo = AppDataSource.getRepository(Coupon);
      const coupon = couponRepo.create({
            code,
            discount,
            minAmount: minAmount || undefined,
            maxDiscount: maxDiscount || undefined,
            validFrom: new Date(validFrom),
            validUntil: new Date(validUntil),
            isActive: isActive !== undefined ? isActive : true,
            usageLimit: usageLimit || undefined,
      });
      await couponRepo.save(coupon);

      return reply.status(201).send({
        ...coupon,
        discount: Number(coupon.discount),
        minAmount: coupon.minAmount ? Number(coupon.minAmount) : null,
        maxDiscount: coupon.maxDiscount ? Number(coupon.maxDiscount) : null,
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update coupon
  app.patch('/coupons/:id', {
      schema: {
          params: z.object({ id: z.string() }),
          body: z.record(z.string(), z.any())
      }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const couponRepo = AppDataSource.getRepository(Coupon);
      let coupon = await couponRepo.findOneBy({ id });
      if(!coupon) return reply.status(404).send({ error: 'Coupon not found' });

      Object.assign(coupon, request.body);
      await couponRepo.save(coupon);

      return reply.send({
        ...coupon,
        discount: Number(coupon.discount),
        minAmount: coupon.minAmount ? Number(coupon.minAmount) : null,
        maxDiscount: coupon.maxDiscount ? Number(coupon.maxDiscount) : null,
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Delete coupon
  app.delete('/coupons/:id', {
      schema: { params: z.object({ id: z.string() }) }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const couponRepo = AppDataSource.getRepository(Coupon);
      await couponRepo.delete({ id });
      return reply.send({ message: 'Coupon deleted successfully' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update customer role (super_admin only) - must be registered BEFORE /:id to avoid conflict
  app.patch('/customers/:id/role', {
      schema: {
          params: z.object({ id: z.string() }),
          body: z.object({ role: z.enum(['customer', 'admin']) })
      }
  }, async (request, reply) => {
    try {
      const authUser = (request as any).user;
      if (authUser.role !== 'super_admin') {
         return reply.status(403).send({ error: 'Only super admin can change roles' });
      }

      const { id } = request.params as { id: string };
      const { role } = request.body as { role: 'customer' | 'admin' };
      
      const userRepo = AppDataSource.getRepository(User);
      const customer = await userRepo.findOne({
          where: { id },
      });
      if (!customer) return reply.status(404).send({ error: 'User not found' });
      
      if (customer.role === 'super_admin') {
          return reply.status(400).send({ error: 'Cannot change super admin role' });
      }

      customer.role = role;
      await userRepo.save(customer);

      const auditRepo = AppDataSource.getRepository(AuditLog);
      await auditRepo.save({
          adminId: authUser.id,
          adminEmail: authUser.email,
          action: 'UPDATE_ROLE',
          entityType: 'USER',
          entityId: customer.id,
          details: JSON.stringify({ oldRole: customer.role === role ? 'same' : (role === 'admin' ? 'customer' : 'admin'), newRole: role })
      });

      return reply.send({
        id: customer.id,
        role: customer.role
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update customer status
  app.patch('/customers/:id', {
      schema: {
          params: z.object({ id: z.string() }),
          body: z.object({ isActive: z.boolean() })
      }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { isActive } = request.body as { isActive: boolean };
      
      const userRepo = AppDataSource.getRepository(User);
      const customer = await userRepo.findOne({
          where: { id },
          select: ['id', 'name', 'email', 'phone', 'isActive', 'role']
      });
      if (!customer) return reply.status(404).send({ error: 'Customer not found' });

      customer.isActive = isActive;
      await userRepo.save(customer);

      return reply.send({
        ...customer,
        status: customer.isActive ? 'active' : 'inactive',
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Delete customer (super_admin only)
  app.delete('/customers/:id', {
      schema: { params: z.object({ id: z.string() }) }
  }, async (request, reply) => {
    try {
      const authUser = (request as any).user;
      if (authUser.role !== 'super_admin') {
         return reply.status(403).send({ error: 'Only super admin can delete users' });
      }

      const { id } = request.params as { id: string };
      const userRepo = AppDataSource.getRepository(User);
      const customer = await userRepo.findOne({ where: { id } });
      
      if (!customer) return reply.status(404).send({ error: 'User not found' });
      if (customer.role === 'super_admin') {
          return reply.status(400).send({ error: 'Cannot delete super admin' });
      }

      // Safely clear out dependent tracking records before deleting user
      const { Address } = await import('../entities/Address.js');
      const { CartItem } = await import('../entities/CartItem.js');
      const { WishlistItem } = await import('../entities/WishlistItem.js');
      const { Review } = await import('../entities/Review.js');

      await AppDataSource.getRepository(Address).delete({ user: { id } });
      await AppDataSource.getRepository(CartItem).delete({ userId: id });
      await AppDataSource.getRepository(WishlistItem).delete({ userId: id });
      await AppDataSource.getRepository(Review).delete({ user: { id } });

      // Unlink orders
      const orderRepo = AppDataSource.getRepository(Order);
      const orders = await orderRepo.find({ where: { userId: id } });
      for (const order of orders) {
          order.userId = undefined;
          await orderRepo.save(order);
      }

      await userRepo.remove(customer);
      
      const auditRepo = AppDataSource.getRepository(AuditLog);
      await auditRepo.save({
          adminId: authUser.id,
          adminEmail: authUser.email,
          action: 'DELETE_USER',
          entityType: 'USER',
          entityId: id,
          details: JSON.stringify({ deletedEmail: customer.email, oldRole: customer.role })
      });

      return reply.send({ message: 'User deleted successfully' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get audit logs
  app.get('/audit-log', async (request, reply) => {
    try {
      const authUser = (request as any).user;
      if (authUser.role !== 'super_admin') {
         return reply.status(403).send({ error: 'Only super admin can view audit logs' });
      }

      const auditRepo = AppDataSource.getRepository(AuditLog);
      const logs = await auditRepo.find({
          order: { createdAt: 'DESC' },
          take: 100 // limit to last 100 for safety
      });

      return reply.send(logs);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get notifications
  app.get('/notifications', async (request, reply) => {
    try {
      const notificationRepo = AppDataSource.getRepository(Notification);
      const notifications = await notificationRepo.find({
          order: { createdAt: 'DESC' },
          take: 50
      });
      return reply.send(notifications);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Mark notification as read
  app.patch('/notifications/:id/read', {
    schema: { params: z.object({ id: z.string() }) }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const notificationRepo = AppDataSource.getRepository(Notification);
      const notification = await notificationRepo.findOne({ where: { id } });
      
      if (!notification) return reply.status(404).send({ error: 'Notification not found' });
      
      notification.isRead = true;
      await notificationRepo.save(notification);
      
      return reply.send(notification);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get all return requests
  app.get('/returns', async (request, reply) => {
    try {
      const returnRepo = AppDataSource.getRepository(ReturnRequest);
      const returns = await returnRepo.find({
          relations: ['user', 'order'],
          order: { createdAt: 'DESC' }
      });
      return reply.send(returns.map(r => ({
          ...r,
          userName: r.user?.name || 'Unknown',
          userEmail: r.user?.email || 'Unknown',
          orderTotal: r.order?.total || 0,
          customerPhone: r.order?.customerPhone || '',
          orderDate: r.order?.orderDate || r.createdAt
      })));
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update return status
  app.patch('/returns/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({ status: z.enum(['Approved', 'Rejected', 'Processed']), adminNotes: z.string().optional() })
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { status, adminNotes } = request.body as any;
      
      const returnRepo = AppDataSource.getRepository(ReturnRequest);
      const returnReq = await returnRepo.findOne({ where: { id } });
      
      if (!returnReq) return reply.status(404).send({ error: 'Return request not found' });
      
      returnReq.status = status;
      if (adminNotes !== undefined) returnReq.adminNotes = adminNotes;
      await returnRepo.save(returnReq);
      
      return reply.send(returnReq);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}

