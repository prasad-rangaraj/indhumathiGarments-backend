import { initDb, AppDataSource } from '../lib/db.js';
import { User } from '../entities/User.js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const seedAdmin = async () => {
    try {
        await initDb();
        const userRepo = AppDataSource.getRepository(User);
        const email = 'indhumathi.img@gmail.com';
        const rawPassword = 'indhumathi@12345';

        const existingAdmin = await userRepo.findOne({ where: { email } });
        
        if (existingAdmin) {
            console.log('⚠️ Admin user already exists. Updating password...');
            const hashedPassword = await bcrypt.hash(rawPassword, 10);
            
            existingAdmin.password = hashedPassword;
            existingAdmin.role = 'super_admin';
            await userRepo.save(existingAdmin);
            console.log('✅ Admin password updated successfully');
        } else {
            console.log('Creating new admin user...');
            const hashedPassword = await bcrypt.hash(rawPassword, 10);
            const newAdmin = userRepo.create({
                    name: 'Super Admin',
                    email,
                    password: hashedPassword,
                    role: 'super_admin',
                    phone: '0000000000',
                    isVerified: true,
                    isActive: true,
            });
            await userRepo.save(newAdmin);
            console.log('✅ Admin user created successfully');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error Seeding Admin:', error);
        process.exit(1);
    }
};

seedAdmin();
