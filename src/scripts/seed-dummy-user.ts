import { initDb, AppDataSource } from '../lib/db.js';
import { User } from '../entities/User.js';
import bcrypt from 'bcryptjs';

const seedDummyUser = async () => {
    try {
        await initDb();
        const userRepo = AppDataSource.getRepository(User);

        const email = 'user@gmail.com';
        const password = 'User@12345';

        const existing = await userRepo.findOne({ where: { email } });
        if (existing) {
            console.log('⚠️ User already exists. Updating password...');
            existing.password = await bcrypt.hash(password, 10);
            existing.isVerified = true;
            existing.isActive = true;
            await userRepo.save(existing);
            console.log('✅ User updated successfully!');
        } else {
            const hashedPassword = await bcrypt.hash(password, 10);
            const user = userRepo.create({
                name: 'Dummy User',
                email,
                password: hashedPassword,
                phone: '1234567890',
                role: 'customer',
                isVerified: true,
                isActive: true
            });
            await userRepo.save(user);
            console.log('✅ Dummy user seeded successfully!');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding dummy user:', error);
        process.exit(1);
    }
};

seedDummyUser();
