import { initDb, AppDataSource } from '../lib/db.js';
import { Product } from '../entities/Product.js';
import { Category } from '../entities/Category.js';
import { ProductVariant } from '../entities/ProductVariant.js';
import { OrderItem } from '../entities/OrderItem.js';
import { CartItem } from '../entities/CartItem.js';
import { WishlistItem } from '../entities/WishlistItem.js';
import { Review } from '../entities/Review.js';

// ─── Product Definitions ──────────────────────────────────────────────────────
//
//  Images are served from /uploads/<filename> by the Fastify static plugin.
//  Place the image files in the `uploads/` folder at the backend root.
//
const PRODUCTS = [
  {
    name: 'Cycling Shorts',
    description:
      'Soft, breathable pure-cotton cycling shorts with elastic encased waistband, ' +
      'overlocked inner seams, and single-needle stitching throughout. Designed for ' +
      'all-day comfort and freedom of movement.',
    price: 299,
    category: 'Shorts',
    subcategory: 'Cycling Shorts',
    image: '/uploads/cycling-shorts-pink.jpg',
    images: ['/uploads/cycling-shorts-pink.jpg'],
    material: '100% Pure Cotton',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    color: 'Pink',
    stock: 500,
    inStock: true,
    isActive: true,
  },
  {
    name: 'Slip with Adjustment',
    description:
      'Premium cotton slip with adjustable straps for the perfect fit. ' +
      'Features a smooth neckline, reinforced armhole stitching, and a neat ' +
      'hem detail. Adjustable back strap for customised support.',
    price: 249,
    category: 'Slips',
    subcategory: 'Adjustable Slip',
    image: '/uploads/slip-with-adjustment-red.jpg',
    images: ['/uploads/slip-with-adjustment-red.jpg'],
    material: '100% Pure Cotton',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    color: 'Red',
    stock: 500,
    inStock: true,
    isActive: true,
  },
  {
    name: 'Slip without Adjustment',
    description:
      'Comfortable everyday cotton slip with fixed straps. ' +
      'Clean neckline detail, criss-cross back for a secure fit, and ' +
      'finished hem for long-lasting wear.',
    price: 199,
    category: 'Slips',
    subcategory: 'Non-Adjustable Slip',
    image: '/uploads/slip-without-adjustment-blue.jpg',
    images: ['/uploads/slip-without-adjustment-blue.jpg'],
    material: '100% Pure Cotton',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    color: 'Blue',
    stock: 500,
    inStock: true,
    isActive: true,
  },
  {
    name: 'Mould Sports Bra with Adjustment',
    description:
      'Structured moulded sports bra with adjustable straps and back hook ' +
      'closure. Offers superior support with cup and inner detailing. ' +
      'Ideal for active and everyday wear.',
    price: 449,
    category: 'Mould Sports Bra',
    subcategory: 'Adjustable Slip',
    image: '/uploads/mould-sports-bra-with-adjustment-red.jpg',
    images: ['/uploads/mould-sports-bra-with-adjustment-red.jpg'],
    material: '100% Pure Cotton',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    color: 'Red',
    stock: 500,
    inStock: true,
    isActive: true,
  },
  {
    name: 'Mould Sports Bra without Adjustment',
    description:
      'Soft and lightweight moulded sports bra without adjustment straps. ' +
      'Wide shoulder straps for comfort, with a smooth front and breathable ' +
      'fabric for all-day freshness.',
    price: 399,
    category: 'Mould Sports Bra',
    subcategory: 'Non-Adjustable Slip',
    image: '/uploads/mould-sports-bra-without-adjustment-sandal.jpg',
    images: ['/uploads/mould-sports-bra-without-adjustment-sandal.jpg'],
    material: '100% Pure Cotton',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    color: 'Sandal',
    stock: 500,
    inStock: true,
    isActive: true,
  },
];

// ─── Category Definitions ─────────────────────────────────────────────────────
const CATEGORIES = [
  {
    name: 'Shorts',
    description: 'Cotton cycling and active shorts for women.',
    image: '/uploads/cycling-shorts-pink.jpg',
    isActive: true,
  },
  {
    name: 'Slips',
    description: 'Pure cotton slips – available with and without adjustable straps.',
    image: '/uploads/slip-with-adjustment-red.jpg',
    isActive: true,
  },
  {
    name: 'Bras',
    description: 'Moulded cotton sports bras for everyday and active wear.',
    image: '/uploads/mould-sports-bra-with-adjustment-red.jpg',
    isActive: true,
  },
];

// ─── Main Script ──────────────────────────────────────────────────────────────
const run = async () => {
  try {
    await initDb();

    const orderItemRepo = AppDataSource.getRepository(OrderItem);
    const cartItemRepo = AppDataSource.getRepository(CartItem);
    const wishlistRepo = AppDataSource.getRepository(WishlistItem);
    const reviewRepo = AppDataSource.getRepository(Review);
    const variantRepo = AppDataSource.getRepository(ProductVariant);
    const productRepo = AppDataSource.getRepository(Product);
    const categoryRepo = AppDataSource.getRepository(Category);

    // ── 1. Clear dependents first (FK-safe order) ───────────────────────────
    console.log('\n🗑️  Clearing dependent tables...');
    await orderItemRepo.createQueryBuilder().delete().execute();
    await cartItemRepo.createQueryBuilder().delete().execute();
    await wishlistRepo.createQueryBuilder().delete().execute();
    await reviewRepo.createQueryBuilder().delete().execute();
    await variantRepo.createQueryBuilder().delete().execute();

    // ── 2. Clear products ───────────────────────────────────────────────────
    console.log('🗑️  Clearing products...');
    await productRepo.createQueryBuilder().delete().execute();

    // ── 3. Clear old categories ─────────────────────────────────────────────
    console.log('🗑️  Clearing old categories...');
    await categoryRepo.createQueryBuilder().delete().execute();

    // ── 4. Seed new categories ──────────────────────────────────────────────
    console.log('\n📂 Seeding categories...');
    for (const cat of CATEGORIES) {
      const entity = categoryRepo.create(cat);
      await categoryRepo.save(entity);
      console.log(`  ✅ Category: ${cat.name}`);
    }

    // ── 5. Seed new products ────────────────────────────────────────────────
    console.log('\n👗 Seeding products...');
    for (const p of PRODUCTS) {
      const entity = productRepo.create(p);
      await productRepo.save(entity);
      console.log(`  ✅ Product: ${p.name} (${p.color})`);
    }

    console.log('\n🎉 Seed complete! 5 products + 3 categories added.\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
};

run();
