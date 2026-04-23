import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../lib/db.js';
import { Settings } from '../entities/Settings.js';
import { User } from '../entities/User.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { protect, admin } from '../middleware/auth.js';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

export default async function settingsRoutes(appInstance: FastifyInstance) {
  const app = appInstance.withTypeProvider<ZodTypeProvider>();

  // Apply protection to all routes
  app.addHook('preHandler', protect);
  app.addHook('preHandler', admin);

  // Encryption key
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  const ALGORITHM = 'aes-256-gcm';

  const encrypt = (text: string): string => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  };

  const decrypt = (encryptedText: string): string => {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  };

  // Get settings
  app.get('/', async (request, reply) => {
    try {
      const settingsRepo = AppDataSource.getRepository(Settings);
      const settings = await settingsRepo.find();

      const settingsMap: Record<string, string> = {};
      settings.forEach(setting => {
        if (setting.isEncrypted) {
          settingsMap[setting.key] = setting.value ? '***ENCRYPTED***' : '';
        } else {
          settingsMap[setting.key] = setting.value;
        }
      });

      return reply.send({
        siteName: settingsMap.siteName || 'Indhumathi',
        tagline: settingsMap.tagline || 'Pure Cotton Women\'s Innerwear',
        email: settingsMap.email || 'indhumathi.img@gmail.com',
        phone: settingsMap.phone || '+91 87546 09226',
        address: settingsMap.address || 'Teachers colony 2nd street, Pandian nagar, Tiruppur,Tamilnadu . - 641604',
        razorpayKey: settingsMap.razorpayKey || '',
        razorpaySecret: '', // Never return actual secrets
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Save settings (rate limited, validated)
  // Note: Rate limiting is handled by global fastify-rate-limit plugin in index.ts for simplicity, 
  // but can be scoped locally. For now, we'll rely on the standard endpoint.
  app.post('/', {
    schema: {
      body: z.object({
        siteName: z.string().min(2).max(100).optional(),
        tagline: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        address: z.string().optional(),
        razorpayKey: z.string().optional(),
        razorpaySecret: z.string().optional()
      })
    }
  }, async (request, reply) => {
    try {
      const { siteName, tagline, email, phone, address, razorpayKey, razorpaySecret } = request.body as Record<string, any>;
      const user = (request as any).user;

      const safeSiteName = siteName ? siteName.replace(/[<>]/g, '').trim() : '';
      const safeTagline = tagline ? tagline.replace(/[<>]/g, '').trim() : '';
      const safeAddress = address ? address.replace(/[<>]/g, '').trim() : '';

      const settingsToSave = [
        { key: 'siteName', value: safeSiteName, isEncrypted: false },
        { key: 'tagline', value: safeTagline, isEncrypted: false },
        { key: 'email', value: email || '', isEncrypted: false },
        { key: 'phone', value: phone || '', isEncrypted: false },
        { key: 'address', value: safeAddress, isEncrypted: false },
      ];

      if (razorpayKey && razorpayKey.startsWith('rzp_')) {
        settingsToSave.push({ key: 'razorpayKey', value: razorpayKey, isEncrypted: false });
      }

      if (razorpaySecret && razorpaySecret.length >= 20) {
        const encryptedSecret = encrypt(razorpaySecret);
        settingsToSave.push({ key: 'razorpaySecret', value: encryptedSecret, isEncrypted: true });
      }

      const settingsRepo = AppDataSource.getRepository(Settings);
      for (const setting of settingsToSave) {
        let existingSetting = await settingsRepo.findOneBy({ key: setting.key });
        if (existingSetting) {
          existingSetting.value = setting.value;
          existingSetting.isEncrypted = setting.isEncrypted;
          existingSetting.updatedBy = user.id || 'admin';
          await settingsRepo.save(existingSetting);
        } else {
          const newSetting = settingsRepo.create({
            key: setting.key,
            value: setting.value,
            isEncrypted: setting.isEncrypted,
            updatedBy: user.id || 'admin'
          });
          await settingsRepo.save(newSetting);
        }
      }

      return reply.send({ message: 'Settings saved successfully' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Change password 
  app.post('/change-password', {
    schema: {
      body: z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8)
      })
    }
  }, async (request, reply) => {
    try {
      const { currentPassword, newPassword } = request.body as Record<string, string>;
      const user = (request as any).user;

      if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return reply.status(400).send({ error: 'Password must contain uppercase, lowercase, and numbers' });
      }

      const userRepo = AppDataSource.getRepository(User);
      const safeUser = await userRepo.findOneBy({ id: user.id });

      if (!safeUser || !safeUser.password) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const isValid = await bcrypt.compare(currentPassword, safeUser.password);
      if (!isValid) {
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }

      const isSame = await bcrypt.compare(newPassword, safeUser.password);
      if (isSame) {
        return reply.status(400).send({ error: 'New password must be different from current password' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      safeUser.password = hashedPassword;
      await userRepo.save(safeUser);

      return reply.send({ message: 'Password changed successfully' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
