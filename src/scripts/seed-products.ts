import { initDb, AppDataSource } from '../lib/db.js';
import { Product } from '../entities/Product.js';

const products = [
  {
    name: "Classic Cotton Saree",
    description: "A beautiful pure cotton saree for daily wear.",
    price: 1500,
    category: "Sarees",
    subcategory: "Cotton Sarees",
    image: "https://via.placeholder.com/150",
    sizes: ["Free Size"],
    material: "Cotton",
    inStock: true,
    isActive: true
  },
  {
    name: "Silk Blend Saree",
    description: "Elegant silk blend saree for special occasions.",
    price: 4500,
    category: "Sarees",
    subcategory: "Silk Sarees",
    image: "https://via.placeholder.com/150",
    sizes: ["Free Size"],
    material: "Silk Blend",
    inStock: true,
    isActive: true
  },
  {
    name: "Cotton Kurtis",
    description: "Comfortable cotton kurtis for office wear.",
    price: 800,
    category: "Kurtis",
    subcategory: "Cotton Kurtis",
    image: "https://via.placeholder.com/150",
    sizes: ["S", "M", "L", "XL"],
    material: "Cotton",
    inStock: true,
    isActive: true
  }
];

const seedProducts = async () => {
    try {
        await initDb();
        const productRepo = AppDataSource.getRepository(Product);

        let seededCount = 0;
        for (const p of products) {
            const existing = await productRepo.findOne({ where: { name: p.name } });
            if (!existing) {
                const newProduct = productRepo.create(p);
                await productRepo.save(newProduct);
                seededCount++;
                console.log(`✅ Seeded product: ${p.name}`);
            } else {
                console.log(`⚠️ Product already exists: ${p.name}`);
            }
        }

        console.log(`\n🎉 Seeded ${seededCount} products successfully!`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error Seeding Products:', error);
        process.exit(1);
    }
};

seedProducts();
