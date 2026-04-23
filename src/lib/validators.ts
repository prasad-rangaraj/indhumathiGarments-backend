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
});

export const productSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().positive(),
  category: z.string(),
  subcategory: z.string(),
  image: z.string().optional().nullable(),
  sizes: z.array(z.string()).default([]),
  material: z.string().optional(),
  inStock: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
// Cart Schema
export const cartSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  size: z.string(),
  color: z.string().optional(),
});

// Wishlist Schema
export const wishlistSchema = z.object({
  productId: z.string(),
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
      productId: z.string(),
      quantity: z.number().int().positive().max(100),
      selectedSize: z.string().optional(),
      size: z.string().optional(), // Allow both for backward compat or flexible frontend
      selectedColor: z.string().optional(),
      color: z.string().optional(),
      price: z.number().positive(),
  })).nonempty(),
  total: z.number().positive(),
  originalTotal: z.number().nullable().optional(),
  discount: z.number().nullable().optional(),
  couponCode: z.string().nullable().optional(),
  customerInfo: z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().min(10),
      address: z.string().min(5),
      city: z.string(),
      pincode: z.string(),
  }),
  paymentMethod: z.string(),
});
