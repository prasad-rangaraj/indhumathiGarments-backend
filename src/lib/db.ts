import { DataSource } from 'typeorm';
import { User } from '../entities/User.js';
import { Product } from '../entities/Product.js';
import { Address } from '../entities/Address.js';
import { Order } from '../entities/Order.js';
import { OrderItem } from '../entities/OrderItem.js';
import { Category } from '../entities/Category.js';
import { CartItem } from '../entities/CartItem.js';
import { WishlistItem } from '../entities/WishlistItem.js';
import { Review } from '../entities/Review.js';
import { Coupon } from '../entities/Coupon.js';
import { Enquiry } from '../entities/Enquiry.js';
import { Banner } from '../entities/Banner.js';
import { Settings } from '../entities/Settings.js';
import { AuditLog } from '../entities/AuditLog.js';
import { Notification } from '../entities/Notification.js';
import { ReturnRequest } from '../entities/ReturnRequest.js';
import { BlacklistedToken } from '../entities/BlacklistedToken.js';
import { ProductVariant } from '../entities/ProductVariant.js';
import { Transaction } from '../entities/Transaction.js';
import dotenv from 'dotenv';
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
  entities: [
    User, Product, Address, Order, OrderItem, Category, CartItem, 
    WishlistItem, Review, Coupon, Enquiry, Banner, Settings, AuditLog,
    Notification, ReturnRequest, BlacklistedToken, ProductVariant, Transaction
  ],
  subscribers: [],
  migrations: [],
});

export const initDb = async () => {
  try {
    if (!AppDataSource.isInitialized) {
      console.log('Connecting to database...');
      await AppDataSource.initialize();
      console.log('Data Source has been initialized!');
    }
  } catch (err) {
    console.error('Error during Data Source initialization', err);
    throw err;
  }
};
