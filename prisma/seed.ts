import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {
      password: adminPassword,
      role: 'admin',
      isActive: true,
    },
    create: {
      email: 'admin@gmail.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'admin',
      isActive: true,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create customer user
  const customerPassword = await bcrypt.hash('123', 10);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@gmail.com' },
    update: {
      password: customerPassword,
      role: 'customer',
      isActive: true,
    },
    create: {
      email: 'customer@gmail.com',
      name: 'Customer User',
      password: customerPassword,
      role: 'customer',
      isActive: true,
    },
  });
  console.log('✅ Customer user created:', customer.email);

  // Create default banners (only if they don't exist)
  const existingBanners = await prisma.banner.count();
  if (existingBanners === 0) {
    const defaultBanners = [
      {
        title: 'Summer Collection',
        description: 'Flat 40% Off',
        image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=400&fit=crop',
        link: '/products',
        position: 'hero',
        isActive: true,
        order: 1,
      },
      {
        title: 'New Arrivals',
        description: 'Shop Now',
        image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200&h=400&fit=crop',
        link: '/products',
        position: 'secondary',
        isActive: true,
        order: 2,
      },
      {
        title: 'Comfort First',
        description: 'Pure Cotton Range',
        image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200&h=400&fit=crop',
        link: '/products',
        position: 'promo',
        isActive: true,
        order: 3,
      },
    ];

    for (const banner of defaultBanners) {
      await prisma.banner.create({
        data: banner,
      });
    }
    console.log('✅ Default banners created');
  } else {
    console.log('ℹ️  Banners already exist, skipping banner creation');
  }

  console.log('✨ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

