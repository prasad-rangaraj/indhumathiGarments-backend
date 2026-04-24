import { initDb, AppDataSource } from '../lib/db.js';
import { Product } from '../entities/Product.js';

const setStock = async () => {
    try {
        await initDb();
        const productRepo = AppDataSource.getRepository(Product);

        const products = await productRepo.find();
        
        for (const product of products) {
            product.stock = 500;
            product.inStock = true;
            await productRepo.save(product);
            console.log(`✅ Updated stock for: ${product.name}`);
        }

        console.log(`\n🎉 Successfully updated stock for ${products.length} products to 500!`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating stock:', error);
        process.exit(1);
    }
};

setStock();
