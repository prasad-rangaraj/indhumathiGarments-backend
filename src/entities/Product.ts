import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Relation } from 'typeorm';
import type { OrderItem } from './OrderItem.js';
import type { CartItem } from './CartItem.js';
import type { WishlistItem } from './WishlistItem.js';
import type { Review } from './Review.js';
import type { ProductVariant } from './ProductVariant.js';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'float' })
  price!: number;

  @Column({ type: 'varchar', nullable: true  })
  image?: string;

  @Column({ type: 'varchar', nullable: true  })
  material?: string;

  @Column({ type: 'varchar' })
  category!: string;

  @Column({ type: 'varchar' })
  subcategory!: string;

  @Column({ type: 'simple-json', nullable: true })
  images?: string[];

  @Column({ type: 'simple-json', nullable: true })
  sizes?: string[];

  @Column({ type: 'int', default: 0 })
  stock!: number;

  @Column({ type: 'boolean', default: true  })
  inStock!: boolean;

  @Column({ type: 'boolean', default: true  })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany('OrderItem', (orderItem: any) => orderItem.product)
  orderItems!: Relation<OrderItem[]>;

  @OneToMany('CartItem', (cartItem: any) => cartItem.product)
  cartItems!: Relation<CartItem[]>;

  @OneToMany('WishlistItem', (wishlistItem: any) => wishlistItem.product)
  wishlistItems!: Relation<WishlistItem[]>;

  @OneToMany('Review', (review: any) => review.product)
  reviews!: Relation<Review[]>;

  @OneToMany('ProductVariant', (variant: any) => variant.product)
  variants!: Relation<ProductVariant[]>;
}
