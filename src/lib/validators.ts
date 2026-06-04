import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  phone: z.string().min(10, 'Phone number must be valid'),
  address: z.string().optional(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const categorySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  image: z.string().optional(),
  isActive: z.boolean().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  gender: z.enum(['women', 'men', 'unisex']).optional().default('unisex'),
});

export const productSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.coerce.number().positive(),
  category: z.string(),
  subcategory: z.string(),
  image: z.string().optional().nullable(),
  images: z.array(z.string()).optional(),
  sizes: z.array(z.string()).default([]),
  colors: z.array(z.object({ name: z.string(), hex: z.string().optional(), images: z.array(z.string()), primaryImage: z.string().optional() })).optional(),
  showColorThumbnails: z.boolean().optional().default(false),
  material: z.string().optional(),
  inStock: z.boolean().optional(),
  stock: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  gender: z.enum(['women', 'men', 'unisex']).optional().default('women'),
});
// Cart Schema
export const cartSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().int().positive(),
  size: z.string(),
  color: z.string().optional(),
});

// Wishlist Schema
export const wishlistSchema = z.object({
  productId: z.string(),
  color: z.string().optional(),
});

// Review Schema
export const reviewSchema = z.object({
  productId: z.string(),
  rating: z.number().min(1).max(5),
  title: z.string().min(1),
  content: z.string().min(1),
  images: z.array(z.string()).optional().default([]),
});

// Order Schema
export const orderSchema = z.object({
  items: z.array(z.object({
      productId: z.string().uuid('Invalid product ID'),
      quantity: z.coerce.number().int().positive().max(100),
      selectedSize: z.string().optional(),
      size: z.string().optional(),
      selectedColor: z.string().optional(),
      color: z.string().optional(),
      price: z.coerce.number().positive(),
  })).nonempty(),
  total: z.coerce.number().positive(),
  originalTotal: z.coerce.number().nullable().optional(),
  discount: z.coerce.number().min(0).nullable().optional(),
  couponCode: z.string().max(50).nullable().optional(),
  customerInfo: z.object({
      name: z.string().min(2).max(100),
      email: z.string().email(),
      phone: z.string().min(10).max(15).regex(/^[0-9+\-\s()]+$/, 'Invalid phone number'),
      address: z.string().min(1).max(500),
      city: z.string().min(1).max(100),
      pincode: z.string().min(5).max(10).regex(/^[0-9]+$/, 'Invalid pincode'),
  }),
  paymentMethod: z.enum(['cod', 'upi', 'card', 'online']),
});
