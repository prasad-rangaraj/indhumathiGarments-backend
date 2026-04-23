import { AppDataSource, initDb } from '../lib/db.js';
import { Product } from '../entities/Product.js';
import { OrderItem } from '../entities/OrderItem.js';
import { CartItem } from '../entities/CartItem.js';
import { WishlistItem } from '../entities/WishlistItem.js';
import { Review } from '../entities/Review.js';

const clearProducts = async () => {
    try {
        await initDb();
        const orderItemRepo = AppDataSource.getRepository(OrderItem);
        const cartItemRepo = AppDataSource.getRepository(CartItem);
        const wishlistItemRepo = AppDataSource.getRepository(WishlistItem);
        const reviewRepo = AppDataSource.getRepository(Review);
        const productRepo = AppDataSource.getRepository(Product);

        console.log('Clearing dependent tables...');
        await orderItemRepo.createQueryBuilder().delete().execute();
        await cartItemRepo.createQueryBuilder().delete().execute();
        await wishlistItemRepo.createQueryBuilder().delete().execute();
        await reviewRepo.createQueryBuilder().delete().execute();

        console.log('Clearing products...');
        await productRepo.createQueryBuilder().delete().execute(); 
        
        console.log('✅ Successfully removed all products and related items from the database.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error clearing products:', error);
        process.exit(1);
    }
};

clearProducts();
