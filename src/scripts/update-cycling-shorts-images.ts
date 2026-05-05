import { initDb, AppDataSource } from '../lib/db.js';
import { Product } from '../entities/Product.js';

// All cycling shorts images uploaded to EC2 uploads/ folder
const IMAGES_TO_USE = [
  '/uploads/cycling-shorts-1.jpg',
  '/uploads/cycling-shorts-2.jpg',
  '/uploads/cycling-shorts-3.jpg',
  '/uploads/cycling-shorts-4.jpg',
  '/uploads/cycling-shorts-5.jpg',
];

const run = async () => {
  try {
    await initDb();
    const productRepo = AppDataSource.getRepository(Product);

    const product = await productRepo.findOne({
      where: { name: 'Cycling Shorts' },
    });

    if (!product) {
      console.error('❌ Cycling Shorts product not found! Run npm run seed:real first.');
      process.exit(1);
    }

    product.images = IMAGES_TO_USE;
    product.image = '/uploads/cycling-shorts-pink.jpg'; // Main image for category list
    await productRepo.save(product);

    console.log(`✅ Updated Cycling Shorts with ${IMAGES_TO_USE.length} images:`);
    IMAGES_TO_USE.forEach((img, i) => console.log(`   ${i + 1}. ${img}`));
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

run();
