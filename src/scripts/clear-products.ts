import { initDb, AppDataSource } from '../lib/db.js';
import { Product } from '../entities/Product.js';
import { ProductVariant } from '../entities/ProductVariant.js';
import { OrderItem } from '../entities/OrderItem.js';
import { CartItem } from '../entities/CartItem.js';
import { WishlistItem } from '../entities/WishlistItem.js';
import { Review } from '../entities/Review.js';

const run = async () => {
  try {
    console.log('⏳ Connecting to database...');
    await initDb();
    console.log('✅ Connected.');

    const orderItemRepo = AppDataSource.getRepository(OrderItem);
    const cartItemRepo = AppDataSource.getRepository(CartItem);
    const wishlistRepo = AppDataSource.getRepository(WishlistItem);
    const reviewRepo = AppDataSource.getRepository(Review);
    const variantRepo = AppDataSource.getRepository(ProductVariant);
    const productRepo = AppDataSource.getRepository(Product);

    console.log('\n🗑️  Clearing dependent tables...');
    await orderItemRepo.createQueryBuilder().delete().execute();
    await cartItemRepo.createQueryBuilder().delete().execute();
    await wishlistRepo.createQueryBuilder().delete().execute();
    await reviewRepo.createQueryBuilder().delete().execute();
    await variantRepo.createQueryBuilder().delete().execute();
    console.log('✅ Dependents cleared.');

    console.log('🗑️  Clearing products...');
    await productRepo.createQueryBuilder().delete().execute();
    console.log('✅ Products cleared.');

    console.log('\n✨ All product data removed successfully.\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Failed to clear products:', err);
    process.exit(1);
  }
};

run();
