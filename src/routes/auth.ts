import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sendEmail from '../lib/email.js';
import { AppDataSource } from '../lib/db.js';
import { User } from '../entities/User.js';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { loginSchema, registerSchema, verifyOtpSchema } from '../lib/validators.js';

const generateToken = (id: string, role: string) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return jwt.sign({ id, role }, secret, {
    expiresIn: '30d',
  });
};

export default async function authRoutes(appInstance: FastifyInstance) {
  const app = appInstance.withTypeProvider<ZodTypeProvider>();

  // Get current user (refresh role from DB)
  app.get('/me', async (request, reply) => {
    try {
      let token: string | undefined;
      if (request.cookies?.token) {
        token = request.cookies.token;
      } else {
        const auth = request.headers.authorization;
        if (auth?.startsWith('Bearer ')) token = auth.split(' ')[1];
      }
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });

      const jwt_lib = await import('jsonwebtoken');
      const secret = process.env.JWT_SECRET!;
      const decoded: any = jwt_lib.default.verify(token, secret);

      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: decoded.id } });
      if (!user) return reply.status(401).send({ error: 'User not found' });

      return reply.send({ id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone, address: user.address });
    } catch (e: any) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });
  app.post('/login', { schema: { body: loginSchema } }, async (request, reply) => {
    try {
      const { email, password } = request.body as z.infer<typeof loginSchema>;

      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { email } });

      if (!user) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      if (user.lockoutUntil && new Date() < user.lockoutUntil) {
        return reply.status(401).send({ error: 'Account temporarily locked due to too many failed attempts. Try again later.' });
      }

      if (!user.password || !password) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 5) {
          user.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
        }
        await userRepo.save(user);
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      if (user.failedLoginAttempts > 0) {
        user.failedLoginAttempts = 0;
        user.lockoutUntil = undefined;
        await userRepo.save(user);
      }

      if (!user.isActive) {
        return reply.status(403).send({ error: 'Account is inactive' });
      }
      
      const token = generateToken(user.id, user.role);

      reply.setCookie('token', token, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60, // 30 days
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      return reply.send({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        address: user.address,
        isVerified: user.isVerified,
        token,
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Logout (Token Revocation)
  app.post('/logout', async (request, reply) => {
    try {
      let token: string | undefined;
      if (request.cookies?.token) {
        token = request.cookies.token;
      } else {
        const auth = request.headers.authorization;
        if (auth?.startsWith('Bearer ')) token = auth.split(' ')[1];
      }

      if (token) {
        const secret = process.env.JWT_SECRET!;
        try {
           const decoded: any = jwt.verify(token, secret);
           const tokenRepo = AppDataSource.getRepository('BlacklistedToken');
           await tokenRepo.save({
              token,
              expiresAt: new Date(decoded.exp * 1000)
           });
        } catch(e) {
           // Skip if token already invalid/expired
        }
      }

      reply.clearCookie('token');
      return reply.send({ message: 'Logged out successfully' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Register
  app.post('/register', { schema: { body: registerSchema } }, async (request, reply) => {
    try {
      const { name, email, password, phone, address } = request.body as z.infer<typeof registerSchema>;

      const userRepo = AppDataSource.getRepository(User);
      const existingUser = await userRepo.findOne({ where: { email } });

      if (existingUser) {
        return reply.status(400).send({ error: 'User already exists' });
      }

      if (!password) {
        throw new Error('Password is required');
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

      const user = userRepo.create({
        name,
        email,
        password: hashedPassword,
        phone,
        address,
        role: 'customer',
        otp,
        otpExpires,
        isVerified: false,
      });
      const savedUser = await userRepo.save(user);

      await sendEmail({ 
        email, 
        subject: 'Your Verification Code - Indhumathi Garments', 
        message: `Your OTP is ${otp}` 
      });

      return reply.status(201).send({
        message: 'Registration successful. Please verify OTP sent to your email.',
        userId: user.id,
        email: user.email,
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Verify OTP
  app.post('/verify-otp', { schema: { body: verifyOtpSchema } }, async (request, reply) => {
    try {
      const { email, otp } = request.body as z.infer<typeof verifyOtpSchema>;

      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { email } });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      if (user.otp !== otp) {
        return reply.status(400).send({ error: 'Invalid OTP' });
      }

      if (user.otpExpires && user.otpExpires < new Date()) {
        return reply.status(400).send({ error: 'OTP expired' });
      }

      user.isVerified = true;
      user.otp = undefined;
      user.otpExpires = undefined;
      const updatedUser = await userRepo.save(user);

      const token = generateToken(updatedUser.id, updatedUser.role);

      reply.setCookie('token', token, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      return reply.send({
        message: 'Email verified successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          phone: updatedUser.phone,
          address: updatedUser.address,
          isVerified: updatedUser.isVerified,
        },
        token,
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Forgot Password
  app.post('/forgot-password', {
    schema: { body: z.object({ email: z.string().email() }) }
  }, async (request, reply) => {
    try {
      const { email } = request.body as { email: string };
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { email } });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const crypto = await import('crypto');
      const resetToken = crypto.randomBytes(20).toString('hex');

      const resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

      const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);

      user.resetPasswordToken = resetPasswordToken;
      user.resetPasswordExpires = resetPasswordExpires;
      await userRepo.save(user);

      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      
      await sendEmail({
        email: user.email,
        subject: 'Password Reset Request',
        message: `You requested a password reset. Please go to this link to reset your password: \n\n ${resetUrl}`
      });

      return reply.send({ message: 'Email sent' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Reset Password
  app.post('/reset-password/:token', {
    schema: {
      params: z.object({ token: z.string() }),
      body: z.object({ password: z.string().min(6) })
    }
  }, async (request, reply) => {
    try {
      const crypto = await import('crypto');
      const { token } = request.params as { token: string };
      const resetPasswordToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      const userRepo = AppDataSource.getRepository(User);
      const { MoreThan } = await import('typeorm');
      const user = await userRepo.findOne({
        where: {
          resetPasswordToken,
          resetPasswordExpires: MoreThan(new Date())
        }
      });

      if (!user) {
        return reply.status(400).send({ error: 'Invalid or expired token' });
      }

      const { password } = request.body as { password: string };
      const hashedPassword = await bcrypt.hash(password, 10);

      user.password = hashedPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      const updatedUser = await userRepo.save(user);

      const newToken = generateToken(updatedUser.id, updatedUser.role);

      reply.setCookie('token', newToken, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      return reply.send({ message: 'Password reset successful', token: newToken });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Google Login/Signup
  app.post('/google', {
    schema: {
      body: z.object({
        token: z.string(),
      })
    }
  }, async (request, reply) => {
    try {
      const { token } = request.body as { token: string };
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return reply.status(400).send({ error: 'Invalid Google token' });
      }

      const { email, name, sub: googleId } = payload;

      const userRepo = AppDataSource.getRepository(User);
      let user = await userRepo.findOne({ where: [{ googleId }, { email }] });

      if (!user) {
        // Create new user
        user = userRepo.create({
          name: name || 'Google User',
          email,
          googleId,
          isGoogleUser: true,
          isVerified: true, // Google emails are already verified
          role: 'customer',
          password: '', // Empty password for Google users
          phone: '', // Placeholder
        });
        user = await userRepo.save(user);
      } else {
        // Update existing user if needed
        if (!user.googleId) {
          user.googleId = googleId;
          user.isGoogleUser = true;
          user.isVerified = true;
          await userRepo.save(user);
        }
      }

      if (!user.isActive) {
        return reply.status(403).send({ error: 'Account is inactive' });
      }

      const sessionToken = generateToken(user.id, user.role);

      reply.setCookie('token', sessionToken, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      return reply.send({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        address: user.address,
        isVerified: user.isVerified,
        token: sessionToken,
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

}
