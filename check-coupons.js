import { AppDataSource, initDb } from './src/lib/db.js';
import { Coupon } from './src/entities/Coupon.js';

async function check() {
  try {
    await initDb();
    const repo = AppDataSource.getRepository(Coupon);
    const coupons = await repo.find();
    console.log(`Found ${coupons.length} coupons in DB:`);
    coupons.forEach(c => {
      console.log(`- Code: ${c.code}, isActive: ${c.isActive}, validUntil: ${c.validUntil}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
