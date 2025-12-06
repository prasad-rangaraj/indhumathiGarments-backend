import express from 'express';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const router = express.Router();

// Encryption key (should be in environment variable in production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

// Encrypt sensitive data
const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

// Decrypt sensitive data
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

// Rate limiting middleware (simple in-memory store - use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5; // Max 5 requests per window

const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (record && record.resetTime > now) {
    if (record.count >= RATE_LIMIT_MAX) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    record.count += 1;
  } else {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  }

  // Clean up old entries
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetTime <= now) {
      rateLimitMap.delete(key);
    }
  }

  next();
};

// Input validation middleware
const validateSettings = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const { siteName, email, phone, razorpayKey, razorpaySecret } = req.body;

  // Validate site name
  if (siteName && (siteName.length < 2 || siteName.length > 100)) {
    return res.status(400).json({ error: 'Site name must be between 2 and 100 characters' });
  }

  // Validate email
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate phone
  if (phone && !/^[\d\s\+\-\(\)]+$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone format' });
  }

  // Validate Razorpay Key
  if (razorpayKey && !razorpayKey.startsWith('rzp_')) {
    return res.status(400).json({ error: 'Invalid Razorpay Key ID format' });
  }

  // Validate Razorpay Secret
  if (razorpaySecret && razorpaySecret.length < 20) {
    return res.status(400).json({ error: 'Invalid Razorpay Secret format' });
  }

  // Sanitize inputs (remove potential XSS)
  if (req.body.siteName) {
    req.body.siteName = req.body.siteName.replace(/[<>]/g, '').trim();
  }
  if (req.body.tagline) {
    req.body.tagline = req.body.tagline.replace(/[<>]/g, '').trim();
  }
  if (req.body.address) {
    req.body.address = req.body.address.replace(/[<>]/g, '').trim();
  }

  next();
};

// Get settings (admin only)
router.get('/', async (req, res) => {
  try {
    // TODO: Add authentication check - verify user is admin
    const settings = await prisma.settings.findMany();
    
    const settingsMap: Record<string, string> = {};
    settings.forEach(setting => {
      if (setting.isEncrypted) {
        // Don't return encrypted values, just indicate they exist
        settingsMap[setting.key] = setting.value ? '***ENCRYPTED***' : '';
      } else {
        settingsMap[setting.key] = setting.value;
      }
    });

    res.json({
      siteName: settingsMap.siteName || 'Indhumathi',
      tagline: settingsMap.tagline || 'Pure Cotton Women\'s Innerwear',
      email: settingsMap.email || 'contact@indhumathi.com',
      phone: settingsMap.phone || '+91 98765 43210',
      address: settingsMap.address || '123, Textile Street, Tirupur, Tamil Nadu - 641604',
      razorpayKey: settingsMap.razorpayKey || '',
      razorpaySecret: '', // Never return actual secrets
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save settings (admin only, rate limited)
router.post('/', rateLimiter, validateSettings, async (req, res) => {
  try {
    // TODO: Add authentication check - verify user is admin
    const { siteName, tagline, email, phone, address, razorpayKey, razorpaySecret } = req.body;

    // Save settings to database
    const settingsToSave = [
      { key: 'siteName', value: siteName || '', isEncrypted: false },
      { key: 'tagline', value: tagline || '', isEncrypted: false },
      { key: 'email', value: email || '', isEncrypted: false },
      { key: 'phone', value: phone || '', isEncrypted: false },
      { key: 'address', value: address || '', isEncrypted: false },
    ];

    if (razorpayKey) {
      settingsToSave.push({ key: 'razorpayKey', value: razorpayKey, isEncrypted: false });
    }

    if (razorpaySecret) {
      const encryptedSecret = encrypt(razorpaySecret);
      settingsToSave.push({ key: 'razorpaySecret', value: encryptedSecret, isEncrypted: true });
    }

    // Upsert each setting
    for (const setting of settingsToSave) {
      await prisma.settings.upsert({
        where: { key: setting.key },
        update: {
          value: setting.value,
          isEncrypted: setting.isEncrypted,
          updatedBy: req.body.userId || 'admin', // TODO: Get from authenticated session
        },
        create: {
          key: setting.key,
          value: setting.value,
          isEncrypted: setting.isEncrypted,
          updatedBy: req.body.userId || 'admin',
        },
      });
    }

    res.json({
      message: 'Settings saved successfully',
      // Never return encrypted data
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Change password (admin only, rate limited)
router.post('/change-password', rateLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.body.userId; // TODO: Get from authenticated session

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'Password must contain uppercase, lowercase, and numbers' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Check if new password is different
    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

